import { createSelectSchema } from "drizzle-zod";
import z from "zod";
import * as schema from "@reactive-resume/db/schema";

const MAX_JOB_OFFER_ASSET_BYTES = 10 * 1024 * 1024;

const cvmateJobOfferAnalysisStatusSchema = z.enum(["pending", "analyzed", "failed"]);
const cvmateJobRequirementCategorySchema = z.enum(["required", "preferred", "responsibility", "keyword", "other"]);
const cvmateRequirementPrioritySchema = z.enum(["critical", "important", "additional"]);

const httpUrlSchema = z
	.string()
	.trim()
	.pipe(z.url({ protocol: /^https?$/, error: "URL must use http or https." }));

const nullableTrimmedStringSchema = z.string().trim().min(1).nullable();

const jobOfferSchema = createSelectSchema(schema.cvmateJobOffer, {
	id: z.string(),
	userId: z.string(),
	sourceUrl: httpUrlSchema.nullable(),
	rawText: z.string().nullable(),
	roleTitle: z.string().nullable(),
	companyName: z.string().nullable(),
	location: z.string().nullable(),
	language: z.string().nullable(),
	analysisStatus: cvmateJobOfferAnalysisStatusSchema,
	analyzedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const jobOfferAssetSchema = createSelectSchema(schema.cvmateJobOfferAsset, {
	id: z.string(),
	jobOfferId: z.string(),
	storageKey: z.string(),
	filename: z.string(),
	mediaType: z.string(),
	size: z.number().int().nonnegative(),
	width: z.number().int().positive().nullable(),
	height: z.number().int().positive().nullable(),
	sortOrder: z.number().int(),
	createdAt: z.date(),
});

const jobRequirementSchema = createSelectSchema(schema.cvmateJobRequirement, {
	id: z.string(),
	jobOfferId: z.string(),
	category: cvmateJobRequirementCategorySchema,
	priority: cvmateRequirementPrioritySchema,
	sourceText: z.string().nullable(),
	text: z.string().trim().min(1),
	isUserEdited: z.boolean(),
	sortOrder: z.number().int(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const jobOfferEditableSchema = z.object({
	sourceUrl: httpUrlSchema.nullable().optional(),
	rawText: z.string().trim().min(1).nullable().optional(),
	roleTitle: nullableTrimmedStringSchema.optional(),
	companyName: nullableTrimmedStringSchema.optional(),
	location: nullableTrimmedStringSchema.optional(),
	language: nullableTrimmedStringSchema.optional(),
});

const updateJobOfferSchema = jobOfferEditableSchema
	.extend({
		id: z.string(),
	})
	.refine(
		(value) =>
			value.sourceUrl !== undefined ||
			value.rawText !== undefined ||
			value.roleTitle !== undefined ||
			value.companyName !== undefined ||
			value.location !== undefined ||
			value.language !== undefined,
		"Provide at least one job offer field to update.",
	);

const jobOfferAssetFileSchema = z
	.file()
	.max(MAX_JOB_OFFER_ASSET_BYTES, "File size must be less than 10MB")
	.mime(
		["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"],
		"Job offer assets must be PDF, JPEG, PNG, WebP, or GIF files.",
	);

const createRequirementSchema = z.object({
	jobOfferId: z.string(),
	category: cvmateJobRequirementCategorySchema.optional(),
	priority: cvmateRequirementPrioritySchema.optional(),
	sourceText: nullableTrimmedStringSchema.optional(),
	text: z.string().trim().min(1),
	sortOrder: z.number().int().optional(),
});

const updateRequirementSchema = z
	.object({
		id: z.string(),
		category: cvmateJobRequirementCategorySchema.optional(),
		priority: cvmateRequirementPrioritySchema.optional(),
		sourceText: nullableTrimmedStringSchema.optional(),
		text: z.string().trim().min(1).optional(),
		sortOrder: z.number().int().optional(),
	})
	.refine(
		(value) =>
			value.category !== undefined ||
			value.priority !== undefined ||
			value.sourceText !== undefined ||
			value.text !== undefined ||
			value.sortOrder !== undefined,
		"Provide at least one requirement field to update.",
	);

const jobOfferDetailSchema = jobOfferSchema.omit({ userId: true }).extend({
	assets: z.array(jobOfferAssetSchema),
	requirements: z.array(jobRequirementSchema),
});

export const cvmateJobOfferDto = {
	list: {
		input: z.object({}).optional().default({}),
		output: z.array(jobOfferSchema.omit({ userId: true })),
	},

	getById: {
		input: z.object({ id: z.string() }),
		output: jobOfferDetailSchema,
	},

	create: {
		input: jobOfferEditableSchema,
		output: z.string().describe("The ID of the created CVMate job offer."),
	},

	update: {
		input: updateJobOfferSchema,
		output: jobOfferDetailSchema,
	},

	delete: {
		input: z.object({ id: z.string() }),
		output: z.void(),
	},

	uploadAsset: {
		input: z.object({
			jobOfferId: z.string(),
			file: jobOfferAssetFileSchema,
			sortOrder: z.number().int().optional(),
		}),
		output: jobOfferAssetSchema,
	},

	updateAsset: {
		input: z.object({
			id: z.string(),
			sortOrder: z.number().int(),
		}),
		output: jobOfferAssetSchema,
	},

	deleteAsset: {
		input: z.object({ id: z.string() }),
		output: z.void(),
	},

	createRequirement: {
		input: createRequirementSchema,
		output: jobRequirementSchema,
	},

	updateRequirement: {
		input: updateRequirementSchema,
		output: jobRequirementSchema,
	},

	deleteRequirement: {
		input: z.object({ id: z.string() }),
		output: z.void(),
	},
};

export {
	cvmateJobOfferAnalysisStatusSchema,
	cvmateJobRequirementCategorySchema,
	cvmateRequirementPrioritySchema,
	jobOfferAssetSchema as cvmateJobOfferAssetSchema,
	jobOfferDetailSchema as cvmateJobOfferDetailSchema,
	jobOfferSchema as cvmateJobOfferSchema,
	jobRequirementSchema as cvmateJobRequirementSchema,
};
