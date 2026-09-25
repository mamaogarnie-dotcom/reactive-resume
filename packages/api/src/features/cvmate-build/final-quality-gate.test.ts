import { describe, expect, it } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { evaluateFinalCvQuality } from "./final-quality-gate";

function createData() {
	const data = structuredClone(defaultResumeData);

	data.picture.hidden = true;
	data.picture.url = "";
	data.summary.content = "<p>Operations coordinator with measurable project experience.</p>";
	data.metadata.layout.pages = [
		{
			fullWidth: true,
			main: ["summary"],
			sidebar: [],
		},
	];

	return data;
}

const pageMetrics = {
	actualPageCount: 1,
	lastPageTextUtilization: 0.72,
};

describe("evaluateFinalCvQuality", () => {
	it("returns pass for a clean professional MASTER ATS CV", () => {
		const data = createData();

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [],
			generatedContent: [],
		});

		expect(result).toEqual({
			status: "pass",
			findings: [],
			dimensions: {
				coverage: "pass",
				grammar: "pass",
				dedup: "pass",
				achievementsNumbers: "pass",
				masterAts: "pass",
				density: "pass",
			},
		});
	});

	it("returns deterministic content warnings without mutating final ResumeData", () => {
		const data = createData();
		data.summary.content = "<p>Operations  coordinator!!</p>";
		const before = structuredClone(data);

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [],
			generatedContent: [],
		});

		expect(result.status).toBe("warning");
		expect(result.findings.map((finding) => finding.code)).toEqual(
			expect.arrayContaining(["REPEATED_WHITESPACE", "REPEATED_TERMINAL_PUNCTUATION"]),
		);
		expect(data).toEqual(before);
	});

	it("blocks a MASTER ATS structural violation", () => {
		const data = createData();
		data.picture.hidden = false;
		data.picture.url = "https://example.com/photo.jpg";
		data.metadata.layout.pages[0] = {
			fullWidth: false,
			main: ["summary", "summary"],
			sidebar: ["skills"],
		};

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [],
			generatedContent: [],
		});

		expect(result.status).toBe("blocked");
		expect(result.dimensions.masterAts).toBe("blocked");
		expect(result.findings.map((finding) => finding.code)).toEqual(
			expect.arrayContaining([
				"MASTER_ATS_PICTURE_VISIBLE",
				"MASTER_ATS_NOT_FULL_WIDTH",
				"MASTER_ATS_SIDEBAR_NOT_EMPTY",
				"MASTER_ATS_DUPLICATE_MAIN_SECTION",
			]),
		);
	});

	it("warns when a selected recommended item cannot be confirmed in final ResumeData", () => {
		const data = createData();

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "selection-missing",
					selected: true,
					recommended: true,
					sourceType: "project",
					sourceTextSnapshot: "Managed a directly relevant implementation.",
					parentSelectionItemId: null,
				},
			] as never,
			generatedContent: [],
		});

		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "RECOMMENDED_SELECTED_ITEM_NOT_RENDERED",
					selectionItemId: "selection-missing",
					severity: "warning",
				}),
			]),
		);
	});

	it("does not flag short common labels as duplicate narrative text", () => {
		const data = createData();
		data.summary.content = "<p>Excel</p>";
		data.customSections = [
			{
				id: "custom-short",
				type: "summary",
				title: "Tools",
				icon: "",
				hidden: false,
				columns: 1,
				items: [
					{
						id: "short-item",
						hidden: false,
						content: "<p>Excel</p>",
					},
				],
			},
		] as never;

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [],
			generatedContent: [],
		});

		expect(result.findings.some((finding) => finding.code === "DUPLICATE_FINAL_NARRATIVE_TEXT")).toBe(false);
	});

	it("warns when a professional-summary sentence duplicates one rendered list item", () => {
		const data = createData();
		const repeated =
			"Prepared 483 offers resulting in contracts worth 2,89 mln PLN.";

		data.summary.content = `<p>${repeated} Administrative coordination and document management experience.</p>`;
		data.customSections = [
			{
				id: "custom-cross-section-dedup",
				type: "summary",
				title: "Selected achievements",
				icon: "",
				hidden: false,
				columns: 1,
				items: [
					{
						id: "cross-section-item",
						hidden: false,
						content: `<ul><li>${repeated}</li><li>Maintained document circulation.</li></ul>`,
					},
				],
			},
		] as never;

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [],
			generatedContent: [],
		});

		expect(result.dimensions.dedup).toBe("warning");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "DUPLICATE_FINAL_NARRATIVE_TEXT",
					dimension: "dedup",
					severity: "warning",
				}),
			]),
		);
	});

	it("does not use semantic similarity for cross-section dedup", () => {
		const data = createData();

		data.summary.content =
			"<p>Coordinated 483 offers with contracts valued at 2,89 mln PLN.</p>";
		data.customSections = [
			{
				id: "custom-cross-section-paraphrase",
				type: "summary",
				title: "Selected achievements",
				icon: "",
				hidden: false,
				columns: 1,
				items: [
					{
						id: "paraphrased-item",
						hidden: false,
						content:
							"<p>Prepared 483 offers resulting in contracts worth 2,89 mln PLN.</p>",
					},
				],
			},
		] as never;

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [],
			generatedContent: [],
		});

		expect(
			result.findings.some(
				(finding) => finding.code === "DUPLICATE_FINAL_NARRATIVE_TEXT",
			),
		).toBe(false);
	});

	it("warns when selected child numeric evidence is missing from its mapped final parent", () => {
		const data = createData();
		data.sections.experience.items = [
			{
				id: "employment-1",
				hidden: false,
				company: "Acme",
				position: "Coordinator",
				location: "",
				period: "2024",
				website: { url: "", label: "" },
				description: "<ul><li>Prepared offers and contracts.</li></ul>",
			},
		] as never;

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "fact-1",
					selected: true,
					recommended: true,
					sourceType: "employment_fact",
					sourceTextSnapshot: "Prepared 483 offers resulting in contracts worth 2,89 mln PLN.",
					parentSelectionItemId: "employment-1",
				},
			] as never,
			generatedContent: [],
		});

		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "SELECTED_NUMERIC_EVIDENCE_NOT_PRESERVED",
					selectionItemId: "fact-1",
				}),
			]),
		);
	});

	it("does not warn about numbers when source evidence contains no numeric value", () => {
		const data = createData();

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "fact-no-number",
					selected: true,
					recommended: false,
					sourceType: "employment_fact",
					sourceTextSnapshot: "Prepared administrative documentation.",
					parentSelectionItemId: "employment-1",
				},
			] as never,
			generatedContent: [],
		});

		expect(result.findings.some((finding) => finding.code === "SELECTED_NUMERIC_EVIDENCE_NOT_PRESERVED")).toBe(false);
	});

	it("accepts preserved numeric tokens in the mapped final parent description", () => {
		const data = createData();
		data.sections.experience.items = [
			{
				id: "employment-1",
				hidden: false,
				company: "Acme",
				position: "Coordinator",
				location: "",
				period: "2024",
				website: { url: "", label: "" },
				description: "<ul><li>Prepared 483 offers resulting in contracts worth 2.89 mln PLN.</li></ul>",
			},
		] as never;

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "fact-1",
					selected: true,
					recommended: false,
					sourceType: "employment_fact",
					sourceTextSnapshot: "Prepared 483 offers resulting in contracts worth 2,89 mln PLN.",
					parentSelectionItemId: "employment-1",
				},
			] as never,
			generatedContent: [],
		});

		expect(result.findings.some((finding) => finding.code === "SELECTED_NUMERIC_EVIDENCE_NOT_PRESERVED")).toBe(false);
	});
});
