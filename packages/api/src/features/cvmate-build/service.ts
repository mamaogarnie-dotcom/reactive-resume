import type {
	CvmateBuildStatus,
	CvmateBuildStep,
	CvmateGapStatus,
	CvmateRequirementPriority,
	CvmateSelectionSourceType,
} from "@reactive-resume/db/schema";
import { ORPCError } from "@orpc/client";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { generateId } from "@reactive-resume/utils/string";
import { cvmateJobOfferService } from "../cvmate-job-offer/service";
import { cvmateProfileService } from "../cvmate-profile/service";

type BuildCreateFields = {
	jobOfferId?: string | null | undefined;
	targetLanguage?: string | null | undefined;
	designSettings?: Record<string, unknown> | null | undefined;
};

type BuildUpdateFields = {
	jobOfferId?: string | null | undefined;
	currentStep?: CvmateBuildStep | undefined;
	status?: CvmateBuildStatus | undefined;
	targetLanguage?: string | null | undefined;
	designSettings?: Record<string, unknown> | null | undefined;
};

type SelectionItemCreateFields = {
	parentSelectionItemId?: string | null | undefined;
	sourceType: CvmateSelectionSourceType;
	sourceId: string;
	selected?: boolean | undefined;
	sortOrder?: number | undefined;
};

type SelectionItemUpdateFields = {
	parentSelectionItemId?: string | null | undefined;
	selected?: boolean | undefined;
	sortOrder?: number | undefined;
};
type GapCreateFields = {
	text: string;
	severity?: CvmateRequirementPriority | undefined;
	sortOrder?: number | undefined;
};

type GapUpdateFields = {
	text?: string | undefined;
	severity?: CvmateRequirementPriority | undefined;
	status?: CvmateGapStatus | undefined;
	resolutionSourceType?: CvmateSelectionSourceType | null | undefined;
	resolutionSourceId?: string | null | undefined;
	sortOrder?: number | undefined;
};

type CurrentProfile = NonNullable<Awaited<ReturnType<typeof cvmateProfileService.getCurrent>>>;

const stripUserId = <T extends { userId: string }>(row: T) => {
	const { userId: _userId, ...rest } = row;
	return rest;
};

async function requireOwnedBuild(id: string, userId: string) {
	const [build] = await db
		.select()
		.from(schema.cvmateCvBuild)
		.where(and(eq(schema.cvmateCvBuild.id, id), eq(schema.cvmateCvBuild.userId, userId)));

	if (!build) throw new ORPCError("NOT_FOUND");

	return build;
}

async function requireOwnedSelectionItem(id: string, userId: string) {
	const [selectionItem] = await db
		.select()
		.from(schema.cvmateCvSelectionItem)
		.where(eq(schema.cvmateCvSelectionItem.id, id));

	if (!selectionItem) throw new ORPCError("NOT_FOUND");

	const build = await requireOwnedBuild(selectionItem.cvBuildId, userId);

	return { selectionItem, build };
}

async function requireOwnedGap(id: string, userId: string) {
	const [gap] = await db.select().from(schema.cvmateCvGap).where(eq(schema.cvmateCvGap.id, id));

	if (!gap) throw new ORPCError("NOT_FOUND");

	const build = await requireOwnedBuild(gap.cvBuildId, userId);

	return { gap, build };
}

async function resolveGapResolutionSource(cvBuildId: string, sourceType: CvmateSelectionSourceType, sourceId: string) {
	const [selectionItem] = await db
		.select()
		.from(schema.cvmateCvSelectionItem)
		.where(
			and(
				eq(schema.cvmateCvSelectionItem.cvBuildId, cvBuildId),
				eq(schema.cvmateCvSelectionItem.sourceType, sourceType),
				eq(schema.cvmateCvSelectionItem.sourceId, sourceId),
				eq(schema.cvmateCvSelectionItem.selected, true),
			),
		);

	if (!selectionItem) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Gap resolution source must be a selected item in the same CV build.",
		});
	}

	return selectionItem.sourceTextSnapshot;
}
async function getJobOfferSnapshot(jobOfferId: string, userId: string) {
	const offer = await cvmateJobOfferService.getById({
		id: jobOfferId,
		userId,
	});

	return structuredClone(offer) as Record<string, unknown>;
}

