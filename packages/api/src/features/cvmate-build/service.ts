import { ORPCError } from "@orpc/client";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import { type CvmateBuildStatus, type CvmateBuildStep } from "@reactive-resume/db/schema";
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
};
