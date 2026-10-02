import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
	transaction: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
}));

const generateIdMock = vi.hoisted(() => vi.fn());
const generateJsonMock = vi.hoisted(() => vi.fn());
const getModelMock = vi.hoisted(() => vi.fn());
const getDefaultRunnableMock = vi.hoisted(() => vi.fn());
const getRunnableByIdMock = vi.hoisted(() => vi.fn());
const markUsedMock = vi.hoisted(() => vi.fn());

const buildServiceMock = vi.hoisted(() => ({
	getById: vi.fn(),
	listSelectionItems: vi.fn(),
	listGeneratedContent: vi.fn(),
}));

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

vi.mock("@reactive-resume/db/schema", () => ({
	cvmateCvGeneratedContent: {
		id: "generated_content_id",
		cvBuildId: "cv_build_id",
	},
}));

vi.mock("drizzle-orm", () => ({
	and: (...args: unknown[]) => args,
	eq: (...args: unknown[]) => args,
}));

vi.mock("@reactive-resume/utils/string", () => ({
	generateId: generateIdMock,
}));

vi.mock("../ai/generate-json", () => ({
	generateJson: generateJsonMock,
}));

vi.mock("../ai/service", () => ({
	getModel: getModelMock,
}));

vi.mock("../ai-providers/service", () => ({
	aiProvidersService: {
		getDefaultRunnable: getDefaultRunnableMock,
		getRunnableById: getRunnableByIdMock,
		markUsed: markUsedMock,
	},
}));

vi.mock("./service", () => ({
	cvmateBuildService: buildServiceMock,
}));

const resolveRedactionContextMock = vi.hoisted(() => vi.fn());

vi.mock("./ai-redaction-context", () => ({
	resolveCvBuildAiRedactionContext: resolveRedactionContextMock,
}));

const { buildAiRedactionContext } = await import("../ai/redaction");

const { __testables, cvmateBuildAiTailoredContentOutputSchema, cvmateBuildTailoredContentService } = await import(
	"./tailored-content"
);

const now = new Date("2026-09-10T20:00:00.000Z");

const build = {
	id: "build-1",
	jobOfferSnapshot: {
		roleTitle: "Operations Manager",
		companyName: "Acme",
		location: "Wroclaw",
		language: "en",
		requirements: [
			{
				id: "req-1",
				category: "required" as const,
				priority: "critical" as const,
				text: "Production team coordination",
			},
		],
	},
	targetLanguage: "en",
};

const employmentSelection = {
	id: "selection-employment",
	cvBuildId: "build-1",
	parentSelectionItemId: null,
	sourceType: "employment",
	sourceId: "employment-1",
	sourceTextSnapshot: "Production Manager - Factory",
	sourceDataSnapshot: {
		company: "Factory",
		jobTitle: "Production Manager",
	},
	recommended: true,
	selected: true,
	recommendationReason: "Relevant management experience",
	sortOrder: 0,
	createdAt: now,
	updatedAt: now,
};

const factSelection = {
	id: "selection-fact",
	cvBuildId: "build-1",
	parentSelectionItemId: "selection-employment",
	sourceType: "experience_fact",
	sourceId: "fact-1",
	sourceTextSnapshot: "Coordinated a multinational production team.",
	sourceDataSnapshot: {
		text: "Coordinated a multinational production team.",
	},
	recommended: true,
	selected: true,
	recommendationReason: "Direct evidence",
	sortOrder: 1,
	createdAt: now,
	updatedAt: now,
};

const unselectedFact = {
	...factSelection,
	id: "selection-unselected",
	sourceId: "fact-unselected",
	sourceTextSnapshot: "Prepared tender documentation.",
	sourceDataSnapshot: {
		text: "Prepared tender documentation.",
	},
	selected: false,
	sortOrder: 2,
};

const provider = {
	id: "provider-1",
	provider: "openai",
	model: "test-model",
	apiKey: "secret",
	baseURL: null,
};

function createTransactionMocks() {
	const where = vi.fn(() => Promise.resolve());
	const set = vi.fn((_value: Record<string, unknown>) => ({ where }));
	const update = vi.fn(() => ({ set }));
	const values = vi.fn((_value: unknown) => Promise.resolve());
	const insert = vi.fn(() => ({ values }));

	dbMock.update.mockImplementation(update);
	dbMock.insert.mockImplementation(insert);
	dbMock.transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) => callback(dbMock));

	return { insert, set, update, values, where };
}

beforeEach(() => {
	vi.clearAllMocks();

	generateIdMock.mockReturnValue("generated-new");
	getModelMock.mockReturnValue("model-instance");
	getDefaultRunnableMock.mockResolvedValue(provider);
	getRunnableByIdMock.mockResolvedValue(provider);
	markUsedMock.mockResolvedValue(undefined);

	buildServiceMock.getById.mockResolvedValue(build);
	buildServiceMock.listSelectionItems.mockResolvedValue([employmentSelection, factSelection, unselectedFact]);
	buildServiceMock.listGeneratedContent.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

	createTransactionMocks();

	resolveRedactionContextMock.mockResolvedValue(buildAiRedactionContext([]));

	generateJsonMock.mockResolvedValue({
		professionalHeadline: "PRODUCTION | TEAM COORDINATION",
		professionalSummary: "Operations professional with production team coordination experience.",
		experienceFacts: [
			{
				selectionItemId: "selection-fact",
				text: "Coordinated a multinational production team.",
			},
		],
	});
});

describe("cvmateBuildAiTailoredContentOutputSchema", () => {
	it("accepts only a professional summary and selection-bound experience rewrites", () => {
		expect(
			cvmateBuildAiTailoredContentOutputSchema.parse({
				professionalSummary: "Production operations professional.",
				experienceFacts: [
					{
						selectionItemId: "selection-fact",
						text: "Coordinated a production team.",
					},
				],
			}),
		).toEqual({
			professionalSummary: "Production operations professional.",
			experienceFacts: [
				{
					selectionItemId: "selection-fact",
					text: "Coordinated a production team.",
				},
			],
		});
	});
});

