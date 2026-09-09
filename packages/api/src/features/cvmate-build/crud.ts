import { protectedProcedure } from "../../context";
import { cvmateBuildDto } from "../../dto/cvmate-build";
import { resumeMutationRateLimit } from "../../middleware/rate-limit";
import { cvmateBuildService } from "./service";

export const crudRouter = {
	list: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/builds",
			tags: ["CVMate CV Build"],
			operationId: "listCvmateCvBuilds",
			summary: "List CV builds",
			description:
				"Returns CVMate CV builds belonging to the authenticated user, ordered by most recently updated. Requires authentication.",
			successDescription: "The authenticated user's CV builds.",
		})
		.input(cvmateBuildDto.list.input)
		.output(cvmateBuildDto.list.output)
		.handler(({ context }) =>
			cvmateBuildService.list({
				userId: context.user.id,
			}),
		),

	getById: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/builds/{id}",
			tags: ["CVMate CV Build"],
			operationId: "getCvmateCvBuild",
			summary: "Get CV build",
			description: "Returns a CVMate CV build belonging to the authenticated user. Requires authentication.",
			successDescription: "The requested CV build.",
		})
		.input(cvmateBuildDto.getById.input)
		.output(cvmateBuildDto.getById.output)
		.handler(({ input, context }) =>
			cvmateBuildService.getById({
				id: input.id,
				userId: context.user.id,
			}),
		),

	create: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/builds",
			tags: ["CVMate CV Build"],
			operationId: "createCvmateCvBuild",
			summary: "Create CV build",
			description:
				"Starts a new CVMate CV build for the authenticated user's Master Profile. An optional owned job offer can be linked and snapshotted at creation time. Requires authentication.",
			successDescription: "The ID of the created CV build.",
		})
		.input(cvmateBuildDto.create.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.create.output)
		.handler(({ input, context }) =>
			cvmateBuildService.create({
				userId: context.user.id,
				...input,
			}),
		),

	update: protectedProcedure
		.route({
			method: "PUT",
			path: "/cvmate/builds/{id}",
			tags: ["CVMate CV Build"],
			operationId: "updateCvmateCvBuild",
			summary: "Update CV build",
			description:
				"Updates an owned CVMate CV build. Changing the linked job offer refreshes its stored snapshot. The completed step and completed status must be set together. Requires authentication.",
			successDescription: "The updated CV build.",
		})
		.input(cvmateBuildDto.update.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.update.output)
		.handler(({ input, context }) =>
			cvmateBuildService.update({
				userId: context.user.id,
				...input,
			}),
		),

	delete: protectedProcedure
		.route({
			method: "DELETE",
			path: "/cvmate/builds/{id}",
			tags: ["CVMate CV Build"],
			operationId: "deleteCvmateCvBuild",
			summary: "Delete CV build",
			description:
				"Deletes a CVMate CV build belonging to the authenticated user. Related build data is removed according to database cascade rules. Requires authentication.",
			successDescription: "The CV build was deleted.",
		})
		.input(cvmateBuildDto.delete.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.delete.output)
		.handler(({ input, context }) =>
			cvmateBuildService.delete({
				id: input.id,
				userId: context.user.id,
			}),
		),
};
