import z from "zod";
import { resumeDataSchema } from "@reactive-resume/schema/resume/data";
import { templateSchema } from "@reactive-resume/schema/templates";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must use #RRGGBB format.");

export const cvmateBuildDesignSettingsSchema = z.object({
	template: templateSchema,
	primaryColor: hexColorSchema,
	textColor: hexColorSchema,
	backgroundColor: hexColorSchema,
});

export type CvmateBuildDesignSettings = z.infer<typeof cvmateBuildDesignSettingsSchema>;

export const cvmateBuildPageMetricsSchema = z.object({
	actualPageCount: z.number().int().positive(),
	lastPageTextUtilization: z.number().min(0).max(1),
});

export type CvmateBuildPageMetrics = z.infer<typeof cvmateBuildPageMetricsSchema>;

export const cvmateBuildQualityGateStatusSchema = z.enum(["pass", "warning", "blocked"]);
export const cvmateBuildQualityGateFindingSeveritySchema = z.enum(["warning", "blocking"]);
export const cvmateBuildQualityGateFindingDimensionSchema = z.enum([
	"coverage",
	"grammar",
	"dedup",
	"achievements_numbers",
	"master_ats",
	"density",
]);
export const cvmateBuildQualityGateDimensionStatusSchema = z.enum(["pass", "warning", "blocked"]);

export const cvmateBuildQualityGateFindingSchema = z.object({
	code: z.string().trim().min(1),
	dimension: cvmateBuildQualityGateFindingDimensionSchema,
	severity: cvmateBuildQualityGateFindingSeveritySchema,
	message: z.string().trim().min(1),
	selectionItemId: z.string().trim().min(1).optional(),
	resumeItemId: z.string().trim().min(1).optional(),
	path: z.string().trim().min(1).optional(),
});

export const cvmateBuildQualityGateSchema = z.object({
	status: cvmateBuildQualityGateStatusSchema,
	findings: z.array(cvmateBuildQualityGateFindingSchema),
	dimensions: z.object({
		coverage: cvmateBuildQualityGateDimensionStatusSchema,
		grammar: cvmateBuildQualityGateDimensionStatusSchema,
		dedup: cvmateBuildQualityGateDimensionStatusSchema,
		achievementsNumbers: cvmateBuildQualityGateDimensionStatusSchema,
		masterAts: cvmateBuildQualityGateDimensionStatusSchema,
		density: cvmateBuildQualityGateDimensionStatusSchema,
	}),
});

export type CvmateBuildQualityGate = z.infer<typeof cvmateBuildQualityGateSchema>;
export const cvmateBuildMaterializeDto = {
	preview: {
		input: z.object({
			id: z.string().trim().min(1),
		}),
		output: z.object({
			data: resumeDataSchema,
			designSettings: cvmateBuildDesignSettingsSchema,
			pageMetrics: cvmateBuildPageMetricsSchema,
			qualityGate: cvmateBuildQualityGateSchema,
			usesRecommendation: z.boolean(),
		}),
	},
	materialize: {
		input: z.object({
			id: z.string().trim().min(1),
		}),
		output: z.object({
			documentId: z.string(),
			resumeId: z.string(),
			created: z.boolean(),
		}),
	},
};