describe("targeted professional headline v12", () => {
	it("requires professionalHeadline in the raw provider contract", () => {
		expect(
			__testables.rawOutputSchema.safeParse({
				professionalSummary: "Compact summary.",
				experienceFacts: [],
			}).success,
		).toBe(false);

		expect(
			__testables.rawOutputSchema.safeParse({
				professionalHeadline: "PRODUCTION | TEAM COORDINATION",
				professionalSummary: "Compact summary.",
				experienceFacts: [],
			}).success,
		).toBe(true);
	});

	it("rejects multiline professional headlines and accepts neutral single-line phrases", () => {
		expect(() =>
			__testables.validateOutput(
				{
					professionalHeadline: "PRODUCTION | TEAM COORDINATION",
					professionalSummary: "Production operations experience.",
					experienceFacts: [
						{
							selectionItemId: "selection-fact",
							text: "Coordinated a multinational production team.",
						},
					],
				},
				[employmentSelection, factSelection] as never,
				"en",
			),
		).not.toThrow();

		expect(() =>
			__testables.validateOutput(
				{
					professionalHeadline: "PRODUCTION\nTEAM COORDINATION",
					professionalSummary: "Production operations experience.",
					experienceFacts: [
						{
							selectionItemId: "selection-fact",
							text: "Coordinated a multinational production team.",
						},
					],
				},
				[employmentSelection, factSelection] as never,
				"en",
			),
		).toThrow("single line");
	});
});

describe("tailored content prompt safeguards", () => {
	it("contains frozen evidence, rewrite IDs, target language, and strict factuality rules", () => {
		const prompt = __testables.buildPrompt({
			jobOffer: build.jobOfferSnapshot,
			selectionItems: [employmentSelection, factSelection] as never,
			targetLanguage: "en",
		});

		// Prompt aliases instead of database IDs: s1 = employment, s2 = fact.
		expect(prompt).not.toContain("selection-fact");
		expect(prompt).not.toContain("selection-employment");
		expect(prompt).toContain('"id":"s2","parentSelectionItemId":"s1"');
		expect(prompt).toContain('<REWRITE_ELIGIBLE_SELECTION_IDS>\n["s2"]');
		expect(prompt).toContain("REWRITE_ELIGIBLE_SELECTION_IDS");
		expect(prompt).toContain("Coordinated a multinational production team.");
		expect(prompt).toContain("<TARGET_LANGUAGE>");
		expect(__testables.SYSTEM_PROMPT).toContain("Never invent, infer, embellish");
		expect(__testables.SYSTEM_PROMPT).toContain("using ONLY that fact's own supplied");
		expect(__testables.SYSTEM_PROMPT).toContain("Do not use external knowledge");
		expect(__testables.SYSTEM_PROMPT).toContain("Do not mechanically list every selected item");
		expect(__testables.SYSTEM_PROMPT).toContain("Do not write in first person or third person");
		expect(__testables.SYSTEM_PROMPT).toContain("Do not assume or express the candidate's gender");
		expect(__testables.SYSTEM_PROMPT).toContain(
			"For Polish professional summaries, use impersonal or nominal CV wording.",
		);
		expect(__testables.SYSTEM_PROMPT).toContain(
			"Do not describe the candidate with personal third-person wording such as",
		);
		expect(__testables.SYSTEM_PROMPT).toContain("unsupported qualitative evaluations");
		expect(__testables.SYSTEM_PROMPT).toContain(
			"Before returning JSON, perform a mandatory final qualitative-language",
		);
		expect(__testables.SYSTEM_PROMPT).toContain('never as "proficient in MS Office"');
		expect(__testables.SYSTEM_PROMPT).toContain("A restricted qualitative word is never required for good CV style");
		expect(__testables.SYSTEM_PROMPT).toContain("Preserve every numeric value");
		expect(__testables.SYSTEM_PROMPT).toContain("substantively improved CV-ready");
		expect(__testables.SYSTEM_PROMPT).toContain("Do not make cosmetic-only edits");
		expect(__testables.SYSTEM_PROMPT).toContain("core domain");
		expect(__testables.SYSTEM_PROMPT).toContain("Never omit directly matching domain/process evidence");
		expect(__testables.SYSTEM_PROMPT).toContain("factual claims, not stylistic polish");
		expect(__testables.SYSTEM_PROMPT).toContain("Do not merge words from separate evidence items");
		expect(__testables.SYSTEM_PROMPT).toContain("Professional-headline writing rules:");
		expect(__testables.SYSTEM_PROMPT).toContain("professionalHeadline");
		expect(__testables.SYSTEM_PROMPT).toContain(
			"When a critical or required domain is explicitly supported by selected evidence",
		);
		expect(__testables.SYSTEM_PROMPT).toContain(
			"Do not satisfy a domain-specific target using only generic process phrases",
		);
		expect(__testables.SYSTEM_PROMPT).toContain("do not recast unrelated employment as work inside that sector");
		expect(__testables.SYSTEM_PROMPT).toContain("strongest supported combination of target domain and target function");
		expect(__testables.PROMPT_VERSION).toBe("cvmate-tailored-content-v14");
		expect(__testables.SYSTEM_PROMPT).toContain("[EMAIL], [TELEFON], [URL], [OSOBA] and [ADRES] are redacted");
	});
});

describe("tailored content output validation", () => {
	it("rejects unknown, duplicate, or omitted experience fact IDs", () => {
		expect(() =>
			__testables.validateOutput(
				{
					professionalSummary: "Summary",
					experienceFacts: [
						{
							selectionItemId: "unknown",
							text: "Text",
						},
					],
				},
				[factSelection] as never,
			),
		).toThrow();

		expect(() =>
			__testables.validateOutput(
				{
					professionalSummary: "Summary",
					experienceFacts: [],
				},
				[factSelection] as never,
			),
		).toThrow();
	});

	it("requires a selected employment parent for every selected experience fact", () => {
		expect(() => __testables.validateSelectedHierarchy([factSelection] as never)).toThrow();
	});
});

it("enforces compact schema limits for summary and experience rewrites", () => {
	expect(
		cvmateBuildAiTailoredContentOutputSchema.safeParse({
			professionalSummary: "x".repeat(701),
			experienceFacts: [],
		}).success,
	).toBe(false);

	expect(
		cvmateBuildAiTailoredContentOutputSchema.safeParse({
			professionalSummary: "Compact summary.",
			experienceFacts: [
				{
					selectionItemId: "selection-fact",
					text: "x".repeat(321),
				},
			],
		}).success,
	).toBe(false);
});

