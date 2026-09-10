import { ORPCError } from "@orpc/client";
import { AISDKError } from "ai";
import { ZodError, z } from "zod";
import { protectedProcedure } from "../../context";
import { cvmateJobOfferDetailSchema } from "../../dto/cvmate-job-offer";
import { aiRequestRateLimit } from "../../middleware/rate-limit";
import { cvmateJobOfferAnalysisService } from "./analysis";

export const analysisRouter = {
	analyze: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/job-offers/{id}/analyze",
			tags: ["CVMate Job Offers"],
			operationId: "analyzeCvmateJobOffer",
			summary: "Analyze CVMate job offer",
			description:
				"Analyzes pasted job-offer text and uploaded PDF/image assets using the user's configured AI provider. Extracted requirements replace only previous AI-generated requirements; manually edited requirements are preserved. Requires authentication.",
			successDescription: "The analyzed CVMate job offer.",
		})
		.input(
			z.object({
				id: z.string().trim().min(1),
				aiProviderId: z.string().trim().min(1).optional(),
			}),
		)
		.use(aiRequestRateLimit)
		.output(cvmateJobOfferDetailSchema)
		.errors({
			BAD_GATEWAY: {
				message: "The AI provider returned an error or is unreachable.",
				status: 502,
			},
			BAD_REQUEST: {
				message: "The job offer could not be analyzed.",
				status: 400,
			},
		})
		.handler(async ({ input, context }) => {
			try {
				return await cvmateJobOfferAnalysisService.analyze({
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
						message: "The AI returned an improperly formatted job-offer analysis.",
						cause: error,
					});
				}

				throw error;
			}
		}),
};
