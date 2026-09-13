import { protectedProcedure } from "../../context";
import { cvmatePreferencesDto } from "../../dto/cvmate-preferences";
import { resumeMutationRateLimit } from "../../middleware/rate-limit";
import { cvmatePreferencesService } from "./service";

export const cvmatePreferencesRouter = {
	getCurrent: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/preferences",
			tags: ["1story Preferences"],
			operationId: "getCvmatePreferences",
			summary: "Get current 1story preferences",
			description:
				"Returns the authenticated user's saved 1story preferences. Returns null when no preferences have been saved yet. Requires authentication.",
			successDescription: "The current 1story preferences, or null if none exist.",
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
			tags: ["1story Preferences"],
			operationId: "updateCvmatePreferences",
			summary: "Update 1story preferences",
			description:
				"Creates or updates the authenticated user's 1story preferences. Provided settings replace the previously saved settings object. Requires authentication.",
			successDescription: "The updated 1story preferences.",
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