it("preserves all source numbers and rejects invented numbers in experience rewrites", () => {
	const quantifiedFact = {
		...factSelection,
		id: "selection-quantified",
		sourceId: "fact-quantified",
		sourceTextSnapshot: "Prepared 483 offers resulting in contracts worth 2,89 mln PLN.",
		sourceDataSnapshot: {
			text: "Prepared 483 offers resulting in contracts worth 2,89 mln PLN.",
		},
	};

	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Relevant administrative experience.",
				experienceFacts: [
					{
						selectionItemId: "selection-quantified",
						text: "Prepared 483 offers leading to contracts worth 2,89 mln PLN.",
					},
				],
			},
			[{ ...quantifiedFact, recommended: false }] as never,
		),
	).not.toThrow();

	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Relevant administrative experience.",
				experienceFacts: [
					{
						selectionItemId: "selection-quantified",
						text: "Prepared offers leading to contracts worth 2,89 mln PLN.",
					},
				],
			},
			[{ ...quantifiedFact, recommended: false }] as never,
		),
	).toThrow("preserve every numeric value");

	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Relevant administrative experience.",
				experienceFacts: [
					{
						selectionItemId: "selection-quantified",
						text: "Prepared 483 offers leading to 99 contracts worth 2,89 mln PLN.",
					},
				],
			},
			[{ ...quantifiedFact, recommended: false }] as never,
		),
	).toThrow("must not add numeric values");
});

it("rejects multiline or pre-bulleted tailored text", () => {
	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Line one.\nLine two.",
				experienceFacts: [
					{
						selectionItemId: "selection-fact",
						text: "Coordinated a multinational production team.",
					},
				],
			},
			[factSelection] as never,
		),
	).toThrow("single paragraph");

	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Compact summary.",
				experienceFacts: [
					{
						selectionItemId: "selection-fact",
						text: "- Coordinated a multinational production team.",
					},
				],
			},
			[factSelection] as never,
		),
	).toThrow("single bullet-ready line");
});

it("enforces neutral impersonal wording for Polish professional summaries", () => {
	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Posiada doswiadczenie administracyjne i przygotowywal dokumentacje.",
				experienceFacts: [],
			},
			[] as never,
			"pl",
		),
	).toThrow("neutral impersonal Polish wording");

	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Doswiadczenie w administracji, przygotowywaniu dokumentacji i koordynacji terminow.",
				experienceFacts: [],
			},
			[] as never,
			"pl",
		),
	).not.toThrow();
});

it("rejects common Polish gendered past-tense summary forms", () => {
	for (const summary of [
		"Prowadzila korespondencje z kontrahentami.",
		"Monitorowal terminy i dokumentacje.",
		"Koordynowala wiele projektow jednoczesnie.",
	]) {
		expect(() =>
			__testables.validateOutput({ professionalSummary: summary, experienceFacts: [] }, [] as never, "pl"),
		).toThrow("neutral impersonal Polish wording");
	}
});
it("accepts an overlong raw provider summary, trims only at sentence boundaries, and enforces the final 700-character schema", () => {
	const firstSentence = `${"A".repeat(390)}.`;
	const secondSentence = `${"B".repeat(390)}.`;
	const rawSummary = `${firstSentence} ${secondSentence}`;

	const rawOutput = __testables.rawOutputSchema.parse({
		professionalHeadline: "PRODUCTION | TEAM COORDINATION",
		professionalSummary: rawSummary,
		experienceFacts: [],
	});

	expect(rawOutput.professionalSummary.length).toBeGreaterThan(700);
	expect(() => cvmateBuildAiTailoredContentOutputSchema.parse(rawOutput)).toThrow();

	const sanitized = __testables.sanitizeTailoredOutput(rawOutput, [] as never);

	expect(sanitized.professionalSummary).toBe(firstSentence);
	expect(sanitized.professionalSummary?.length).toBeLessThanOrEqual(700);
	expect(sanitized.professionalSummary?.endsWith(".")).toBe(true);
	expect(() => cvmateBuildAiTailoredContentOutputSchema.parse(sanitized)).not.toThrow();
});

it("does not reapply a quantified source after summary trimming removes it", () => {
	const quantifiedProject = {
		id: "project-overlong-anchor",
		sourceType: "project",
		selected: true,
		recommended: true,
		recommendationReason: "Direct match.",
		sortOrder: 10,
		parentSelectionItemId: null,
		sourceTextSnapshot: "purchase of 3 investment apartments; coordination of renovation work",
		sourceDataSnapshot: {},
	};
	const firstSentence = `${"A".repeat(660)}.`;
	const anchorSentence = "Experience includes purchase of 3 investment apartments.";
	const rawOutput = __testables.rawOutputSchema.parse({
		professionalHeadline: "REAL ESTATE | PROCESS COORDINATION",
		professionalSummary: `${firstSentence} ${anchorSentence}`,
		experienceFacts: [],
	});

	const sanitized = __testables.sanitizeTailoredOutput(rawOutput, [quantifiedProject] as never);

	expect(sanitized.professionalSummary).toBe(firstSentence);
	expect(sanitized.professionalSummary).not.toContain("purchase of 3 investment apartments");
	expect(() => cvmateBuildAiTailoredContentOutputSchema.parse(sanitized)).not.toThrow();
});

it("does not copy a quantified source into the summary when AI omits it", () => {
	const quantifiedProject = {
		id: "project-quantified",
		sourceType: "project",
		selected: true,
		recommended: true,
		recommendationReason: "Direct match to a required domain process.",
		sortOrder: 40,
		parentSelectionItemId: null,
		sourceTextSnapshot: "purchase of 3 investment apartments; coordination of renovation work",
		sourceDataSnapshot: {},
	};
	const summary = "Administrative coordination and document management experience.";

	const sanitized = __testables.sanitizeTailoredOutput(
		{
			professionalSummary: summary,
			experienceFacts: [],
		},
		[quantifiedProject] as never,
	);

	expect(sanitized.professionalSummary).toBe(summary);
	expect(sanitized.professionalSummary).not.toContain("purchase of 3 investment apartments");
});

it("does not force numeric evidence that is not recommended", () => {
	const nonRecommendedProject = {
		id: "project-not-recommended",
		sourceType: "project",
		selected: true,
		recommended: false,
		recommendationReason: null,
		sortOrder: 40,
		parentSelectionItemId: null,
		sourceTextSnapshot: "purchase of 3 investment apartments",
		sourceDataSnapshot: {},
	};

	const summary = "Administrative coordination and document management experience.";
	const sanitized = __testables.sanitizeTailoredOutput(
		{
			professionalSummary: summary,
			experienceFacts: [],
		},
		[nonRecommendedProject] as never,
	);

	expect(sanitized.professionalSummary).toBe(summary);
});

