import { protectedProcedure } from "../../context";
import { cvmateBuildDto } from "../../dto/cvmate-build";
import { cvmateBuildMaterializeDto } from "../../dto/cvmate-build-materialize";
import { resumeMutationRateLimit } from "../../middleware/rate-limit";
import { cvmateBuildMaterializeService } from "./materialize";
import { cvmateBuildService } from "./service";

export const crudRouter = {
	list: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/builds",
			tags: ["1story CV Build"],
			operationId: "listCvmateCvBuilds",
			summary: "List CV builds",
			description:
				"Returns 1story CV builds belonging to the authenticated user, ordered by most recently updated. Requires authentication.",
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
			tags: ["1story CV Build"],
			operationId: "getCvmateCvBuild",
			summary: "Get CV build",
			description: "Returns a 1story CV build belonging to the authenticated user. Requires authentication.",
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
			tags: ["1story CV Build"],
			operationId: "createCvmateCvBuild",
			summary: "Create CV build",
			description:
				"Starts a new 1story CV build for the authenticated user's Master Profile. An optional owned job offer can be linked and snapshotted at creation time. Requires authentication.",
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
			tags: ["1story CV Build"],
			operationId: "updateCvmateCvBuild",
			summary: "Update CV build",
			description:
				"Updates an owned 1story CV build. Changing the linked job offer refreshes its stored snapshot. The completed step and completed status must be set together. Requires authentication.",
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
			tags: ["1story CV Build"],
			operationId: "deleteCvmateCvBuild",
			summary: "Delete CV build",
			description:
				"Deletes a 1story CV build belonging to the authenticated user. Related build data is removed according to database cascade rules. Requires authentication.",
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

	listSelectionItems: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/builds/{cvBuildId}/selection-items",
			tags: ["1story CV Build"],
			operationId: "listCvmateCvSelectionItems",
			summary: "List CV selection items",
			description:
				"Returns selection items belonging to an authenticated user's CV build, ordered by sort order and creation time. Requires authentication.",
			successDescription: "The CV build selection items.",
		})
		.input(cvmateBuildDto.listSelectionItems.input)
		.output(cvmateBuildDto.listSelectionItems.output)
		.handler(({ input, context }) =>
			cvmateBuildService.listSelectionItems({
				cvBuildId: input.cvBuildId,
				userId: context.user.id,
			}),
		),

	createSelectionItem: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/builds/{cvBuildId}/selection-items",
			tags: ["1story CV Build"],
			operationId: "createCvmateCvSelectionItem",
			summary: "Create CV selection item",
			description:
				"Adds a Master Profile source to an owned CV build. Source snapshots are resolved and stored by the server and cannot be supplied by the client. Requires authentication.",
			successDescription: "The created CV selection item.",
		})
		.input(cvmateBuildDto.createSelectionItem.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.createSelectionItem.output)
		.handler(({ input, context }) =>
			cvmateBuildService.createSelectionItem({
				userId: context.user.id,
				...input,
			}),
		),

	updateSelectionItem: protectedProcedure
		.route({
			method: "PUT",
			path: "/cvmate/selection-items/{id}",
			tags: ["1story CV Build"],
			operationId: "updateCvmateCvSelectionItem",
			summary: "Update CV selection item",
			description:
				"Updates user-editable fields of an owned CV selection item. Source identity and stored source snapshots cannot be changed through this endpoint. Requires authentication.",
			successDescription: "The updated CV selection item.",
		})
		.input(cvmateBuildDto.updateSelectionItem.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.updateSelectionItem.output)
		.handler(({ input, context }) =>
			cvmateBuildService.updateSelectionItem({
				userId: context.user.id,
				...input,
			}),
		),

	deleteSelectionItem: protectedProcedure
		.route({
			method: "DELETE",
			path: "/cvmate/selection-items/{id}",
			tags: ["1story CV Build"],
			operationId: "deleteCvmateCvSelectionItem",
			summary: "Delete CV selection item",
			description:
				"Deletes a CV selection item belonging to an authenticated user's CV build. Child selection items are removed according to database cascade rules. Requires authentication.",
			successDescription: "The CV selection item was deleted.",
		})
		.input(cvmateBuildDto.deleteSelectionItem.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.deleteSelectionItem.output)
		.handler(({ input, context }) =>
			cvmateBuildService.deleteSelectionItem({
				id: input.id,
				userId: context.user.id,
			}),
		),
	listGaps: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/builds/{cvBuildId}/gaps",
			tags: ["1story CV Build"],
			operationId: "listCvmateCvGaps",
			summary: "List CV gaps",
			description:
				"Returns gaps belonging to an authenticated user's CV build, ordered by sort order and creation time. Requires authentication.",
			successDescription: "The CV build gaps.",
		})
		.input(cvmateBuildDto.listGaps.input)
		.output(cvmateBuildDto.listGaps.output)
		.handler(({ input, context }) =>
			cvmateBuildService.listGaps({
				cvBuildId: input.cvBuildId,
				userId: context.user.id,
			}),
		),

	createGap: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/builds/{cvBuildId}/gaps",
			tags: ["1story CV Build"],
			operationId: "createCvmateCvGap",
			summary: "Create CV gap",
			description:
				"Creates a manual gap in an owned CV build. Gap origin and server-owned snapshots cannot be supplied by the client. Requires authentication.",
			successDescription: "The created CV gap.",
		})
		.input(cvmateBuildDto.createGap.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.createGap.output)
		.handler(({ input, context }) =>
			cvmateBuildService.createGap({
				userId: context.user.id,
				...input,
			}),
		),

	updateGap: protectedProcedure
		.route({
			method: "PUT",
			path: "/cvmate/gaps/{id}",
			tags: ["1story CV Build"],
			operationId: "updateCvmateCvGap",
			summary: "Update CV gap",
			description:
				"Updates user-editable fields of an owned CV gap. Resolution snapshots and resolved timestamps are managed by the server. Requires authentication.",
			successDescription: "The updated CV gap.",
		})
		.input(cvmateBuildDto.updateGap.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.updateGap.output)
		.handler(({ input, context }) =>
			cvmateBuildService.updateGap({
				userId: context.user.id,
				...input,
			}),
		),

	deleteGap: protectedProcedure
		.route({
			method: "DELETE",
			path: "/cvmate/gaps/{id}",
			tags: ["1story CV Build"],
			operationId: "deleteCvmateCvGap",
			summary: "Delete CV gap",
			description: "Deletes a CV gap belonging to an authenticated user's CV build. Requires authentication.",
			successDescription: "The CV gap was deleted.",
		})
		.input(cvmateBuildDto.deleteGap.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.deleteGap.output)
		.handler(({ input, context }) =>
			cvmateBuildService.deleteGap({
				id: input.id,
				userId: context.user.id,
			}),
		),
	listGeneratedContent: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/builds/{cvBuildId}/generated-content",
			tags: ["1story CV Build"],
			operationId: "listCvmateCvGeneratedContent",
			summary: "List CV generated content",
			description:
				"Returns generated content records belonging to an authenticated user's CV build. Requires authentication.",
			successDescription: "The CV build generated content records.",
		})
		.input(cvmateBuildDto.listGeneratedContent.input)
		.output(cvmateBuildDto.listGeneratedContent.output)
		.handler(({ input, context }) =>
			cvmateBuildService.listGeneratedContent({
				cvBuildId: input.cvBuildId,
				userId: context.user.id,
			}),
		),

	updateGeneratedContentFinalText: protectedProcedure
		.route({
			method: "PUT",
			path: "/cvmate/generated-content/{id}/final-text",
			tags: ["1story CV Build"],
			operationId: "updateCvmateCvGeneratedContentFinalText",
			summary: "Update generated content final text",
			description:
				"Updates or clears only the user-editable final text of an owned generated content record. AI text, source snapshots, model and prompt metadata remain server-owned. Requires authentication.",
			successDescription: "The updated generated content record.",
		})
		.input(cvmateBuildDto.updateGeneratedContentFinalText.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildDto.updateGeneratedContentFinalText.output)
		.handler(({ input, context }) =>
			cvmateBuildService.updateGeneratedContentFinalText({
				userId: context.user.id,
				...input,
			}),
		),

	materialize: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/builds/{id}/materialize",
			tags: ["1story CV Build"],
			operationId: "materializeCvmateCvBuild",
			summary: "Materialize CV build",
			description:
				"Creates a Reactive Resume from an owned 1story build, or updates the existing materialized resume for that build. Requires authentication.",
			successDescription: "The materialized 1story document and Reactive Resume identifiers.",
		})
		.input(cvmateBuildMaterializeDto.materialize.input)
		.use(resumeMutationRateLimit)
		.output(cvmateBuildMaterializeDto.materialize.output)
		.handler(({ input, context }) =>
			cvmateBuildMaterializeService.materialize({
				id: input.id,
				userId: context.user.id,
			}),
		),
};
