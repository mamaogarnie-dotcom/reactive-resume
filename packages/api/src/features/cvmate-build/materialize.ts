import { cvmateBuildIdentitySnapshotSchema } from "../../dto/cvmate-build";
import type { CvmateBuildDesignSettings } from "../../dto/cvmate-build-materialize";
import { ORPCError } from "@orpc/client";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { defaultLocale, isLocale } from "@reactive-resume/utils/locale";
import { cvmateBuildDesignSettingsSchema } from "../../dto/cvmate-build-materialize";
import { resumeService } from "../resume/service";
import { createResumeDataFromCvmate } from "./resume-adapter";
import { cvmateBuildService } from "./service";

const recommendedCvmateDesignSettings = {
	template: "lapras",
	primaryColor: "#4E6B35",
	textColor: "#1F2937",
	backgroundColor: "#FFFFFF",
} satisfies CvmateBuildDesignSettings;

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

function resolveDesignSettings(value: Record<string, unknown> | null): CvmateBuildDesignSettings {
	if (value === null) {
		return { ...recommendedCvmateDesignSettings };
	}

	const parsed = cvmateBuildDesignSettingsSchema.safeParse(value);

	if (!parsed.success) {
		throw new ORPCError("BAD_REQUEST", {
			message: "This CV build contains invalid design settings.",
			cause: parsed.error,
		});
	}

	return parsed.data;
}

function resolveIdentitySnapshot(
	value: Record<string, unknown> | null,
	masterProfileId: string | null,
) {
	const parsed = cvmateBuildIdentitySnapshotSchema.safeParse(value);

	if (
		!parsed.success ||
		(masterProfileId !== null && parsed.data.id !== masterProfileId)
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: "This CV build does not contain a valid frozen candidate identity.",
			...(!parsed.success ? { cause: parsed.error } : {}),
		});
	}

	return parsed.data;
}

async function prepareResumeData(input: { id: string; userId: string }) {
	const build = await cvmateBuildService.getById({
		id: input.id,
		userId: input.userId,
	});

	const identity = resolveIdentitySnapshot(
		build.identitySnapshot,
		build.masterProfileId,
	);

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

	const designSettings = resolveDesignSettings(build.designSettings);

	const data = createResumeDataFromCvmate({
		profile: { profile: identity },
		selectionItems,
		generatedContent,
		targetLanguage: build.targetLanguage,
		designSettings,
	});

	return {
		build,
		data,
		designSettings,
		usesRecommendation: build.designSettings === null,
	};
}

export const cvmateBuildMaterializeService = {
	preview: async (input: { id: string; userId: string }) => {
		const { data, designSettings, usesRecommendation } = await prepareResumeData(input);

		return {
			data,
			designSettings,
			usesRecommendation,
		};
	},

	materialize: async (input: { id: string; userId: string }) => {
		const { build, data } = await prepareResumeData(input);

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
