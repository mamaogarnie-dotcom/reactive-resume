import { describe, expect, it } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { evaluateFinalCvQuality } from "./final-quality-gate";

function createData() {
	const data = structuredClone(defaultResumeData);

	data.picture.hidden = true;
	data.picture.url = "";
	data.basics.headline = "OPERATIONS | ADMINISTRATION";
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
	it("warns when the professional headline is missing", () => {
		const data = createData();
		data.basics.headline = "   ";

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [],
			generatedContent: [],
		});

		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "MISSING_PROFESSIONAL_HEADLINE",
					dimension: "coverage",
					severity: "warning",
					path: "basics.headline",
				}),
			]),
		);
		expect(result.dimensions.coverage).toBe("warning");
	});

	it("warns once when education is available but not rendered", () => {
		const data = createData();

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "education-available-1",
					selected: false,
					recommended: false,
					sourceType: "education",
					sourceTextSnapshot: "University One | Master | Biology",
					parentSelectionItemId: null,
				},
				{
					id: "education-available-2",
					selected: false,
					recommended: false,
					sourceType: "education",
					sourceTextSnapshot: "University Two | Postgraduate",
					parentSelectionItemId: null,
				},
			] as never,
			generatedContent: [],
		});

		const findings = result.findings.filter(
			(finding) => finding.code === "AVAILABLE_EDUCATION_NOT_RENDERED",
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toEqual(
			expect.objectContaining({
				dimension: "coverage",
				severity: "warning",
				path: "sections.education.items",
			}),
		);
		expect(result.dimensions.coverage).toBe("warning");
	});

	it("warns once when language is available but not rendered", () => {
		const data = createData();

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "language-available-1",
					selected: false,
					recommended: false,
					sourceType: "language",
					sourceTextSnapshot: "English | B2",
					parentSelectionItemId: null,
				},
				{
					id: "language-available-2",
					selected: false,
					recommended: false,
					sourceType: "language",
					sourceTextSnapshot: "German | A2",
					parentSelectionItemId: null,
				},
			] as never,
			generatedContent: [],
		});

		const findings = result.findings.filter(
			(finding) => finding.code === "AVAILABLE_LANGUAGE_NOT_RENDERED",
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toEqual(
			expect.objectContaining({
				dimension: "coverage",
				severity: "warning",
				path: "sections.languages.items",
			}),
		);
		expect(result.dimensions.coverage).toBe("warning");
	});

	it("passes completeness coverage when available education and language are rendered", () => {
		const data = createData();
		data.sections.education.items = [
			{
				id: "education-rendered",
				hidden: false,
				school: "University of Opole",
				degree: "Master",
				area: "Biology",
				grade: "",
				location: "",
				period: "",
				website: { url: "", label: "" },
				description: "",
			},
		] as never;
		data.sections.languages.items = [
			{
				id: "language-rendered",
				hidden: false,
				language: "English",
				fluency: "B2",
				level: 0,
			},
		] as never;

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "education-available",
					selected: false,
					recommended: false,
					sourceType: "education",
					sourceTextSnapshot: "University of Opole | Master | Biology",
					parentSelectionItemId: null,
				},
				{
					id: "language-available",
					selected: false,
					recommended: false,
					sourceType: "language",
					sourceTextSnapshot: "English | B2",
					parentSelectionItemId: null,
				},
			] as never,
			generatedContent: [],
		});

		expect(
			result.findings.some((finding) => finding.code === "AVAILABLE_EDUCATION_NOT_RENDERED"),
		).toBe(false);
		expect(
			result.findings.some((finding) => finding.code === "AVAILABLE_LANGUAGE_NOT_RENDERED"),
		).toBe(false);
		expect(result.dimensions.coverage).toBe("pass");
	});

	it("warns only for one-page utilization below 0.70", () => {
		const data = createData();

		const underfilled = evaluateFinalCvQuality({
			data,
			pageMetrics: { actualPageCount: 1, lastPageTextUtilization: 0.699 },
			selectionItems: [],
			generatedContent: [],
		});

		expect(underfilled.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "ONE_PAGE_UNDERFILLED",
					dimension: "density",
					severity: "warning",
					path: "pageMetrics.lastPageTextUtilization",
				}),
			]),
		);
		expect(underfilled.dimensions.density).toBe("warning");

		const boundary = evaluateFinalCvQuality({
			data,
			pageMetrics: { actualPageCount: 1, lastPageTextUtilization: 0.7 },
			selectionItems: [],
			generatedContent: [],
		});

		expect(boundary.findings.some((finding) => finding.code === "ONE_PAGE_UNDERFILLED")).toBe(false);
		expect(boundary.dimensions.density).toBe("pass");

		const multiPage = evaluateFinalCvQuality({
			data,
			pageMetrics: { actualPageCount: 2, lastPageTextUtilization: 0.1 },
			selectionItems: [],
			generatedContent: [],
		});

		expect(multiPage.findings.some((finding) => finding.code === "ONE_PAGE_UNDERFILLED")).toBe(false);
		expect(multiPage.dimensions.density).toBe("pass");
	});
	it("warns when a supported critical target term is missing from the professional headline", () => {
		const data = createData();
		data.basics.headline = "DOCUMENTATION COORDINATION | DEADLINE MANAGEMENT";

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "project-property",
					selected: true,
					recommended: true,
					sourceType: "project",
					sourceTextSnapshot: "Managed commercial property preparation and property sale.",
					parentSelectionItemId: null,
				},
			] as never,
			generatedContent: [],
			jobOfferSnapshot: {
				requirements: [
					{
						id: "critical-property",
						priority: "critical",
						category: "required",
						text: "Experience in commercial property transactions and property sale processes.",
					},
				],
			},
		});

		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "HEADLINE_MISSES_SUPPORTED_CRITICAL_REQUIREMENT_TERM",
					dimension: "coverage",
					severity: "warning",
					path: "basics.headline",
				}),
			]),
		);
	});

	it("accepts a headline that contains a candidate-supported critical target term", () => {
		const data = createData();
		data.basics.headline = "COMMERCIAL PROPERTY | DOCUMENTATION COORDINATION";

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "project-property",
					selected: true,
					recommended: true,
					sourceType: "project",
					sourceTextSnapshot: "Managed commercial property preparation and property sale.",
					parentSelectionItemId: null,
				},
			] as never,
			generatedContent: [],
			jobOfferSnapshot: {
				requirements: [
					{
						id: "critical-property",
						priority: "critical",
						category: "required",
						text: "Experience in commercial property transactions and property sale processes.",
					},
				],
			},
		});

		expect(
			result.findings.some(
				(finding) => finding.code === "HEADLINE_MISSES_SUPPORTED_CRITICAL_REQUIREMENT_TERM",
			),
		).toBe(false);
	});

	it("warns when available evidence for a critical requirement was not selected", () => {
		const data = createData();

		const result = evaluateFinalCvQuality({
			data,
			pageMetrics,
			selectionItems: [
				{
					id: "available-procurement",
					selected: false,
					recommended: false,
					sourceType: "experience_fact",
					sourceTextSnapshot: "Managed enterprise procurement compliance documentation.",
					parentSelectionItemId: "employment-1",
				},
				{
					id: "selected-unrelated",
					selected: true,
					recommended: true,
					sourceType: "profile_list_item",
					sourceTextSnapshot: "Client communication and scheduling.",
					parentSelectionItemId: null,
				},
			] as never,
			generatedContent: [],
			jobOfferSnapshot: {
				requirements: [
					{
						id: "critical-procurement",
						priority: "critical",
						category: "required",
						text: "Enterprise procurement compliance experience.",
					},
				],
			},
		});

		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "SUPPORTED_CRITICAL_REQUIREMENT_NOT_SELECTED",
					dimension: "coverage",
					severity: "warning",
				}),
			]),
		);
	});

});

describe("final quality gate repeated sentence-boundary fragment", () => {
	it("warns on a short repeated sentence-boundary fragment after quantified text", () => {
		const malformed = createData();
		malformed.summary.content =
			"<p>483 prepared offers -> contracts worth about 2,89 mln z\u0142. z\u0142 finansowania.</p>";

		const malformedResult = evaluateFinalCvQuality({
			data: malformed,
			pageMetrics,
			selectionItems: [],
			generatedContent: [],
		});

		expect(malformedResult.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "REPEATED_SENTENCE_BOUNDARY_FRAGMENT",
					dimension: "grammar",
					severity: "warning",
				}),
			]),
		);
		expect(malformedResult.dimensions.grammar).toBe("warning");

		const safe = createData();
		safe.summary.content =
			"<p>483 prepared offers -> contracts worth about 2,89 mln z\u0142. Property experience.</p>";

		const safeResult = evaluateFinalCvQuality({
			data: safe,
			pageMetrics,
			selectionItems: [],
			generatedContent: [],
		});

		expect(
			safeResult.findings.some(
				(finding) =>
					finding.code === "REPEATED_SENTENCE_BOUNDARY_FRAGMENT",
			),
		).toBe(false);
	});
});