it("chooses the earliest selected recommended quantified non-employment anchor deterministically", () => {
	const later = {
		id: "later-project",
		sourceType: "project",
		selected: true,
		recommended: true,
		recommendationReason: "Relevant project.",
		sortOrder: 40,
		parentSelectionItemId: null,
		sourceTextSnapshot: "delivered 8 project stages",
		sourceDataSnapshot: {},
	};
	const earlier = {
		id: "earlier-fact",
		sourceType: "experience_fact",
		selected: true,
		recommended: true,
		recommendationReason: "Relevant measurable responsibility.",
		sortOrder: 9,
		parentSelectionItemId: "employment-1",
		sourceTextSnapshot: "handled 5 parallel cases",
		sourceDataSnapshot: {},
	};
	const employment = {
		id: "employment-1",
		sourceType: "employment",
		selected: true,
		recommended: true,
		recommendationReason: "Relevant employer context.",
		sortOrder: 0,
		parentSelectionItemId: null,
		sourceTextSnapshot: "managed a team of 27 people",
		sourceDataSnapshot: {},
	};

	const anchor = __testables.selectQuantifiedSummaryAnchor([later, earlier, employment] as never);

	expect(anchor?.id).toBe("earlier-fact");
});

it("does not choose an unselected quantified item as the summary prompt anchor", () => {
	const unselectedEarlier = {
		id: "unselected-quantified",
		sourceType: "project",
		selected: false,
		recommended: true,
		recommendationReason: "Would otherwise rank first.",
		sortOrder: 1,
		parentSelectionItemId: null,
		sourceTextSnapshot: "handled 99 parallel cases",
		sourceDataSnapshot: {},
	};
	const selectedLater = {
		id: "selected-quantified",
		sourceType: "project",
		selected: true,
		recommended: true,
		recommendationReason: "Selected measurable evidence.",
		sortOrder: 20,
		parentSelectionItemId: null,
		sourceTextSnapshot: "delivered 8 project stages",
		sourceDataSnapshot: {},
	};

	const anchor = __testables.selectQuantifiedSummaryAnchor([unselectedEarlier, selectedLater] as never);

	expect(anchor?.id).toBe("selected-quantified");
});

it("allows a professional summary to omit quantified scope that remains in selected evidence", () => {
	const quantifiedProject = {
		id: "project-quantified-validation",
		sourceType: "project",
		selected: true,
		recommended: true,
		recommendationReason: "Direct match.",
		sortOrder: 10,
		parentSelectionItemId: null,
		sourceTextSnapshot: "purchase of 3 investment apartments",
		sourceDataSnapshot: {},
	};

	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Experience in property purchase and sales processes.",
				experienceFacts: [],
			},
			[quantifiedProject] as never,
			"en",
		),
	).not.toThrow();
});

it("drops only summary sentences that contain unsupported qualitative upgrades", () => {
	const sanitized = __testables.sanitizeTailoredOutput(
		{
			professionalSummary: "Practical experience in property sales. Proficient use of MS Office.",
			experienceFacts: [],
		},
		[
			{
				sourceTextSnapshot: "practical knowledge of the property purchase and sales process",
				sourceDataSnapshot: {},
			},
		] as never,
	);

	expect(sanitized.professionalSummary).toBe("Practical experience in property sales.");
});

it("falls back to the selected source fact when a rewrite adds unsupported qualitative strength", () => {
	const sourceFact = {
		...factSelection,
		sourceTextSnapshot: "coordination of project deadlines",
	};

	const sanitized = __testables.sanitizeTailoredOutput(
		{
			professionalSummary: "Project coordination experience.",
			experienceFacts: [
				{
					selectionItemId: sourceFact.id,
					text: "Highly effective coordination of project deadlines.",
				},
			],
		},
		[sourceFact] as never,
	);

	expect(sanitized.experienceFacts[0]?.text).toBe("coordination of project deadlines");
});

it("preserves qualitative wording when the selected evidence explicitly supports it", () => {
	const supported = {
		...factSelection,
		sourceTextSnapshot: "successful coordination of project deadlines",
	};

	const sanitized = __testables.sanitizeTailoredOutput(
		{
			professionalSummary: "Successful coordination experience.",
			experienceFacts: [
				{
					selectionItemId: supported.id,
					text: "Successfully coordinated project deadlines.",
				},
			],
		},
		[supported] as never,
	);

	expect(sanitized.professionalSummary).toBe("Successful coordination experience.");
	expect(sanitized.experienceFacts[0]?.text).toBe("Successfully coordinated project deadlines.");
});
it("rejects unsupported qualitative upgrades in summary and fact rewrites", () => {
	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Successful coordination with highly effective documentation control.",
				experienceFacts: [
					{
						selectionItemId: "selection-fact",
						text: "Successfully coordinated a multinational production team.",
					},
				],
			},
			[employmentSelection, factSelection] as never,
		),
	).toThrow("unsupported qualitative upgrade");
});

it("allows a qualitative claim only when selected evidence explicitly supports it", () => {
	const supportedFact = {
		...factSelection,
		sourceTextSnapshot: "Successfully coordinated a multinational production team.",
		sourceDataSnapshot: {
			text: "Successfully coordinated a multinational production team.",
		},
	};

	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Successfully coordinated a multinational production team.",
				experienceFacts: [
					{
						selectionItemId: "selection-fact",
						text: "Successfully coordinated a multinational production team.",
					},
				],
			},
			[employmentSelection, supportedFact] as never,
		),
	).not.toThrow();
});

