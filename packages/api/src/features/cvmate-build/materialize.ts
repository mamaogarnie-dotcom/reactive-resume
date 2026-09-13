import { ORPCError } from "@orpc/client";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { defaultLocale, isLocale } from "@reactive-resume/utils/locale";
import { and, desc, eq } from "drizzle-orm";
import { cvmateProfileService } from "../cvmate-profile/service";
import { resumeService } from "../resume/service";
import { createResumeDataFromCvmate } from "./resume-adapter";
import { cvmateBuildService } from "./service";

function snapshotText(snapshot: Record<string, unknown> | null, key: string): string {
	const value = snapshot?.[key];
	return typeof value === "string" ? value.trim() : "";
}

function resumeName(jobOfferSnapshot: Record<string, unknown> | null): string {
	const roleTitle = snapshotText(jobOfferSnapshot, "roleTitle");
	const companyName = snapshotText(jobOfferSnapshot, "companyName");

	if (roleTitle && companyName) return `${roleTitle} - ${companyName}`;
	return roleTitle || companyName || "1story CV";
}

export const cvmateBuildMaterializeService = {
	materialize: async (input: { id: string; userId: string }) => {
		const build = await cvmateBuildService.getById({
			id: input.id,
			userId: input.userId,
		});

		const profile = await cvmateProfileService.getCurrent({
			userId: input.userId,
		});

		if (!profile || profile.profile.id !== build.masterProfileId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "The CV build Master Profile is no longer available.",
			});
		}

		const [selectionItems, generatedContent] = await Promise.all([
			cvmateBuildService.listSelectionItems({
				cvBuildId: build.id,
				userId: input.userId,
			}),
			cvmateBuildService.listGeneratedContent({
				cvBuildId: build.id,
				userId: input.userId,
			}),
		]);

		const data = createResumeDataFromCvmate({
			profile,
			selectionItems,
			generatedContent,
			targetLanguage: build.targetLanguage,
		});

		const locale = isLocale(data.metadata.page.locale) ? data.metadata.page.locale : defaultLocale;

		const name = resumeName(build.jobOfferSnapshot);

		const [existingDocument] = await db
			.select()
			.from(schema.cvmateCvDocument)
			.where(and(eq(schema.cvmateCvDocument.cvBuildId, build.id), eq(schema.cvmateCvDocument.userId, input.userId)))
			.orderBy(desc(schema.cvmateCvDocument.updatedAt))
			.limit(1);

		if (existingDocument) {
			await resumeService.update({
				id: existingDocument.resumeId,
				userId: input.userId,
				name,
				data,
			});

			await db
				.update(schema.cvmateCvDocument)
				.set({ updatedAt: new Date() })
				.where(
					and(eq(schema.cvmateCvDocument.id, existingDocument.id), eq(schema.cvmateCvDocument.userId, input.userId)),
				);

			return {
				documentId: existingDocument.id,
				resumeId: existingDocument.resumeId,
				created: false,
			};
		}

		const resumeId = await resumeService.create({
			userId: input.userId,
			name,
			slug: `cvmate-${build.id}`,
			tags: [],
			locale,
			data,
		});

		const [document] = await db
			.insert(schema.cvmateCvDocument)
			.values({
				userId: input.userId,
				cvBuildId: build.id,
				resumeId,
				status: "draft",
			})
			.returning();

		if (!document) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create the 1story document.",
			});
		}

		return {
			documentId: document.id,
			resumeId,
			created: true,
		};
	},
};
