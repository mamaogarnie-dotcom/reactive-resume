import { ORPCError } from "@orpc/client";
import { AISDKError } from "ai";
import { ZodError, z } from "zod";
import { protectedProcedure } from "../../context";
import { cvmateGapSchema, cvmateSelectionItemSchema } from "../../dto/cvmate-build";
import { aiRequestRateLimit } from "../../middleware/rate-limit";
import { cvmateBuildRecommendationsService } from "./recommendations";

const recommendationResultSchema = z.object({
	selectionItems: z.array(cvmateSelectionItemSchema),
	gaps: z.array(cvmateGapSchema),
});

export const recommendationsRouter = {
	generate: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/builds/{id}/recommendations",
			tags: ["CVMate CV Builds"],
			operationId: "generateCvmateBuildRecommendations",
			summary: "Generate CVMate content recommendations",
			description:
				"Uses the frozen job-offer snapshot and frozen candidate selection snapshots to recommend existing CV content and detect unsupported required or preferred job requirements. AI cannot create candidate facts and the user's selected flags are not changed. Requires authentication.",
			successDescription: "Updated selection recommendations and CV gaps.",
		})
		.input(
			z.object({
				id: z.string().trim().min(1),
				aiProviderId: z.string().trim().min(1).optional(),
			}),
		)
		.use(aiRequestRateLimit)
		.output(recommendationResultSchema)
		.errors({
			BAD_GATEWAY: {
				message: "The AI provider returned an error or is unreachable.",
				status: 502,
			},
			BAD_REQUEST: {
				message: "CV recommendations could not be generated.",
				status: 400,
			},
		})
		.handler(async ({ input, context }) => {
			try {
				return await cvmateBuildRecommendationsService.generate({
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
						message: "The AI returned an improperly formatted recommendation result.",
						cause: error,
					});
				}

				throw error;
			}
		}),
};
