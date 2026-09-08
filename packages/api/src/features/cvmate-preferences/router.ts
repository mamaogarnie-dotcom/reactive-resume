import { protectedProcedure } from "../../context";
import { cvmatePreferencesDto } from "../../dto/cvmate-preferences";
import { resumeMutationRateLimit } from "../../middleware/rate-limit";
import { cvmatePreferencesService } from "./service";

export const cvmatePreferencesRouter = {
	getCurrent: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/preferences",
			tags: ["CVMate Preferences"],
			operationId: "getCvmatePreferences",
			summary: "Get current CVMate preferences",
			description:
				"Returns the authenticated user's saved CVMate preferences. Returns null when no preferences have been saved yet. Requires authentication.",
			successDescription: "The current CVMate preferences, or null if none exist.",
		})
		.input(cvmatePreferencesDto.getCurrent.input)
		.output(cvmatePreferencesDto.getCurrent.output)
		.handler(({ context }) =>
			cvmatePreferencesService.getCurrent({
				userId: context.user.id,
			}),
		),

	update: protectedProcedure
		.route({
			method: "PUT",
			path: "/cvmate/preferences",
			tags: ["CVMate Preferences"],
			operationId: "updateCvmatePreferences",
			summary: "Update CVMate preferences",
			description:
				"Creates or updates the authenticated user's CVMate preferences. Provided settings replace the previously saved settings object. Requires authentication.",
			successDescription: "The updated CVMate preferences.",
		})
		.input(cvmatePreferencesDto.update.input)
		.use(resumeMutationRateLimit)
		.output(cvmatePreferencesDto.update.output)
		.handler(({ input, context }) =>
			cvmatePreferencesService.update({
				...input,
				userId: context.user.id,
			}),
		),
};