function validateCompletionState(currentStep: CvmateBuildStep, status: CvmateBuildStatus) {
	const stepCompleted = currentStep === "completed";
	const statusCompleted = status === "completed";

	if (stepCompleted !== statusCompleted) {
		throw new ORPCError("BAD_REQUEST", {
			message: 'CV build step "completed" and status "completed" must be set together.',
		});
	}
}

async function getBuildProfile(build: Awaited<ReturnType<typeof requireOwnedBuild>>, userId: string) {
	if (!build.masterProfileId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "The CV build Master Profile is no longer available.",
		});
	}

	const profile = await cvmateProfileService.getCurrent({ userId });

	if (!profile || profile.profile.id !== build.masterProfileId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "The CV build Master Profile is no longer available.",
		});
	}

	return profile;
}

function findSelectionSource(profile: CurrentProfile, sourceType: CvmateSelectionSourceType, sourceId: string) {
	switch (sourceType) {
		case "employment":
			return profile.employments.find((item) => item.id === sourceId);
		case "experience_fact":
			return profile.experienceFacts.find((item) => item.id === sourceId);
		case "project":
			return profile.projects.find((item) => item.id === sourceId);
		case "education":
			return profile.education.find((item) => item.id === sourceId);
		case "course":
			return profile.courses.find((item) => item.id === sourceId);
		case "certification":
			return profile.certifications.find((item) => item.id === sourceId);
		case "volunteer":
			return profile.volunteer.find((item) => item.id === sourceId);
		case "language":
			return profile.languages.find((item) => item.id === sourceId);
		case "award":
			return profile.awards.find((item) => item.id === sourceId);
		case "reference":
			return profile.references.find((item) => item.id === sourceId);
		case "license":
			return profile.licenses.find((item) => item.id === sourceId);
		case "profile_list_item":
			return profile.listItems.find((item) => item.id === sourceId);
		case "clause":
			return profile.clauses.find((item) => item.id === sourceId);
		case "profile_photo":
			return profile.photos.find((item) => item.id === sourceId);
		case "custom_section_item":
			return profile.customSectionItems.find((item) => item.id === sourceId);
	}
}

function firstText(...values: Array<string | null | undefined>) {
	for (const value of values) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}

	return null;
}

function getSelectionSourceText(sourceType: CvmateSelectionSourceType, source: ReturnType<typeof findSelectionSource>) {
	if (!source) return null;

	switch (sourceType) {
		case "employment": {
			const value = source as CurrentProfile["employments"][number];
			const parts = [value.jobTitle, value.company]
				.filter((part): part is string => typeof part === "string" && part.trim().length > 0)
				.map((part) => part.trim());

			return parts.length > 0 ? parts.join(" — ") : null;
		}

		case "experience_fact":
			return firstText((source as CurrentProfile["experienceFacts"][number]).text);

		case "project": {
			const value = source as CurrentProfile["projects"][number];
			return firstText(value.description, value.name, value.company);
		}

		case "education": {
			const value = source as CurrentProfile["education"][number];
			return firstText(value.description, value.degree, value.fieldOfStudy, value.institution);
		}

		case "course": {
			const value = source as CurrentProfile["courses"][number];
			return firstText(value.description, value.name, value.organizer);
		}

		case "certification": {
			const value = source as CurrentProfile["certifications"][number];
			return firstText(value.description, value.name, value.issuingOrganization);
		}

		case "volunteer": {
			const value = source as CurrentProfile["volunteer"][number];
			return firstText(value.description, value.role, value.organization);
		}

		case "language": {
			const value = source as CurrentProfile["languages"][number];
			const parts = [value.language, value.level]
				.filter((part): part is string => typeof part === "string" && part.trim().length > 0)
				.map((part) => part.trim());

			return parts.length > 0 ? parts.join(" — ") : null;
		}

		case "award": {
			const value = source as CurrentProfile["awards"][number];
			return firstText(value.description, value.name, value.organizer);
		}

		case "reference": {
			const value = source as CurrentProfile["references"][number];
			return firstText(value.description, value.name, value.issuer);
		}

		case "license": {
			const value = source as CurrentProfile["licenses"][number];
			return firstText(value.description, value.name);
		}

		case "profile_list_item":
			return firstText((source as CurrentProfile["listItems"][number]).value);

		case "clause":
			return firstText((source as CurrentProfile["clauses"][number]).content);

		case "profile_photo": {
			const value = source as CurrentProfile["photos"][number];
			return firstText(value.label, value.filename);
		}

		case "custom_section_item": {
			const value = source as CurrentProfile["customSectionItems"][number];
			return firstText(value.description, value.title, value.subtitle);
		}
	}
}

