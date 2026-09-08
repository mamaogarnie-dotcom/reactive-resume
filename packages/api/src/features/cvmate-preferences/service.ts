import { eq } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";

type CvmateTheme = "light" | "pastel" | "dark" | "contrast";

export const cvmatePreferencesService = {
	getCurrent: async (input: { userId: string }) => {
		const [preferences] = await db
			.select()
			.from(schema.cvmatePreferences)
			.where(eq(schema.cvmatePreferences.userId, input.userId));

		return preferences ?? null;
	},

	update: async (input: {
		userId: string;
		theme?: CvmateTheme | undefined;
		settings?: Record<string, unknown> | undefined;
	}) => {
		const { userId, ...fields } = input;

		const insertValues = {
			userId,
			...(fields.theme !== undefined ? { theme: fields.theme } : {}),
			...(fields.settings !== undefined ? { settings: fields.settings } : {}),
		};

		const updateValues = {
			...(fields.theme !== undefined ? { theme: fields.theme } : {}),
			...(fields.settings !== undefined ? { settings: fields.settings } : {}),
		};

		const [preferences] = await db
			.insert(schema.cvmatePreferences)
			.values(insertValues)
			.onConflictDoUpdate({
				target: schema.cvmatePreferences.userId,
				set: updateValues,
			})
			.returning();

		if (!preferences) {
			throw new Error("CVMATE_PREFERENCES_UPSERT_FAILED");
		}

		return preferences;
	},
};
