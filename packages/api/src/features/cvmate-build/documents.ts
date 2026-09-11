import { ORPCError } from "@orpc/client";
import { db } from "@reactive-resume/db/client";
import type { CvmateDocumentStatus } from "@reactive-resume/db/schema";
import * as schema from "@reactive-resume/db/schema";
import { and, desc, eq } from "drizzle-orm";

type UpdateDocumentInput = {
	id: string;
	userId: string;
	status?: CvmateDocumentStatus;
	isFavorite?: boolean;
	trashed?: boolean;
};

async function requireOwnedDocument(id: string, userId: string) {
	const [document] = await db
		.select()
		.from(schema.cvmateCvDocument)
		.where(
			and(
				eq(schema.cvmateCvDocument.id, id),
				eq(schema.cvmateCvDocument.userId, userId),
			),
		)
		.limit(1);

	if (!document) throw new ORPCError("NOT_FOUND");

	return document;
}

async function getDocumentSummary(id: string, userId: string) {
	const [row] = await db
		.select({
			document: schema.cvmateCvDocument,
			name: schema.resume.name,
		})
		.from(schema.cvmateCvDocument)
		.innerJoin(
			schema.resume,
			eq(schema.cvmateCvDocument.resumeId, schema.resume.id),
		)
		.where(
			and(
				eq(schema.cvmateCvDocument.id, id),
				eq(schema.cvmateCvDocument.userId, userId),
			),
		)
		.limit(1);

	if (!row) throw new ORPCError("NOT_FOUND");

	return { ...row.document, name: row.name };
}

export const cvmateDocumentsService = {
	list: async ({ userId }: { userId: string }) => {
		const rows = await db
			.select({
				document: schema.cvmateCvDocument,
				name: schema.resume.name,
			})
			.from(schema.cvmateCvDocument)
			.innerJoin(
				schema.resume,
				eq(schema.cvmateCvDocument.resumeId, schema.resume.id),
			)
			.where(eq(schema.cvmateCvDocument.userId, userId))
			.orderBy(desc(schema.cvmateCvDocument.updatedAt));

		return rows.map((row) => ({ ...row.document, name: row.name }));
	},

	update: async (input: UpdateDocumentInput) => {
		await requireOwnedDocument(input.id, input.userId);

		const patch: Partial<typeof schema.cvmateCvDocument.$inferInsert> = {
			updatedAt: new Date(),
		};

		if (input.status !== undefined) patch.status = input.status;
		if (input.isFavorite !== undefined) patch.isFavorite = input.isFavorite;
		if (input.trashed !== undefined)
			patch.trashedAt = input.trashed ? new Date() : null;

		await db
			.update(schema.cvmateCvDocument)
			.set(patch)
			.where(
				and(
					eq(schema.cvmateCvDocument.id, input.id),
					eq(schema.cvmateCvDocument.userId, input.userId),
				),
			);

		return getDocumentSummary(input.id, input.userId);
	},
};