it("rejects invented numbers in the professional summary", () => {
	expect(() =>
		__testables.validateOutput(
			{
				professionalSummary: "Coordinated documentation for 99 projects.",
				experienceFacts: [
					{
						selectionItemId: "selection-fact",
						text: "Coordinated a multinational production team.",
					},
				],
			},
			[employmentSelection, factSelection] as never,
		),
	).toThrow("professional summary must not add numeric values");
});
it("projects only semantically required job and candidate evidence into the AI prompt", () => {
	const prompt = __testables.buildPrompt({
		jobOffer: {
			roleTitle: "Office Specialist",
			companyName: "Example",
			location: "Wroclaw",
			language: "pl",
			requirements: [
				{
					id: "REQUIREMENT_TECHNICAL_ID_MUST_NOT_BE_SENT",
					jobOfferId: "JOB_OFFER_ID_MUST_NOT_BE_SENT",
					category: "required",
					priority: "critical",
					text: "Coordinate property sale documentation",
					sourceText: "RAW_REQUIREMENT_SOURCE_MUST_NOT_BE_SENT",
					isUserEdited: false,
					sortOrder: 7,
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-02T00:00:00.000Z",
				},
			],
		},
		selectionItems: [
			{
				id: "selection-project",
				parentSelectionItemId: null,
				sourceType: "project",
				sourceTextSnapshot: "Purchased, renovated and sold 3 apartments.",
				sourceDataSnapshot: {
					text: "CANDIDATE_SOURCE_DATA_DUPLICATE_MUST_NOT_BE_SENT",
					internalMetadata: "INTERNAL_METADATA_MUST_NOT_BE_SENT",
				},
			},
		],
		targetLanguage: "pl",
	} as never);

	expect(prompt).toContain('"text":"Coordinate property sale documentation"');
	expect(prompt).toContain('"category":"required"');
	expect(prompt).toContain('"priority":"critical"');
	expect(prompt).toContain('"id":"s1"');
	expect(prompt).not.toContain("selection-project");
	expect(prompt).toContain('"sourceTextSnapshot":"Purchased, renovated and sold 3 apartments."');
	expect(prompt).not.toContain("REQUIREMENT_TECHNICAL_ID_MUST_NOT_BE_SENT");
	expect(prompt).not.toContain("JOB_OFFER_ID_MUST_NOT_BE_SENT");
	expect(prompt).not.toContain("RAW_REQUIREMENT_SOURCE_MUST_NOT_BE_SENT");
	expect(prompt).not.toContain("CANDIDATE_SOURCE_DATA_DUPLICATE_MUST_NOT_BE_SENT");
	expect(prompt).not.toContain("INTERNAL_METADATA_MUST_NOT_BE_SENT");
	expect(prompt).not.toContain('"sourceDataSnapshot"');
});
describe("cvmateBuildTailoredContentService.generate", () => {
	it("uses only selected items and inserts summary plus selected experience fact content", async () => {
		const { values } = createTransactionMocks();

		await cvmateBuildTailoredContentService.generate({
			id: "build-1",
			userId: "user-1",
		});

		expect(generateJsonMock).toHaveBeenCalledTimes(1);

		const aiOptions = generateJsonMock.mock.calls[0]?.[3] as Record<string, unknown>;
		expect(aiOptions).toEqual(
			expect.objectContaining({
				maxOutputTokens: 2048,
			}),
		);
		expect(aiOptions).not.toHaveProperty("providerOptions");

		const aiPrompt = generateJsonMock.mock.calls[0]?.[1]?.prompt as string;
		expect(aiPrompt).toContain('<REWRITE_ELIGIBLE_SELECTION_IDS>\n["s2"]');
		expect(aiPrompt).not.toContain("selection-fact");
		expect(aiPrompt).not.toContain("Prepared tender documentation.");

		expect(values).toHaveBeenCalledTimes(1);

		const inserted = values.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
		expect(inserted).toHaveLength(3);

		expect(inserted).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					cvBuildId: "build-1",
					selectionItemId: null,
					kind: "professional_headline",
					aiText: "PRODUCTION | TEAM COORDINATION",
					finalText: null,
					model: "test-model",
					promptVersion: __testables.PROMPT_VERSION,
				}),
				expect.objectContaining({
					cvBuildId: "build-1",
					selectionItemId: null,
					kind: "professional_summary",
					finalText: null,
					model: "test-model",
					promptVersion: __testables.PROMPT_VERSION,
				}),
				expect.objectContaining({
					cvBuildId: "build-1",
					selectionItemId: "selection-fact",
					kind: "experience_fact",
					sourceText: "Coordinated a multinational production team.",
					finalText: null,
				}),
			]),
		);

		expect(markUsedMock).toHaveBeenCalledWith({
			id: "provider-1",
			userId: "user-1",
		});
	});
	it("uses medium Groq reasoning with expanded output budget for GPT-OSS tailored content", async () => {
		getDefaultRunnableMock.mockResolvedValueOnce({
			...provider,
			provider: "groq",
			model: "openai/gpt-oss-120b",
		});

		await cvmateBuildTailoredContentService.generate({
			id: "build-1",
			userId: "user-1",
		});

		const aiOptions = generateJsonMock.mock.calls[0]?.[3] as Record<string, unknown>;

		expect(aiOptions).toEqual(
			expect.objectContaining({
				maxOutputTokens: 4096,
				providerOptions: {
					groq: {
						reasoningEffort: "medium",
					},
				},
			}),
		);
	});

	it("updates existing generated rows without overwriting user finalText", async () => {
		const existingHeadline = {
			id: "headline-existing",
			cvBuildId: "build-1",
			selectionItemId: null,
			kind: "professional_headline",
			sourceText: null,
			sourceDataSnapshot: {},
			aiText: "Old AI headline",
			finalText: "User-approved headline",
			model: "old-model",
			promptVersion: "old",
			createdAt: new Date("2026-09-10T19:00:00.000Z"),
			updatedAt: new Date("2026-09-10T19:00:00.000Z"),
		};

		const existingSummary = {
			id: "summary-existing",
			cvBuildId: "build-1",
			selectionItemId: null,
			kind: "professional_summary",
			sourceText: null,
			sourceDataSnapshot: {},
			aiText: "Old AI summary",
			finalText: "User-approved summary",
			model: "old-model",
			promptVersion: "old",
			createdAt: new Date("2026-09-10T19:00:00.000Z"),
			updatedAt: new Date("2026-09-10T19:00:00.000Z"),
		};

		const existingFact = {
			id: "fact-existing",
			cvBuildId: "build-1",
			selectionItemId: "selection-fact",
			kind: "experience_fact",
			sourceText: factSelection.sourceTextSnapshot,
			sourceDataSnapshot: factSelection.sourceDataSnapshot,
			aiText: "Old AI fact",
			finalText: "User-approved fact",
			model: "old-model",
			promptVersion: "old",
			createdAt: new Date("2026-09-10T19:00:00.000Z"),
			updatedAt: new Date("2026-09-10T19:00:00.000Z"),
		};

		buildServiceMock.listGeneratedContent.mockReset();
		buildServiceMock.listGeneratedContent
			.mockResolvedValueOnce([existingHeadline, existingSummary, existingFact])
			.mockResolvedValueOnce([existingHeadline, existingSummary, existingFact]);

		const { set, values } = createTransactionMocks();

		await cvmateBuildTailoredContentService.generate({
			id: "build-1",
			userId: "user-1",
		});

		expect(set).toHaveBeenCalledTimes(3);

		for (const [updates] of set.mock.calls) {
			expect(updates).not.toHaveProperty("finalText");
			expect(updates).toHaveProperty("aiText");
			expect(updates).toHaveProperty("model", "test-model");
			expect(updates).toHaveProperty("promptVersion", __testables.PROMPT_VERSION);
		}

		expect(values).not.toHaveBeenCalled();
	});

	it("rejects generation when the user has selected no candidate content", async () => {
		buildServiceMock.listSelectionItems.mockResolvedValue([unselectedFact]);

		await expect(
			cvmateBuildTailoredContentService.generate({
				id: "build-1",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(getDefaultRunnableMock).not.toHaveBeenCalled();
		expect(generateJsonMock).not.toHaveBeenCalled();
	});
});

describe("summary source attribution guard", () => {
	it("separates quantified employment evidence from unrelated real-estate domain evidence", () => {
		const employment = {
			id: "fundacja-employment",
			sourceType: "employment",
			parentSelectionItemId: null,
			sourceTextSnapshot: "administrative and project coordination",
			sortOrder: 0,
		};
		const quantifiedFact = {
			id: "fundacja-quantified",
			sourceType: "experience_fact",
			parentSelectionItemId: employment.id,
			sourceTextSnapshot: "66 offers and applications -> contracts worth about 720 thousand PLN.",
			sortOrder: 1,
		};
		const siblingFact = {
			id: "fundacja-documents",
			sourceType: "experience_fact",
			parentSelectionItemId: employment.id,
			sourceTextSnapshot: "coordination of documentation and deadlines",
			sortOrder: 2,
		};
		const propertyEvidence = {
			id: "property-project",
			sourceType: "project",
			parentSelectionItemId: null,
			sourceTextSnapshot: "practical knowledge of the purchase, preparation and sale of real estate",
			sortOrder: 40,
		};
		const unsafeSummary =
			"Experience coordinating documentation and deadlines in real-estate projects, including 66 offers and applications leading to contracts worth about 720 thousand PLN. Practical knowledge of the real-estate process.";

		const sanitized = __testables.sanitizeProfessionalSummarySourceAttribution(unsafeSummary, [
			employment,
			quantifiedFact,
			siblingFact,
			propertyEvidence,
		] as never);

		expect(sanitized).toContain(quantifiedFact.sourceTextSnapshot);
		expect(sanitized).toContain("Practical knowledge of the real-estate process.");
		expect(sanitized).not.toContain("real-estate projects, including 66 offers");
	});

	it("keeps quantified wording when borrowed context stays inside the same employment group", () => {
		const employment = {
			id: "employment-same-group",
			sourceType: "employment",
			parentSelectionItemId: null,
			sourceTextSnapshot: "administrative and project coordination",
			sortOrder: 0,
		};
		const quantifiedFact = {
			id: "quantified-same-group",
			sourceType: "experience_fact",
			parentSelectionItemId: employment.id,
			sourceTextSnapshot: "66 offers and applications -> contracts worth about 720 thousand PLN.",
			sortOrder: 1,
		};
		const siblingFact = {
			id: "documents-same-group",
			sourceType: "experience_fact",
			parentSelectionItemId: employment.id,
			sourceTextSnapshot: "coordination of documentation and deadlines",
			sortOrder: 2,
		};
		const summary =
			"Coordination of documentation and deadlines included 66 offers and applications leading to contracts worth about 720 thousand PLN.";

		const sanitized = __testables.sanitizeProfessionalSummarySourceAttribution(summary, [
			employment,
			quantifiedFact,
			siblingFact,
		] as never);

		expect(sanitized).toBe(summary);
	});

	it("does not inject quantified evidence when the AI summary omits numbers", () => {
		const quantifiedFact = {
			id: "quantified-omitted",
			sourceType: "experience_fact",
			parentSelectionItemId: "employment-omitted",
			sourceTextSnapshot: "66 offers and applications -> contracts worth about 720 thousand PLN.",
			sortOrder: 1,
		};
		const summary = "Administrative coordination and document management experience.";

		const sanitized = __testables.sanitizeProfessionalSummarySourceAttribution(summary, [quantifiedFact] as never);

		expect(sanitized).toBe(summary);
		expect(sanitized).not.toContain("66");
		expect(sanitized).not.toContain("720");
	});
});

describe("summary repeated boundary fragment guard", () => {
	it("drops a short repeated currency boundary fragment after a quantified sentence", () => {
		const quantifiedFact = {
			id: "bioarbor-quantified-boundary",
			sourceType: "experience_fact",
			parentSelectionItemId: "bioarbor-employment-boundary",
			sourceTextSnapshot: "483 prepared offers -> contracts worth about 2,89 mln z\u0142.",
			sortOrder: 1,
		};
		const malformedSummary =
			"483 prepared offers -> contracts worth about 2,89 mln z\u0142. z\u0142 finansowania. Property process experience.";
		const safeSummary = "483 prepared offers -> contracts worth about 2,89 mln z\u0142. Property process experience.";

		const sanitizedMalformed = __testables.sanitizeProfessionalSummarySourceAttribution(malformedSummary, [
			quantifiedFact,
		] as never);
		const sanitizedSafe = __testables.sanitizeProfessionalSummarySourceAttribution(safeSummary, [
			quantifiedFact,
		] as never);

		expect(sanitizedMalformed).toBe(safeSummary);
		expect(sanitizedMalformed).not.toContain("z\u0142 finansowania.");
		expect(sanitizedSafe).toBe(safeSummary);
	});
});
describe("experience rewrite substantive quality guard v12", () => {
	it("falls back to source wording for cosmetic-only edits", () => {
		const fact = {
			id: "selection-cosmetic-v12",
			sourceType: "experience_fact",
			selected: true,
			recommended: true,
			recommendationReason: "Direct match.",
			sortOrder: 9,
			parentSelectionItemId: null,
			sourceTextSnapshot: "monitorowanie terminow, dokumentacji i realizacji ustalen",
			sourceDataSnapshot: {},
		};

		const rawOutput = __testables.rawOutputSchema.parse({
			professionalHeadline: "Koordynacja dokumentacji",
			professionalSummary: "Doswiadczenie w koordynacji dokumentacji.",
			experienceFacts: [
				{
					selectionItemId: "selection-cosmetic-v12",
					text: "Monitorowanie terminow, dokumentacji oraz realizacji ustalen.",
				},
			],
		});

		const sanitized = __testables.sanitizeTailoredOutput(rawOutput, [fact] as never);

		expect(sanitized.experienceFacts[0]?.text).toBe(fact.sourceTextSnapshot);
	});

	it("keeps a substantively reframed rewrite with the same factual meaning", () => {
		const fact = {
			id: "selection-substantive-v12",
			sourceType: "experience_fact",
			selected: true,
			recommended: true,
			recommendationReason: "Direct match.",
			sortOrder: 9,
			parentSelectionItemId: null,
			sourceTextSnapshot: "monitorowanie terminow, dokumentacji i realizacji ustalen",
			sourceDataSnapshot: {},
		};

		const rewrite = "Kontrola terminow i dokumentacji oraz monitorowanie realizacji ustalen.";

		const rawOutput = __testables.rawOutputSchema.parse({
			professionalHeadline: "Koordynacja dokumentacji",
			professionalSummary: "Doswiadczenie w koordynacji dokumentacji.",
			experienceFacts: [
				{
					selectionItemId: "selection-substantive-v12",
					text: rewrite,
				},
			],
		});

		const sanitized = __testables.sanitizeTailoredOutput(rawOutput, [fact] as never);

		expect(sanitized.experienceFacts[0]?.text).toBe(rewrite);
	});
});

describe("tailored content personal-data redaction (P0 #15)", () => {
	const identity = {
		firstName: "Anna",
		lastName: "Zielińska",
		email: "anna.zielinska@example.test",
		phone: "+48 601 234 567",
		linkedinUrl: null,
		websiteUrl: null,
	};

	const originalFactText =
		"Coordinated a production team of 27 people; contact anna.zielinska@example.test or 601 234 567.";

	const piiFact = {
		...factSelection,
		id: "selection-fact-pii",
		sourceTextSnapshot: originalFactText,
		sourceDataSnapshot: { text: originalFactText, internalNote: "Anna Zielińska" },
	};

	const planted = [
		"anna.zielinska@example.test",
		"601 234 567",
		"Zielińska",
		"selection-fact-pii",
		"selection-employment",
	];
	const placeholderPattern = /\[(?:EMAIL|TELEFON|URL|OSOBA|ADRES)\]/;

	beforeEach(() => {
		buildServiceMock.listSelectionItems.mockResolvedValue([employmentSelection, piiFact, unselectedFact]);
		resolveRedactionContextMock.mockResolvedValue(buildAiRedactionContext([identity]));
	});

	it("sends aliases and redacted source text only, never IDs, source data or excluded types", () => {
		const prompt = __testables.buildPrompt({
			jobOffer: build.jobOfferSnapshot,
			selectionItems: [
				employmentSelection,
				piiFact,
				{ ...piiFact, id: "photo-1", sourceType: "profile_photo", sourceTextSnapshot: "PHOTO_MUST_NOT_BE_SENT" },
				{ ...piiFact, id: "ref-1", sourceType: "reference", sourceTextSnapshot: "REFERENCE_MUST_NOT_BE_SENT" },
				{
					...piiFact,
					id: "future-1",
					sourceType: "future_source_type",
					sourceTextSnapshot: "FUTURE_TYPE_MUST_NOT_BE_SENT",
				},
			] as never,
			targetLanguage: "en",
			redaction: buildAiRedactionContext([identity]),
		});

		for (const value of planted) expect(prompt).not.toContain(value);
		expect(prompt).not.toContain("PHOTO_MUST_NOT_BE_SENT");
		expect(prompt).not.toContain("REFERENCE_MUST_NOT_BE_SENT");
		expect(prompt).not.toContain("FUTURE_TYPE_MUST_NOT_BE_SENT");
		expect(prompt).not.toContain("internalNote");
		expect(prompt).not.toContain('"sourceDataSnapshot"');

		expect(prompt).toContain(
			'{"id":"s2","parentSelectionItemId":"s1","sourceType":"experience_fact","sourceTextSnapshot":"Coordinated a production team of 27 people; contact [EMAIL] or [TELEFON]."}',
		);
		// The quantified summary anchor uses the alias and the redacted text as well.
		expect(prompt).toMatch(
			/<SUMMARY_QUANTIFIED_ANCHOR>\n\{"id":"s2","sourceType":"experience_fact","sourceTextSnapshot":"[^"]*\[EMAIL\]/,
		);
		expect(prompt).toContain('<REWRITE_ELIGIBLE_SELECTION_IDS>\n["s2"]');
	});

	it("redacts third-party contact details in the job offer and the anchor's recommendation reason", () => {
		const jobOffer = {
			...build.jobOfferSnapshot,
			companyName: "Acme (rekrutacja@acme.example)",
			location: "ul. Polna 5, 00-950 Warszawa",
			requirements: [
				{
					id: "req-contact",
					category: "required" as const,
					priority: "critical" as const,
					sourceText: null,
					text: "Contact anna.recruiter@acme.example; Booking.com budget 125 000 000 PLN in 2019-2023",
				},
			],
		};
		const anchorWithReason = {
			...piiFact,
			recommendationReason: "Contact anna.recruiter@acme.example | +48 601 234 567",
		};

		const prompt = __testables.buildPrompt({
			jobOffer,
			selectionItems: [employmentSelection, anchorWithReason] as never,
			targetLanguage: "en",
		});

		for (const value of [
			"rekrutacja@acme.example",
			"anna.recruiter@acme.example",
			"601 234 567",
			"Polna 5",
			"00-950",
		]) {
			expect(prompt).not.toContain(value);
		}

		expect(prompt).toContain("Booking.com budget 125 000 000 PLN in 2019-2023");
		expect(prompt).toContain('"location":"[ADRES] Warszawa"');
		expect(prompt).toMatch(
			/<SUMMARY_QUANTIFIED_ANCHOR>\n[^\n]*"recommendationReason":"Contact \[EMAIL\] \| \[TELEFON\]"/,
		);
	});

	it("maps aliases back, validates numbers against the redacted evidence and stores original snapshots", async () => {
		const { values } = createTransactionMocks();
		generateJsonMock.mockResolvedValue({
			professionalHeadline: "PRODUCTION | TEAM COORDINATION",
			professionalSummary: "Production team coordination experience.",
			experienceFacts: [{ selectionItemId: "s2", text: "Coordinated a 27-person production team." }],
		});

		const result = await cvmateBuildTailoredContentService.generate({ id: "build-1", userId: "user-1" });

		expect(result.notices).toEqual([]);

		const prompt = generateJsonMock.mock.calls[0]?.[1]?.prompt as string;
		for (const value of planted) expect(prompt).not.toContain(value);

		const inserted = values.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
		const factRow = inserted.find((row) => row.kind === "experience_fact");
		const summaryRow = inserted.find((row) => row.kind === "professional_summary");

		expect(factRow).toMatchObject({
			selectionItemId: "selection-fact-pii",
			aiText: "Coordinated a 27-person production team.",
			sourceText: originalFactText,
			sourceDataSnapshot: piiFact.sourceDataSnapshot,
		});
		expect(JSON.stringify(summaryRow?.sourceDataSnapshot)).toContain(originalFactText);
		expect(JSON.stringify(inserted)).not.toMatch(placeholderPattern);
	});

	it("rejects a rewrite that reintroduces numbers hidden by redaction", async () => {
		createTransactionMocks();
		generateJsonMock.mockResolvedValue({
			professionalHeadline: "PRODUCTION | TEAM COORDINATION",
			professionalSummary: "Production team coordination experience.",
			experienceFacts: [{ selectionItemId: "s2", text: "Coordinated a team of 27 people, phone 601 234 567." }],
		});

		await expect(cvmateBuildTailoredContentService.generate({ id: "build-1", userId: "user-1" })).rejects.toMatchObject(
			{
				code: "BAD_REQUEST",
				message: expect.stringContaining("must not add numeric values"),
			},
		);
	});

	it("restores the original fact and omits headline and summary that echo placeholders", async () => {
		const { values } = createTransactionMocks();
		generateJsonMock.mockResolvedValue({
			professionalHeadline: "PRODUCTION | [OSOBA]",
			professionalSummary: "Production coordination; contact [EMAIL].",
			experienceFacts: [{ selectionItemId: "s2", text: "Coordinated 27 people; contact [EMAIL] or [TELEFON]." }],
		});

		const result = await cvmateBuildTailoredContentService.generate({ id: "build-1", userId: "user-1" });

		expect(result.notices).toEqual([
			{ code: "professional_headline_omitted" },
			{ code: "professional_summary_omitted" },
		]);

		const inserted = values.mock.calls[0]?.[0] as Array<Record<string, unknown>>;

		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({
			kind: "experience_fact",
			selectionItemId: "selection-fact-pii",
			aiText: originalFactText,
			sourceText: originalFactText,
		});
		expect(JSON.stringify(inserted)).not.toMatch(placeholderPattern);
	});

	it("never stores a placeholder when updating existing generated rows", async () => {
		const { set } = createTransactionMocks();
		buildServiceMock.listGeneratedContent.mockReset();
		buildServiceMock.listGeneratedContent
			.mockResolvedValueOnce([
				{ id: "existing-fact", kind: "experience_fact", selectionItemId: "selection-fact-pii", createdAt: now },
				{ id: "existing-headline", kind: "professional_headline", selectionItemId: null, createdAt: now },
			])
			.mockResolvedValueOnce([]);
		generateJsonMock.mockResolvedValue({
			professionalHeadline: "[OSOBA] | PRODUCTION",
			professionalSummary: "Production team coordination experience.",
			experienceFacts: [{ selectionItemId: "s2", text: "Coordinated the [OSOBA] team of 27 people." }],
		});

		const result = await cvmateBuildTailoredContentService.generate({ id: "build-1", userId: "user-1" });

		expect(result.notices).toEqual([{ code: "professional_headline_omitted" }]);
		expect(set).toHaveBeenCalledTimes(1);
		expect(set.mock.calls[0]?.[0]).toMatchObject({ aiText: originalFactText, sourceText: originalFactText });
		expect(JSON.stringify(set.mock.calls)).not.toMatch(placeholderPattern);
	});

	it("leaves clean output untouched when no placeholder is echoed", () => {
		const output = {
			professionalHeadline: "PRODUCTION",
			professionalSummary: "Production experience.",
			experienceFacts: [{ selectionItemId: "selection-fact-pii", text: "Coordinated 27 people." }],
		};

		expect(__testables.dropRedactionPlaceholderEchoes(output, [piiFact] as never)).toEqual({ output, notices: [] });
	});

	it("drops a summary fallback sentence instead of quoting redacted source text", () => {
		const employment = {
			id: "fundacja-employment",
			sourceType: "employment",
			parentSelectionItemId: null,
			sourceTextSnapshot: "administrative and project coordination",
			sortOrder: 0,
		};
		const originalQuantified = {
			id: "fundacja-quantified",
			sourceType: "experience_fact",
			parentSelectionItemId: employment.id,
			sourceTextSnapshot:
				"66 offers and applications -> contracts worth about 720 thousand PLN, contact anna@example.test.",
			sortOrder: 1,
		};
		const siblingFact = {
			id: "fundacja-documents",
			sourceType: "experience_fact",
			parentSelectionItemId: employment.id,
			sourceTextSnapshot: "coordination of documentation and deadlines",
			sortOrder: 2,
		};
		const propertyEvidence = {
			id: "property-project",
			sourceType: "project",
			parentSelectionItemId: null,
			sourceTextSnapshot: "practical knowledge of the purchase, preparation and sale of real estate",
			sortOrder: 40,
		};
		const originals = [employment, originalQuantified, siblingFact, propertyEvidence];
		const evidence = __testables.toAiEvidenceItems(
			originals.map((item) => ({ ...item, sourceDataSnapshot: {} })) as never,
			buildAiRedactionContext([]),
		);
		const unsafeSummary =
			"Experience coordinating documentation and deadlines in real-estate projects, including 66 offers and applications leading to contracts worth about 720 thousand PLN. Practical knowledge of the real-estate process.";

		const sanitized = __testables.sanitizeProfessionalSummarySourceAttribution(
			unsafeSummary,
			evidence,
			new Map(originals.map((item) => [item.id, item])) as never,
		);

		expect(sanitized).not.toContain("anna@example.test");
		expect(sanitized).not.toMatch(placeholderPattern);
		expect(sanitized).not.toContain("66 offers");
		expect(sanitized).toContain("Practical knowledge of the real-estate process.");
	});
});
