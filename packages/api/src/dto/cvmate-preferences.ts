import { createSelectSchema } from "drizzle-zod";
import z from "zod";
import * as schema from "@reactive-resume/db/schema";

const cvmateThemeSchema = z.enum(["light", "pastel", "dark", "contrast"]);

const settingsSchema = z.record(z.string(), z.unknown());

const preferencesSchema = createSelectSchema(schema.cvmatePreferences, {
	id: z.string(),
	userId: z.string(),
	theme: cvmateThemeSchema,
	settings: settingsSchema,
	createdAt: z.date(),
	updatedAt: z.date(),
}).omit({ userId: true });

const updatePreferencesSchema = z
	.object({
		theme: cvmateThemeSchema.optional(),
		settings: settingsSchema.optional(),
	})
	.refine(
		(value) => value.theme !== undefined || value.settings !== undefined,
		"Provide at least one preference to update.",
	);

export const cvmatePreferencesDto = {
	getCurrent: {
		input: z.void(),
		output: preferencesSchema.nullable(),
	},
	update: {
		input: updatePreferencesSchema,
		output: preferencesSchema,
	},
};

export { cvmateThemeSchema, preferencesSchema as cvmatePreferencesSchema };
