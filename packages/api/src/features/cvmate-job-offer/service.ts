import type { CvmateJobRequirementCategory, CvmateRequirementPriority } from "@reactive-resume/db/schema";
import { ORPCError } from "@orpc/client";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { generateId } from "@reactive-resume/utils/string";
import {
	getStorageService,
	hasPdfSignature,
	inspectImageUpload,
	MAX_UPLOAD_BYTES,
	uploadFile,
} from "../storage/service";

const ALLOWED_ASSET_MEDIA_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);

type JobOfferEditableFields = {
	sourceUrl?: string | null | undefined;
	rawText?: string | null | undefined;
	roleTitle?: string | null | undefined;
	companyName?: string | null | undefined;
	location?: string | null | undefined;
	language?: string | null | undefined;
};

type RequirementEditableFields = {
	category?: CvmateJobRequirementCategory | undefined;
	priority?: CvmateRequirementPriority | undefined;
	sourceText?: string | null | undefined;
	text?: string | undefined;
	sortOrder?: number | undefined;
};

const stripUserId = <T extends { userId: string }>(row: T) => {
	const { userId: _userId, ...rest } = row;
	return rest;
};

async function requireOwnedOffer(id: string, userId: string) {
	const [offer] = await db
		.select()
		.from(schema.cvmateJobOffer)
		.where(and(eq(schema.cvmateJobOffer.id, id), eq(schema.cvmateJobOffer.userId, userId)));

	if (!offer) throw new ORPCError("NOT_FOUND");

	return offer;
}

async function requireOwnedAsset(id: string, userId: string) {
	const [asset] = await db.select().from(schema.cvmateJobOfferAsset).where(eq(schema.cvmateJobOfferAsset.id, id));

	if (!asset) throw new ORPCError("NOT_FOUND");

	const offer = await requireOwnedOffer(asset.jobOfferId, userId);

	return { asset, offer };
}

async function requireOwnedRequirement(id: string, userId: string) {
	const [requirement] = await db
		.select()
		.from(schema.cvmateJobRequirement)
		.where(eq(schema.cvmateJobRequirement.id, id));

	if (!requirement) throw new ORPCError("NOT_FOUND");

	const offer = await requireOwnedOffer(requirement.jobOfferId, userId);

	return { requirement, offer };
}

async function getOfferDetail(id: string, userId: string) {
	const offer = await requireOwnedOffer(id, userId);

	const [assets, requirements] = await Promise.all([
		db
			.select()
			.from(schema.cvmateJobOfferAsset)
			.where(eq(schema.cvmateJobOfferAsset.jobOfferId, offer.id))
			.orderBy(asc(schema.cvmateJobOfferAsset.sortOrder), asc(schema.cvmateJobOfferAsset.createdAt)),
		db
			.select()
			.from(schema.cvmateJobRequirement)
			.where(eq(schema.cvmateJobRequirement.jobOfferId, offer.id))
			.orderBy(asc(schema.cvmateJobRequirement.sortOrder), asc(schema.cvmateJobRequirement.createdAt)),
	]);

	return {
		...stripUserId(offer),
		assets,
		requirements,
	};
}

