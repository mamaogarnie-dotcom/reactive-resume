import z from "zod";
import { protectedProcedure } from "../../context";
import { cvmateDocumentsService } from "./documents";

const documentStatusSchema = z.enum(["draft", "ready"]);

const documentSummarySchema = z.object({
	id: z.string(),
	cvBuildId: z.string().nullable(),
	resumeId: z.string(),
	name: z.string(),
	status: documentStatusSchema,
	isFavorite: z.boolean(),
	trashedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const updateDocumentSchema = z
	.object({
		id: z.string().trim().min(1),
		status: documentStatusSchema.optional(),
		isFavorite: z.boolean().optional(),
		trashed: z.boolean().optional(),
	})
	.refine(
		(value) =>
			value.status !== undefined ||
			value.isFavorite !== undefined ||
			value.trashed !== undefined,
		"Provide at least one document field to update.",
	);

export const documentsRouter = {
	list: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/documents",
			tags: ["CVMate Documents"],
			operationId: "listCvmateDocuments",
			summary: "List CVMate CV documents",
			description:
				"Lists the authenticated user's materialized CVMate CV documents, including draft/ready, favorite and trash metadata.",
		})
		.input(z.object({}).optional().default({}))
		.output(z.array(documentSummarySchema))
		.handler(async ({ context }) =>
			cvmateDocumentsService.list({ userId: context.user.id }),
		),

	update: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/documents/{id}",
			tags: ["CVMate Documents"],
			operationId: "updateCvmateDocument",
			summary: "Update a CVMate CV document",
			description:
				"Updates document status, favorite state, or soft-trash state for the authenticated owner.",
		})
		.input(updateDocumentSchema)
		.output(documentSummarySchema)
		.handler(async ({ input, context }) =>
			cvmateDocumentsService.update({
				id: input.id,
				userId: context.user.id,
				...(input.status !== undefined ? { status: input.status } : {}),
				...(input.isFavorite !== undefined
					? { isFavorite: input.isFavorite }
					: {}),
				...(input.trashed !== undefined ? { trashed: input.trashed } : {}),
			}),
		),
};
