import { describe, expect, it } from "vitest";
import { compactSourceDataForAi } from "./ai-source-data";

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
});
