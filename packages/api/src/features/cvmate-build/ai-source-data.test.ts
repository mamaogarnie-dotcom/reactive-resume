import { describe, expect, it } from "vitest";
import {
	AI_ALLOWED_SELECTION_SOURCE_TYPES,
	compactSourceDataForAi,
	isAiAllowedSelectionSourceType,
} from "./ai-source-data";

describe("isAiAllowedSelectionSourceType", () => {
	it("allows professional source types", () => {
		for (const sourceType of ["employment", "experience_fact", "project", "education", "custom_section_item"]) {
			expect(isAiAllowedSelectionSourceType(sourceType)).toBe(true);
		}
	});

	it("never allows photos or references", () => {
		expect(isAiAllowedSelectionSourceType("profile_photo")).toBe(false);
		expect(isAiAllowedSelectionSourceType("reference")).toBe(false);
		expect(AI_ALLOWED_SELECTION_SOURCE_TYPES.has("profile_photo")).toBe(false);
		expect(AI_ALLOWED_SELECTION_SOURCE_TYPES.has("reference")).toBe(false);
	});

	it("fails closed for source types added in the future", () => {
		expect(isAiAllowedSelectionSourceType("future_source_type")).toBe(false);
		expect(isAiAllowedSelectionSourceType("")).toBe(false);
	});
});

describe("compactSourceDataForAi", () => {
	it("keeps professional fields", () => {
		expect(
			compactSourceDataForAi({ company: "Example Ltd", jobTitle: "Office Manager", text: "Prepared reports." }),
		).toEqual({
			company: "Example Ltd",
			jobTitle: "Office Manager",
			text: "Prepared reports.",
		});
	});

	it("drops identity, contact, file, technical and unknown future fields", () => {
		const result = compactSourceDataForAi({
			company: "Example Ltd",
			jobTitle: "Office Manager",
			firstName: "Jan",
			lastName: "Kowalski",
			email: "jan@example.test",
			phone: "+48 123 456 789",
			linkedinUrl: "https://linkedin.com/in/jan",
			filename: "Jan_Kowalski.jpg",
			storageKey: "uploads/user/pictures/x.jpg",
			id: "1",
			masterProfileId: "m",
			createdAt: "2026-01-01",
			futureField: "unreviewed",
		});
		expect(result).toEqual({ company: "Example Ltd", jobTitle: "Office Manager" });
	});

	it("drops objects and arrays under allowed keys and keeps simple values", () => {
		const result = compactSourceDataForAi({
			company: "Example Ltd",
			description: { storageKey: "uploads/user/x.pdf", id: "db-123" },
			content: ["Hidden", "values"],
			isCurrent: false,
			endDate: null,
			value: 3,
		});

		expect(result).toEqual({ company: "Example Ltd", isCurrent: false, endDate: null, value: 3 });
	});
});