async function resolveSelectionSource(
	build: Awaited<ReturnType<typeof requireOwnedBuild>>,
	userId: string,
	sourceType: CvmateSelectionSourceType,
	sourceId: string,
) {
	const profile = await getBuildProfile(build, userId);
	const source = findSelectionSource(profile, sourceType, sourceId);

	if (!source) {
		throw new ORPCError("NOT_FOUND", {
			message: "The selected Master Profile source does not exist.",
		});
	}

	return {
		profile,
		sourceTextSnapshot: getSelectionSourceText(sourceType, source),
		sourceDataSnapshot: structuredClone(source) as Record<string, unknown>,
	};
}

async function requireParentSelectionItem(parentSelectionItemId: string, cvBuildId: string, userId: string) {
	const { selectionItem } = await requireOwnedSelectionItem(parentSelectionItemId, userId);

	if (selectionItem.cvBuildId !== cvBuildId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Parent selection item must belong to the same CV build.",
		});
	}

	return selectionItem;
}

function validateEmploymentFactParent(
	profile: CurrentProfile,
	sourceType: CvmateSelectionSourceType,
	sourceId: string,
	parentSelectionItem: Awaited<ReturnType<typeof requireParentSelectionItem>> | null,
) {
	if (sourceType !== "experience_fact" || !parentSelectionItem || parentSelectionItem.sourceType !== "employment") {
		return;
	}

	const linked = profile.employmentFacts.some(
		(link) => link.employmentId === parentSelectionItem.sourceId && link.experienceFactId === sourceId,
	);

	if (!linked) {
		throw new ORPCError("BAD_REQUEST", {
			message: "The experience fact is not linked to the selected employment in the Master Profile.",
		});
	}
}

async function validateSelectionParentUpdate(
	selectionItem: Awaited<ReturnType<typeof requireOwnedSelectionItem>>["selectionItem"],
	parentSelectionItemId: string | null,
	userId: string,
) {
	if (parentSelectionItemId === null) return null;

	if (parentSelectionItemId === selectionItem.id) {
		throw new ORPCError("BAD_REQUEST", {
			message: "A selection item cannot be its own parent.",
		});
	}

	let current = await requireParentSelectionItem(parentSelectionItemId, selectionItem.cvBuildId, userId);

	const visited = new Set<string>();

	while (current) {
		if (current.id === selectionItem.id) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Selection item parent hierarchy cannot contain a cycle.",
			});
		}

		if (visited.has(current.id)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Selection item parent hierarchy contains a cycle.",
			});
		}

		visited.add(current.id);

		if (!current.parentSelectionItemId) break;

		current = await requireParentSelectionItem(current.parentSelectionItemId, selectionItem.cvBuildId, userId);
	}

	return requireParentSelectionItem(parentSelectionItemId, selectionItem.cvBuildId, userId);
}

