import { createSelectSchema } from "drizzle-zod";
import z from "zod";
import * as schema from "@reactive-resume/db/schema";

const cvmateBuildStepSchema = z.enum([
	"offer",
	"analysis",
	"selection",
	"gaps",
	"preview",
	"editor",
	"review",
	"completed",
]);

const cvmateBuildStatusSchema = z.enum(["active", "completed", "abandoned"]);

const cvmateSelectionSourceTypeSchema = z.enum([
	"employment",
	"experience_fact",
	"project",
	"education",
	"course",
	"certification",
	"volunteer",
	"language",
	"award",
	"reference",
	"license",
	"profile_list_item",
	"clause",
	"profile_photo",
	"custom_section_item",
]);

const jsonObjectSchema = z.record(z.string(), z.unknown());
const nullableTrimmedStringSchema = z.string().trim().min(1).nullable();

const cvmateBuildSchema = createSelectSchema(schema.cvmateCvBuild, {
	id: z.string(),
	userId: z.string(),
	masterProfileId: z.string().nullable(),
	jobOfferId: z.string().nullable(),
	currentStep: cvmateBuildStepSchema,
	status: cvmateBuildStatusSchema,
	targetLanguage: z.string().nullable(),
	jobOfferSnapshot: jsonObjectSchema.nullable(),
	designSettings: jsonObjectSchema.nullable(),
	completedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const cvmateSelectionItemSchema = createSelectSchema(schema.cvmateCvSelectionItem, {
	id: z.string(),
	cvBuildId: z.string(),
	parentSelectionItemId: z.string().nullable(),
	sourceType: cvmateSelectionSourceTypeSchema,
	sourceId: z.string(),
	sourceTextSnapshot: z.string().nullable(),
	sourceDataSnapshot: jsonObjectSchema,
	recommended: z.boolean(),
	selected: z.boolean(),
	recommendationReason: z.string().nullable(),
	sortOrder: z.number().int(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const createBuildSchema = z.object({
	jobOfferId: z.string().nullable().optional(),
	targetLanguage: nullableTrimmedStringSchema.optional(),
	designSettings: jsonObjectSchema.nullable().optional(),
});

const updateBuildSchema = z
	.object({
		id: z.string(),
		jobOfferId: z.string().nullable().optional(),
		currentStep: cvmateBuildStepSchema.optional(),
		status: cvmateBuildStatusSchema.optional(),
		targetLanguage: nullableTrimmedStringSchema.optional(),
		designSettings: jsonObjectSchema.nullable().optional(),
	})
	.refine(
		(value) =>
			value.jobOfferId !== undefined ||
			value.currentStep !== undefined ||
			value.status !== undefined ||
			value.targetLanguage !== undefined ||
			value.designSettings !== undefined,
		"Provide at least one CV build field to update.",
	);

const createSelectionItemSchema = z.object({
	cvBuildId: z.string(),
	parentSelectionItemId: z.string().trim().min(1).nullable().optional(),
	sourceType: cvmateSelectionSourceTypeSchema,
	sourceId: z.string().trim().min(1),
	selected: z.boolean().optional(),
	sortOrder: z.number().int().optional(),
});

const updateSelectionItemSchema = z
	.object({
		id: z.string(),
		parentSelectionItemId: z.string().trim().min(1).nullable().optional(),
		selected: z.boolean().optional(),
		sortOrder: z.number().int().optional(),
	})
	.refine(
		(value) =>
			value.parentSelectionItemId !== undefined || value.selected !== undefined || value.sortOrder !== undefined,
		"Provide at least one selection item field to update.",
	);

export const cvmateBuildDto = {
	list: {
		input: z.object({}).optional().default({}),
		output: z.array(cvmateBuildSchema.omit({ userId: true })),
	},

	getById: {
		input: z.object({ id: z.string() }),
		output: cvmateBuildSchema.omit({ userId: true }),
	},

	create: {
		input: createBuildSchema,
		output: z.string().describe("The ID of the created CVMate CV build."),
	},

	update: {
		input: updateBuildSchema,
		output: cvmateBuildSchema.omit({ userId: true }),
	},

	delete: {
		input: z.object({ id: z.string() }),
		output: z.void(),
	},

	listSelectionItems: {
		input: z.object({ cvBuildId: z.string() }),
		output: z.array(cvmateSelectionItemSchema),
	},

	createSelectionItem: {
		input: createSelectionItemSchema,
		output: cvmateSelectionItemSchema,
	},

	updateSelectionItem: {
		input: updateSelectionItemSchema,
		output: cvmateSelectionItemSchema,
	},

	deleteSelectionItem: {
		input: z.object({ id: z.string() }),
		output: z.void(),
	},
};

export {
	cvmateBuildSchema,
	cvmateBuildStatusSchema,
	cvmateBuildStepSchema,
	cvmateSelectionItemSchema,
	cvmateSelectionSourceTypeSchema,
};
