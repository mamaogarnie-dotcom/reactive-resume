import { ORPCError } from "@orpc/client";
import { AISDKError } from "ai";
import { ZodError, z } from "zod";
import { protectedProcedure } from "../../context";
import { cvmateGeneratedContentSchema } from "../../dto/cvmate-build";
import { aiRequestRateLimit } from "../../middleware/rate-limit";
import { cvmateBuildTailoredContentService } from "./tailored-content";

const tailoredContentResultSchema = z.object({
	generatedContent: z.array(cvmateGeneratedContentSchema),
});

export const tailoredContentRouter = {
	generate: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/builds/{id}/tailored-content",
			tags: ["1story CV Builds"],
			operationId: "generateCvmateBuildTailoredContent",
			summary: "Generate tailored 1story CV text",
			description:
				"Uses only the selected frozen candidate snapshots and frozen analyzed job offer to generate a professional summary and wording for selected experience facts. Existing user finalText overrides are preserved. Requires authentication.",
			successDescription: "Generated or refreshed tailored CV content.",
		})
		.input(
			z.object({
				id: z.string().trim().min(1),
				aiProviderId: z.string().trim().min(1).optional(),
			}),
		)
		.use(aiRequestRateLimit)
		.output(tailoredContentResultSchema)
		.errors({
			BAD_GATEWAY: {
				message: "The AI provider returned an error or is unreachable.",
				status: 502,
			},
			BAD_REQUEST: {
				message: "Tailored CV content could not be generated.",
				status: 400,
			},
		})
		.handler(async ({ input, context }) => {
			try {
				return await cvmateBuildTailoredContentService.generate({
					id: input.id,
					userId: context.user.id,
					...(input.aiProviderId ? { aiProviderId: input.aiProviderId } : {}),
				});
			} catch (error) {
				if (error instanceof ORPCError) throw error;

				if (error instanceof AISDKError) {
					throw new ORPCError("BAD_GATEWAY", {
						message: "Could not reach the AI provider.",
						cause: error,
					});
				}

				if (error instanceof ZodError || error instanceof SyntaxError) {
					throw new ORPCError("BAD_REQUEST", {
						message: "The AI returned improperly formatted tailored CV content.",
						cause: error,
					});
				}

				throw error;
			}
		}),
};
