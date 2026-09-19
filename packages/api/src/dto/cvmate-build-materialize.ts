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

export const cvmateBuildMaterializeDto = {
	preview: {
		input: z.object({
			id: z.string().trim().min(1),
		}),
		output: z.object({
			data: resumeDataSchema,
			designSettings: cvmateBuildDesignSettingsSchema,
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