export const cvmateJobOfferService = {
	list: async (input: { userId: string }) => {
		const rows = await db
			.select()
			.from(schema.cvmateJobOffer)
			.where(eq(schema.cvmateJobOffer.userId, input.userId))
			.orderBy(desc(schema.cvmateJobOffer.updatedAt));

		return rows.map(stripUserId);
	},

	getById: (input: { id: string; userId: string }) => getOfferDetail(input.id, input.userId),

	create: async (input: JobOfferEditableFields & { userId: string }) => {
		const { userId, ...fields } = input;
		const id = generateId();

		await db.insert(schema.cvmateJobOffer).values({
			id,
			userId,
			...fields,
		});

		return id;
	},

	update: async (input: JobOfferEditableFields & { id: string; userId: string }) => {
		await requireOwnedOffer(input.id, input.userId);

		const { id, userId, ...fields } = input;

		if (Object.keys(fields).length === 0) {
			throw new ORPCError("BAD_REQUEST", { message: "Provide at least one job offer field to update." });
		}

		const sourceChanged = fields.sourceUrl !== undefined || fields.rawText !== undefined;

		const [updated] = await db
			.update(schema.cvmateJobOffer)
			.set({
				...fields,
				...(sourceChanged
					? {
							analysisStatus: "pending" as const,
							analyzedAt: null,
						}
					: {}),
			})
			.where(and(eq(schema.cvmateJobOffer.id, id), eq(schema.cvmateJobOffer.userId, userId)))
			.returning({ id: schema.cvmateJobOffer.id });

		if (!updated) throw new ORPCError("NOT_FOUND");

		return getOfferDetail(updated.id, userId);
	},

	delete: async (input: { id: string; userId: string }) => {
		const offer = await requireOwnedOffer(input.id, input.userId);

		const assets = await db
			.select({ storageKey: schema.cvmateJobOfferAsset.storageKey })
			.from(schema.cvmateJobOfferAsset)
			.where(eq(schema.cvmateJobOfferAsset.jobOfferId, offer.id));

		const rows = await db
			.delete(schema.cvmateJobOffer)
			.where(and(eq(schema.cvmateJobOffer.id, input.id), eq(schema.cvmateJobOffer.userId, input.userId)))
			.returning({ id: schema.cvmateJobOffer.id });

		if (rows.length === 0) throw new ORPCError("NOT_FOUND");

		const storage = getStorageService();
		await Promise.allSettled(assets.map((asset) => storage.delete(asset.storageKey)));
	},

	uploadAsset: async (input: { jobOfferId: string; userId: string; file: File; sortOrder?: number | undefined }) => {
		await requireOwnedOffer(input.jobOfferId, input.userId);

		if (!ALLOWED_ASSET_MEDIA_TYPES.has(input.file.type)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Job offer assets must be PDF, JPEG, PNG, WebP, or GIF files.",
			});
		}

		if (input.file.size > MAX_UPLOAD_BYTES) {
			throw new ORPCError("BAD_REQUEST", { message: "File size must be less than 10MB." });
		}

		const data = new Uint8Array(await input.file.arrayBuffer());
		const mediaType = input.file.type;

		let width: number | null = null;
		let height: number | null = null;

		if (mediaType.startsWith("image/")) {
			try {
				const metadata = await inspectImageUpload(data, mediaType);
				width = metadata.width;
				height = metadata.height;
			} catch {
				throw new ORPCError("BAD_REQUEST", {
					message: "The uploaded image is invalid, corrupted, or does not match its declared type.",
				});
			}
		} else if (!hasPdfSignature(data)) {
			throw new ORPCError("BAD_REQUEST", { message: "The uploaded PDF is invalid or corrupted." });
		}

		const uploaded = await uploadFile({
			userId: input.userId,
			data,
			contentType: mediaType,
		});

		try {
			return await db.transaction(async (tx) => {
				const [asset] = await tx
					.insert(schema.cvmateJobOfferAsset)
					.values({
						id: generateId(),
						jobOfferId: input.jobOfferId,
						storageKey: uploaded.key,
						filename: input.file.name,
						mediaType,
						size: data.byteLength,
						width,
						height,
						sortOrder: input.sortOrder ?? 0,
					})
					.returning();

				if (!asset) {
					throw new Error("CVMATE_JOB_OFFER_ASSET_CREATE_FAILED");
				}

				const [updatedOffer] = await tx
					.update(schema.cvmateJobOffer)
					.set({
						analysisStatus: "pending",
						analyzedAt: null,
					})
					.where(and(eq(schema.cvmateJobOffer.id, input.jobOfferId), eq(schema.cvmateJobOffer.userId, input.userId)))
					.returning({ id: schema.cvmateJobOffer.id });

				if (!updatedOffer) throw new ORPCError("NOT_FOUND");

				return asset;
			});
		} catch (error) {
			await getStorageService()
				.delete(uploaded.key)
				.catch(() => false);
			throw error;
		}
	},

	updateAsset: async (input: { id: string; userId: string; sortOrder: number }) => {
		const { asset } = await requireOwnedAsset(input.id, input.userId);

		const [updated] = await db
			.update(schema.cvmateJobOfferAsset)
			.set({ sortOrder: input.sortOrder })
			.where(
				and(eq(schema.cvmateJobOfferAsset.id, input.id), eq(schema.cvmateJobOfferAsset.jobOfferId, asset.jobOfferId)),
			)
			.returning();

		if (!updated) throw new ORPCError("NOT_FOUND");

		return updated;
	},

	deleteAsset: async (input: { id: string; userId: string }) => {
		const { asset, offer } = await requireOwnedAsset(input.id, input.userId);

		await db.transaction(async (tx) => {
			const rows = await tx
				.delete(schema.cvmateJobOfferAsset)
				.where(
					and(eq(schema.cvmateJobOfferAsset.id, input.id), eq(schema.cvmateJobOfferAsset.jobOfferId, asset.jobOfferId)),
				)
				.returning({ id: schema.cvmateJobOfferAsset.id });

			if (rows.length === 0) throw new ORPCError("NOT_FOUND");

			const [updatedOffer] = await tx
				.update(schema.cvmateJobOffer)
				.set({
					analysisStatus: "pending",
					analyzedAt: null,
				})
				.where(and(eq(schema.cvmateJobOffer.id, offer.id), eq(schema.cvmateJobOffer.userId, input.userId)))
				.returning({ id: schema.cvmateJobOffer.id });

			if (!updatedOffer) throw new ORPCError("NOT_FOUND");
		});

		await getStorageService()
			.delete(asset.storageKey)
			.catch(() => false);
	},

	createRequirement: async (
		input: RequirementEditableFields & {
			jobOfferId: string;
			userId: string;
			text: string;
		},
	) => {
		await requireOwnedOffer(input.jobOfferId, input.userId);

		const { userId, ...fields } = input;

		const [requirement] = await db
			.insert(schema.cvmateJobRequirement)
			.values({
				id: generateId(),
				...fields,
				isUserEdited: true,
			})
			.returning();

		if (!requirement) {
			throw new Error("CVMATE_JOB_REQUIREMENT_CREATE_FAILED");
		}

		return requirement;
	},

	updateRequirement: async (
		input: RequirementEditableFields & {
			id: string;
			userId: string;
		},
	) => {
		const { requirement } = await requireOwnedRequirement(input.id, input.userId);
		const { id, userId, ...fields } = input;

		if (Object.keys(fields).length === 0) {
			throw new ORPCError("BAD_REQUEST", { message: "Provide at least one requirement field to update." });
		}

		const [updated] = await db
			.update(schema.cvmateJobRequirement)
			.set({
				...fields,
				isUserEdited: true,
			})
			.where(
				and(eq(schema.cvmateJobRequirement.id, id), eq(schema.cvmateJobRequirement.jobOfferId, requirement.jobOfferId)),
			)
			.returning();

		if (!updated) throw new ORPCError("NOT_FOUND");

		return updated;
	},

	deleteRequirement: async (input: { id: string; userId: string }) => {
		const { requirement } = await requireOwnedRequirement(input.id, input.userId);

		const rows = await db
			.delete(schema.cvmateJobRequirement)
			.where(
				and(
					eq(schema.cvmateJobRequirement.id, input.id),
					eq(schema.cvmateJobRequirement.jobOfferId, requirement.jobOfferId),
				),
			)
			.returning({ id: schema.cvmateJobRequirement.id });

		if (rows.length === 0) throw new ORPCError("NOT_FOUND");
	},
};