export const cvmateBuildService = {
	list: async (input: { userId: string }) => {
		const rows = await db
			.select()
			.from(schema.cvmateCvBuild)
			.where(eq(schema.cvmateCvBuild.userId, input.userId))
			.orderBy(desc(schema.cvmateCvBuild.updatedAt));

		return rows.map(stripUserId);
	},

	getById: async (input: { id: string; userId: string }) => {
		const build = await requireOwnedBuild(input.id, input.userId);
		return stripUserId(build);
	},

	create: async (input: BuildCreateFields & { userId: string }) => {
		const profile = await cvmateProfileService.getCurrent({
			userId: input.userId,
		});

		if (!profile) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Create a Master Profile before starting a CV build.",
			});
		}

		const id = generateId();
		const jobOfferId = input.jobOfferId ?? null;
		const jobOfferSnapshot = jobOfferId === null ? null : await getJobOfferSnapshot(jobOfferId, input.userId);

		await db.insert(schema.cvmateCvBuild).values({
			id,
			userId: input.userId,
			masterProfileId: profile.profile.id,
			jobOfferId,
			jobOfferSnapshot,
			targetLanguage: input.targetLanguage ?? null,
			designSettings: input.designSettings ?? null,
		});

		return id;
	},

	update: async (
		input: BuildUpdateFields & {
			id: string;
			userId: string;
		},
	) => {
		const build = await requireOwnedBuild(input.id, input.userId);
		const { id, userId, ...fields } = input;

		if (Object.keys(fields).length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Provide at least one CV build field to update.",
			});
		}

		const nextCurrentStep = fields.currentStep ?? build.currentStep;
		const nextStatus = fields.status ?? build.status;

		validateCompletionState(nextCurrentStep, nextStatus);

		const updates: {
			jobOfferId?: string | null;
			currentStep?: CvmateBuildStep;
			status?: CvmateBuildStatus;
			targetLanguage?: string | null;
			designSettings?: Record<string, unknown> | null;
			jobOfferSnapshot?: Record<string, unknown> | null;
			completedAt?: Date | null;
		} = {};

		if (fields.jobOfferId !== undefined) {
			updates.jobOfferId = fields.jobOfferId;
			updates.jobOfferSnapshot =
				fields.jobOfferId === null ? null : await getJobOfferSnapshot(fields.jobOfferId, userId);
		}

		if (fields.currentStep !== undefined) {
			updates.currentStep = fields.currentStep;
		}

		if (fields.status !== undefined) {
			updates.status = fields.status;
		}

		if (fields.targetLanguage !== undefined) {
			updates.targetLanguage = fields.targetLanguage;
		}

		if (fields.designSettings !== undefined) {
			updates.designSettings = fields.designSettings;
		}

		if (nextStatus === "completed") {
			updates.completedAt = build.completedAt ?? new Date();
		} else if (build.completedAt !== null) {
			updates.completedAt = null;
		}

		const [updated] = await db
			.update(schema.cvmateCvBuild)
			.set(updates)
			.where(and(eq(schema.cvmateCvBuild.id, id), eq(schema.cvmateCvBuild.userId, userId)))
			.returning();

		if (!updated) throw new ORPCError("NOT_FOUND");

		return stripUserId(updated);
	},

	delete: async (input: { id: string; userId: string }) => {
		await requireOwnedBuild(input.id, input.userId);

		const rows = await db
			.delete(schema.cvmateCvBuild)
			.where(and(eq(schema.cvmateCvBuild.id, input.id), eq(schema.cvmateCvBuild.userId, input.userId)))
			.returning({ id: schema.cvmateCvBuild.id });

		if (rows.length === 0) throw new ORPCError("NOT_FOUND");
	},

	listSelectionItems: async (input: { cvBuildId: string; userId: string }) => {
		const build = await requireOwnedBuild(input.cvBuildId, input.userId);

		return db
			.select()
			.from(schema.cvmateCvSelectionItem)
			.where(eq(schema.cvmateCvSelectionItem.cvBuildId, build.id))
			.orderBy(asc(schema.cvmateCvSelectionItem.sortOrder), asc(schema.cvmateCvSelectionItem.createdAt));
	},

	createSelectionItem: async (
		input: SelectionItemCreateFields & {
			cvBuildId: string;
			userId: string;
		},
	) => {
		const build = await requireOwnedBuild(input.cvBuildId, input.userId);

		const { profile, sourceTextSnapshot, sourceDataSnapshot } = await resolveSelectionSource(
			build,
			input.userId,
			input.sourceType,
			input.sourceId,
		);

		const parentSelectionItem = input.parentSelectionItemId
			? await requireParentSelectionItem(input.parentSelectionItemId, build.id, input.userId)
			: null;

		validateEmploymentFactParent(profile, input.sourceType, input.sourceId, parentSelectionItem);

		const [selectionItem] = await db
			.insert(schema.cvmateCvSelectionItem)
			.values({
				id: generateId(),
				cvBuildId: build.id,
				parentSelectionItemId: input.parentSelectionItemId ?? null,
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				sourceTextSnapshot,
				sourceDataSnapshot,
				selected: input.selected ?? false,
				sortOrder: input.sortOrder ?? 0,
			})
			.returning();

		if (!selectionItem) {
			throw new Error("CVMATE_CV_SELECTION_ITEM_CREATE_FAILED");
		}

		return selectionItem;
	},

	updateSelectionItem: async (
		input: SelectionItemUpdateFields & {
			id: string;
			userId: string;
		},
	) => {
		const { selectionItem, build } = await requireOwnedSelectionItem(input.id, input.userId);

		const { id, userId, ...fields } = input;

		if (Object.keys(fields).length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Provide at least one selection item field to update.",
			});
		}

		if (fields.parentSelectionItemId !== undefined) {
			const parentSelectionItem = await validateSelectionParentUpdate(
				selectionItem,
				fields.parentSelectionItemId,
				userId,
			);

			if (selectionItem.sourceType === "experience_fact" && parentSelectionItem?.sourceType === "employment") {
				const profile = await getBuildProfile(build, userId);

				validateEmploymentFactParent(profile, selectionItem.sourceType, selectionItem.sourceId, parentSelectionItem);
			}
		}

		const [updated] = await db
			.update(schema.cvmateCvSelectionItem)
			.set(fields)
			.where(
				and(
					eq(schema.cvmateCvSelectionItem.id, id),
					eq(schema.cvmateCvSelectionItem.cvBuildId, selectionItem.cvBuildId),
				),
			)
			.returning();

		if (!updated) throw new ORPCError("NOT_FOUND");

		return updated;
	},

	deleteSelectionItem: async (input: { id: string; userId: string }) => {
		const { selectionItem } = await requireOwnedSelectionItem(input.id, input.userId);

		const rows = await db
			.delete(schema.cvmateCvSelectionItem)
			.where(
				and(
					eq(schema.cvmateCvSelectionItem.id, input.id),
					eq(schema.cvmateCvSelectionItem.cvBuildId, selectionItem.cvBuildId),
				),
			)
			.returning({ id: schema.cvmateCvSelectionItem.id });

		if (rows.length === 0) throw new ORPCError("NOT_FOUND");
	},
	listGaps: async (input: { cvBuildId: string; userId: string }) => {
		const build = await requireOwnedBuild(input.cvBuildId, input.userId);

		return db
			.select()
			.from(schema.cvmateCvGap)
			.where(eq(schema.cvmateCvGap.cvBuildId, build.id))
			.orderBy(asc(schema.cvmateCvGap.sortOrder), asc(schema.cvmateCvGap.createdAt));
	},

	createGap: async (
		input: GapCreateFields & {
			cvBuildId: string;
			userId: string;
		},
	) => {
		const build = await requireOwnedBuild(input.cvBuildId, input.userId);

		const [gap] = await db
			.insert(schema.cvmateCvGap)
			.values({
				id: generateId(),
				cvBuildId: build.id,
				jobRequirementId: null,
				requirementTextSnapshot: null,
				text: input.text,
				severity: input.severity ?? "additional",
				origin: "user",
				status: "open",
				resolutionSourceType: null,
				resolutionSourceId: null,
				resolutionTextSnapshot: null,
				sortOrder: input.sortOrder ?? 0,
				resolvedAt: null,
			})
			.returning();

		if (!gap) {
			throw new Error("CVMATE_CV_GAP_CREATE_FAILED");
		}

		return gap;
	},

	updateGap: async (
		input: GapUpdateFields & {
			id: string;
			userId: string;
		},
	) => {
		const { gap } = await requireOwnedGap(input.id, input.userId);
		const { id, userId, ...fields } = input;

		if (Object.keys(fields).length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Provide at least one CV gap field to update.",
			});
		}

		const updates: {
			text?: string;
			severity?: CvmateRequirementPriority;
			status?: CvmateGapStatus;
			resolutionSourceType?: CvmateSelectionSourceType | null;
			resolutionSourceId?: string | null;
			resolutionTextSnapshot?: string | null;
			sortOrder?: number;
			resolvedAt?: Date | null;
		} = {};

		if (fields.text !== undefined) updates.text = fields.text;
		if (fields.severity !== undefined) updates.severity = fields.severity;
		if (fields.sortOrder !== undefined) updates.sortOrder = fields.sortOrder;

		let nextStatus = fields.status ?? gap.status;

		const resolutionSourceProvided =
			fields.resolutionSourceType !== undefined || fields.resolutionSourceId !== undefined;

		if (resolutionSourceProvided) {
			const sourceType = fields.resolutionSourceType;
			const sourceId = fields.resolutionSourceId;

			if (sourceType === null && sourceId === null) {
				updates.resolutionSourceType = null;
				updates.resolutionSourceId = null;
				updates.resolutionTextSnapshot = null;
			} else if (typeof sourceType === "string" && typeof sourceId === "string") {
				if (fields.status !== undefined && fields.status !== "resolved") {
					throw new ORPCError("BAD_REQUEST", {
						message: "A gap with a resolution source must have resolved status.",
					});
				}

				const resolutionTextSnapshot = await resolveGapResolutionSource(gap.cvBuildId, sourceType, sourceId);

				updates.resolutionSourceType = sourceType;
				updates.resolutionSourceId = sourceId;
				updates.resolutionTextSnapshot = resolutionTextSnapshot;

				if (fields.status === undefined) {
					nextStatus = "resolved";
					updates.status = "resolved";
				}
			} else {
				throw new ORPCError("BAD_REQUEST", {
					message: "Resolution source type and ID must be provided together or cleared together.",
				});
			}
		}

		if (fields.status !== undefined) {
			updates.status = fields.status;
		}

		if (nextStatus === "resolved") {
			updates.resolvedAt = gap.resolvedAt ?? new Date();
		} else {
			updates.resolvedAt = null;
			updates.resolutionSourceType = null;
			updates.resolutionSourceId = null;
			updates.resolutionTextSnapshot = null;
		}

		const [updated] = await db
			.update(schema.cvmateCvGap)
			.set(updates)
			.where(and(eq(schema.cvmateCvGap.id, id), eq(schema.cvmateCvGap.cvBuildId, gap.cvBuildId)))
			.returning();

		if (!updated) throw new ORPCError("NOT_FOUND");

		return updated;
	},

	deleteGap: async (input: { id: string; userId: string }) => {
		const { gap } = await requireOwnedGap(input.id, input.userId);

		const rows = await db
			.delete(schema.cvmateCvGap)
			.where(and(eq(schema.cvmateCvGap.id, input.id), eq(schema.cvmateCvGap.cvBuildId, gap.cvBuildId)))
			.returning({ id: schema.cvmateCvGap.id });

		if (rows.length === 0) throw new ORPCError("NOT_FOUND");
	},
};
