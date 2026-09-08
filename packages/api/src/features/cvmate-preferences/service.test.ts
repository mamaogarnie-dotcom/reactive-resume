import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
}));

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

const { cvmatePreferencesService } = await import("./service");

const preferences = {
	id: "preferences-1",
	userId: "user-1",
	theme: "light" as const,
	settings: {},
	createdAt: new Date("2026-09-08T10:00:00.000Z"),
	updatedAt: new Date("2026-09-08T10:00:00.000Z"),
};

const mockSelectRows = (rows: unknown[]) => {
	const where = vi.fn(() => Promise.resolve(rows));
	const from = vi.fn(() => ({ where }));

	dbMock.select.mockReturnValue({ from });

	return { from, where };
};

const mockUpsertReturning = (rows: unknown[]) => {
	const returning = vi.fn(() => Promise.resolve(rows));
	const onConflictDoUpdate = vi.fn(() => ({ returning }));
	const values = vi.fn(() => ({ onConflictDoUpdate }));

	dbMock.insert.mockReturnValue({ values });

	return { values, onConflictDoUpdate, returning };
};

beforeEach(() => {
	dbMock.select.mockReset();
	dbMock.insert.mockReset();
});

describe("cvmatePreferencesService", () => {
	it("returns the current user's saved preferences", async () => {
		mockSelectRows([{ ...preferences }]);

		const result = await cvmatePreferencesService.getCurrent({
			userId: "user-1",
		});

		expect(result).toEqual(preferences);
	});

	it("returns null when the user has no saved preferences", async () => {
		mockSelectRows([]);

		const result = await cvmatePreferencesService.getCurrent({
			userId: "user-1",
		});

		expect(result).toBeNull();
	});

	it("upserts only the theme when only theme is provided", async () => {
		const updated = {
			...preferences,
			theme: "dark" as const,
		};

		const { values, onConflictDoUpdate } = mockUpsertReturning([updated]);

		const result = await cvmatePreferencesService.update({
			userId: "user-1",
			theme: "dark",
		});

		expect(values).toHaveBeenCalledWith({
			userId: "user-1",
			theme: "dark",
		});

		expect(onConflictDoUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				target: expect.anything(),
				set: {
					theme: "dark",
				},
			}),
		);

		expect(result).toEqual(updated);
	});

	it("replaces settings with the provided settings object", async () => {
		const settings = {
			language: "pl",
			compactMode: true,
		};

		const updated = {
			...preferences,
			settings,
		};

		const { values, onConflictDoUpdate } = mockUpsertReturning([updated]);

		const result = await cvmatePreferencesService.update({
			userId: "user-1",
			settings,
		});

		expect(values).toHaveBeenCalledWith({
			userId: "user-1",
			settings,
		});

		expect(onConflictDoUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				target: expect.anything(),
				set: {
					settings,
				},
			}),
		);

		expect(result).toEqual(updated);
	});

	it("throws when the preferences upsert does not return a record", async () => {
		mockUpsertReturning([]);

		await expect(
			cvmatePreferencesService.update({
				userId: "user-1",
				theme: "contrast",
			}),
		).rejects.toThrow("CVMATE_PREFERENCES_UPSERT_FAILED");
	});
});
