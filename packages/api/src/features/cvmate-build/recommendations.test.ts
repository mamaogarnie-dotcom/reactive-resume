import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
	transaction: vi.fn(),
}));

const providerMock = vi.hoisted(() => ({
	getRunnableById: vi.fn(),
	getDefaultRunnable: vi.fn(),
	markUsed: vi.fn(),
}));

const buildServiceMock = vi.hoisted(() => ({
	getById: vi.fn(),
	listSelectionItems: vi.fn(),
	listGaps: vi.fn(),
}));

const generateJsonMock = vi.hoisted(() => vi.fn());
const getModelMock = vi.hoisted(() => vi.fn(() => ({ model: true })));
const generateIdMock = vi.hoisted(() => vi.fn());

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

vi.mock("@reactive-resume/db/schema", () => ({
	cvmateCvSelectionItem: {
		id: "selection_id",
		cvBuildId: "selection_build_id",
	},
	cvmateCvGap: {
		cvBuildId: "gap_build_id",
		origin: "gap_origin",
		status: "gap_status",
	},
}));

vi.mock("drizzle-orm", () => ({
	and: (...args: unknown[]) => args,
	eq: (...args: unknown[]) => args,
}));

vi.mock("@reactive-resume/utils/string", () => ({
	generateId: generateIdMock,
}));

vi.mock("../ai-providers/service", () => ({
	aiProvidersService: providerMock,
}));

vi.mock("../ai/generate-json", () => ({
	generateJson: generateJsonMock,
}));

vi.mock("../ai/service", () => ({
	getModel: getModelMock,
}));

vi.mock("./service", () => ({
	cvmateBuildService: buildServiceMock,
}));

const { __testables, cvmateBuildAiRecommendationOutputSchema, cvmateBuildAiRecommendationProviderOutputSchema, cvmateBuildRecommendationsService } = await import(
	"./recommendations"
);

const provider = {
	id: "provider-1",
	provider: "openai" as const,
	model: "test-model",
	apiKey: "secret",
	baseURL: "",
};

const jobOfferSnapshot: Parameters<typeof __testables.buildPrompt>[0]["jobOffer"] = {
	roleTitle: "Office Manager",
	companyName: "Acme",
	location: "Wroclaw",
	language: "pl",
	requirements: [
		{
			id: "req-1",
			category: "required",
			priority: "critical",
			sourceText: "Excel required",
			text: "Excel",
		},
		{
			id: "req-2",
			category: "preferred",
			priority: "important",
			sourceText: "CRM preferred",
			text: "CRM",
		},
		{
			id: "req-3",
			category: "responsibility",
			priority: "important",
			sourceText: "Prepare reports",
			text: "Prepare reports",
		},
	],
};

const build = {
	id: "build-1",
	jobOfferSnapshot,
	targetLanguage: "pl",
};

const selectionItems: Parameters<typeof __testables.buildPrompt>[0]["selectionItems"] = [
	{
		id: "employment-1",
		cvBuildId: "build-1",
		parentSelectionItemId: null,
		sourceType: "employment",
		sourceId: "employment-source-1",
		sourceTextSnapshot: "Office Manager - Example Ltd",
		sourceDataSnapshot: {
			company: "Example Ltd",
			jobTitle: "Office Manager",
		},
		recommended: false,
		selected: true,
		recommendationReason: null,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: "fact-1",
		cvBuildId: "build-1",
		parentSelectionItemId: "employment-1",
		sourceType: "experience_fact",
		sourceId: "fact-source-1",
		sourceTextSnapshot: "Prepared Excel reports.",
		sourceDataSnapshot: {
			id: "raw-fact-id",
			masterProfileId: "master-1",
			text: "Prepared Excel reports.",
			createdAt: "2026-01-01T10:00:00.000Z",
			updatedAt: "2026-01-02T10:00:00.000Z",
			sortOrder: 99,
		},
		recommended: false,
		selected: false,
		recommendationReason: null,
		sortOrder: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: "course-1",
		cvBuildId: "build-1",
		parentSelectionItemId: null,
		sourceType: "course",
		sourceId: "course-source-1",
		sourceTextSnapshot: "First Aid",
		sourceDataSnapshot: {
			name: "First Aid",
		},
		recommended: true,
		selected: true,
		recommendationReason: "Old recommendation",
		sortOrder: 2,
		createdAt: new Date(),
		updatedAt: new Date(),
	},
];

const existingGaps: Parameters<typeof __testables.resolveGapRequirements>[2] = [
	{
		id: "user-gap",
		cvBuildId: "build-1",
		jobRequirementId: null,
		requirementTextSnapshot: null,
		text: "User-created gap",
		severity: "important",
		origin: "user",
		status: "open",
		resolutionSourceType: null,
		resolutionSourceId: null,
		resolutionTextSnapshot: null,
		sortOrder: 0,
		resolvedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: "dismissed-gap",
		cvBuildId: "build-1",
		jobRequirementId: null,
		requirementTextSnapshot: "CRM",
		text: "CRM",
		severity: "important",
		origin: "detected",
		status: "dismissed",
		resolutionSourceType: null,
		resolutionSourceId: null,
		resolutionTextSnapshot: null,
		sortOrder: 1,
		resolvedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	},
];

function createTransactionMock() {
	const where = vi.fn(async () => undefined);
	const set = vi.fn((_value: Record<string, unknown>) => ({ where }));
	const update = vi.fn(() => ({ set }));

	const deleteWhere = vi.fn(async () => undefined);
	const deleteFn = vi.fn(() => ({ where: deleteWhere }));

	const values = vi.fn(async () => undefined);
	const insert = vi.fn(() => ({ values }));

	const tx = {
		update,
		delete: deleteFn,
		insert,
	};

	dbMock.transaction.mockImplementationOnce(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx));

	return {
		tx,
		update,
		set,
		where,
		deleteFn,
		deleteWhere,
		insert,
		values,
	};
}

beforeEach(() => {
	vi.clearAllMocks();

	buildServiceMock.getById.mockResolvedValue(build);
	buildServiceMock.listSelectionItems.mockResolvedValue(selectionItems);
	buildServiceMock.listGaps.mockResolvedValue(existingGaps);

	providerMock.getDefaultRunnable.mockResolvedValue(provider);
	providerMock.getRunnableById.mockResolvedValue(provider);
	providerMock.markUsed.mockResolvedValue(undefined);

	generateIdMock.mockReturnValue("gap-1");
});

describe("cvmateBuildAiRecommendationOutputSchema", () => {
	it("accepts IDs and reasons without candidate rewrite text", () => {
		expect(
			cvmateBuildAiRecommendationOutputSchema.parse({
				recommendations: [
					{
						selectionItemId: "fact-1",
						reason: "Direct Excel evidence.",
					},
				],
				gapRequirementIds: ["req-2"],
				gapSuggestions: [
					{
						requirementId: "req-2",
						kind: "software",
						text: "CRM",
					},
				],
			}),
		).toEqual({
			recommendations: [
				{
					selectionItemId: "fact-1",
					reason: "Direct Excel evidence.",
				},
			],
			gapRequirementIds: ["req-2"],
			gapSuggestions: [
				{
					requirementId: "req-2",
					kind: "software",
					text: "CRM",
				},
			],
		});
	});
});

describe("cvmateBuildAiRecommendationProviderOutputSchema", () => {
it("accepts compact relationship-only provider output", () => {
expect(
cvmateBuildAiRecommendationProviderOutputSchema.parse({
recommendations: [
{
selectionItemId: "s2",
requirementIds: ["r1", "r2"],
},
],
gapRequirementIds: ["r2"],
gapSuggestions: [
{
requirementId: "r2",
kind: "software",
},
],
}),
).toEqual({
recommendations: [
{
selectionItemId: "s2",
requirementIds: ["r1", "r2"],
},
],
gapRequirementIds: ["r2"],
gapSuggestions: [
{
requirementId: "r2",
kind: "software",
},
],
});
});
});
describe("recommendation helpers", () => {
	it("builds a prompt from frozen offer and candidate snapshots", () => {
		const prompt = __testables.buildPrompt({
			jobOffer: jobOfferSnapshot,
			selectionItems,
		});

		expect(prompt).toContain("Prepared Excel reports.");

expect(prompt).toContain(
'<REQUIREMENTS columns="[id,category,priority,text,sourceText]">',
);

expect(prompt).toContain(
'["r1","required","critical","Excel","Excel required"]',
);

expect(prompt).toContain(
'<CANDIDATE_ITEMS columns="[id,parentId,sourceType,data,sourceText]">',
);

expect(prompt).toContain(
'{"text":"Prepared Excel reports."}',
);

expect(prompt).toContain(
'"Office Manager - Example Ltd"',
);

expect(
(prompt.match(/Prepared Excel reports\./g) ?? []).length,
).toBe(1);

// Regression guard:
// required + preferred requirements must remain gap-eligible.
expect(prompt).toContain(
'["r1","r2"]',
);

expect(prompt).not.toContain('"sourceDataSnapshot"');
expect(prompt).not.toContain('"sourceTextSnapshot"');
expect(prompt).not.toContain('"parentSelectionItemId"');
expect(prompt).not.toContain("raw-fact-id");
expect(prompt).not.toContain("master-1");
		expect(prompt).toContain("<GAP_ELIGIBLE_REQUIREMENT_IDS>");
		expect(__testables.SYSTEM_PROMPT).toContain("Never invent, infer, embellish, or add candidate experience");
	});

	it("automatically recommends a parent when its child is recommended", () => {
		const result = __testables.validateAndExpandRecommendations(
			{
				recommendations: [
					{
						selectionItemId: "fact-1",
						reason: "Direct Excel evidence.",
					},
				],
				gapRequirementIds: [],
			},
			selectionItems,
		);

		expect(result.get("fact-1")).toBe("Direct Excel evidence.");
		expect(result.get("employment-1")).toBe("Direct Excel evidence.");
		expect(result.has("course-1")).toBe(false);
	});

	it("rejects a recommendation for an unknown candidate item", () => {
		expect(() =>
			__testables.validateAndExpandRecommendations(
				{
					recommendations: [
						{
							selectionItemId: "invented-item",
							reason: "Made up.",
						},
					],
					gapRequirementIds: [],
				},
				selectionItems,
			),
		).toThrow();
	});

	it("rejects gaps outside eligible frozen requirements and preserves dismissed detected gaps", () => {
		expect(() =>
			__testables.resolveGapRequirements(
				{
					recommendations: [],
					gapRequirementIds: ["req-3"],
				},
				jobOfferSnapshot.requirements,
				existingGaps,
			),
		).toThrow();

		const result = __testables.resolveGapRequirements(
			{
				recommendations: [],
				gapRequirementIds: ["req-1", "req-2"],
			},
			jobOfferSnapshot.requirements,
			existingGaps,
		);

		expect(result.map((item) => item.id)).toEqual(["req-1"]);
	});

	it("maps suggestions only to open detected gaps produced by the same AI result", () => {
		const output = cvmateBuildAiRecommendationOutputSchema.parse({
			recommendations: [],
			gapRequirementIds: ["req-1"],
			gapSuggestions: [
				{
					requirementId: "req-1",
					kind: "tool",
					text: "Excel",
				},
			],
		});
		const detectedGaps = __testables.resolveGapRequirements(output, jobOfferSnapshot.requirements, existingGaps);
		const baseGap = existingGaps[0];
		if (!baseGap) throw new Error("Missing base test gap.");

		const updatedGaps = [
			...existingGaps,
			{
				...baseGap,
				id: "detected-gap-1",
				requirementTextSnapshot: "Excel",
				text: "Excel",
				severity: "critical" as const,
				origin: "detected" as const,
				status: "open" as const,
			},
		];

		expect(__testables.resolveGapSuggestions(output, detectedGaps, updatedGaps)).toEqual([
			{
				gapId: "detected-gap-1",
				kind: "tool",
				text: "Excel",
			},
		]);

		expect(() =>
			__testables.resolveGapSuggestions(
				{
					...output,
					gapSuggestions: [
						{
							requirementId: "req-2",
							kind: "software",
							text: "CRM",
						},
					],
				},
				detectedGaps,
				updatedGaps,
			),
		).toThrow();
	});
});

describe("prompt alias resolution", () => {
it("tolerates provider requirement overmatch and caps derived reason coverage to four", () => {
	const requirements = [
		...jobOfferSnapshot.requirements,
		{
			id: "req-3",
			category: "responsibility",
			priority: "important",
			text: "Requirement Three",
			sourceText: null,
		},
		{
			id: "req-4",
			category: "preferred",
			priority: "additional",
			text: "Requirement Four",
			sourceText: null,
		},
		{
			id: "req-5",
			category: "keyword",
			priority: "additional",
			text: "Requirement Five",
			sourceText: null,
		},
	] as Parameters<typeof __testables.resolvePromptAliases>[2];

	const providerOutput = cvmateBuildAiRecommendationProviderOutputSchema.parse({
		recommendations: [
			{
				selectionItemId: "s2",
				requirementIds: ["r1", "r2", "r3", "r4", "r5"],
			},
		],
		gapRequirementIds: [],
	});

	const output = __testables.resolvePromptAliases(
		providerOutput,
		selectionItems,
		requirements,
	);

	const reason = output.recommendations[0]?.reason ?? "";

	expect(reason).toContain(requirements[0]?.text ?? "");
	expect(reason).toContain(requirements[1]?.text ?? "");
	expect(reason).toContain("Requirement Three");
	expect(reason).toContain("Requirement Four");
	expect(reason).not.toContain("Requirement Five");
});

it("rejects an unknown requirement alias even when it appears after four valid aliases", () => {
	const requirements = [
		...jobOfferSnapshot.requirements,
		{
			id: "req-3",
			category: "responsibility",
			priority: "important",
			text: "Requirement Three",
			sourceText: null,
		},
		{
			id: "req-4",
			category: "preferred",
			priority: "additional",
			text: "Requirement Four",
			sourceText: null,
		},
	] as Parameters<typeof __testables.resolvePromptAliases>[2];

	const providerOutput = cvmateBuildAiRecommendationProviderOutputSchema.parse({
		recommendations: [
			{
				selectionItemId: "s2",
				requirementIds: ["r1", "r2", "r3", "r4", "r999"],
			},
		],
		gapRequirementIds: [],
	});

	expect(() =>
		__testables.resolvePromptAliases(
			providerOutput,
			selectionItems,
			requirements,
		),
	).toThrow();
});
it("maps aliases and derives display text from frozen requirements", () => {
const output = __testables.resolvePromptAliases(
{
recommendations: [
{
selectionItemId: "s2",
requirementIds: ["r1"],
},
],
gapRequirementIds: ["r1", "r2"],
gapSuggestions: [
{
requirementId: "r2",
kind: "software",
},
],
},
selectionItems,
jobOfferSnapshot.requirements as Parameters<
typeof __testables.resolvePromptAliases
>[2],
);

expect(output).toEqual({
recommendations: [
{
selectionItemId: "fact-1",
reason: "Excel",
},
],
gapRequirementIds: ["req-1", "req-2"],
gapSuggestions: [
{
requirementId: "req-2",
kind: "software",
text: "CRM",
},
],
});
});

it("leaves an unknown selection ID for existing selection validation", () => {
const output = __testables.resolvePromptAliases(
{
recommendations: [
{
selectionItemId: "invented-item",
requirementIds: ["r1"],
},
],
gapRequirementIds: [],
},
selectionItems,
jobOfferSnapshot.requirements as Parameters<
typeof __testables.resolvePromptAliases
>[2],
);

expect(
output.recommendations[0]?.selectionItemId,
).toBe("invented-item");
});

it("rejects an unknown requirement alias before database mutation", () => {
expect(() =>
__testables.resolvePromptAliases(
{
recommendations: [
{
selectionItemId: "s2",
requirementIds: ["r999"],
},
],
gapRequirementIds: [],
},
selectionItems,
jobOfferSnapshot.requirements as Parameters<
typeof __testables.resolvePromptAliases
>[2],
),
).toThrow();
});
});

describe("quality coverage policy", () => {
	it("supplements a second relevant employment and preserves quantified impact", () => {
		const baseEmployment = selectionItems[0];
		const baseFact = selectionItems[1];

		if (!baseEmployment || !baseFact) throw new Error("Missing base selection fixtures.");

		const qualityItems = [
			{
				...baseEmployment,
				id: "employment-a",
				sourceId: "employment-source-a",
				sourceTextSnapshot: "Administration - Alpha",
				sourceDataSnapshot: {
					company: "Alpha",
					jobTitle: "Administration",
				},
				sortOrder: 0,
			},
			{
				...baseFact,
				id: "fact-a",
				sourceId: "fact-source-a",
				parentSelectionItemId: "employment-a",
				sourceTextSnapshot: "Managed documentation and deadlines.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Managed documentation and deadlines.",
				},
				sortOrder: 1,
			},
			{
				...baseEmployment,
				id: "employment-b",
				sourceId: "employment-source-b",
				sourceTextSnapshot: "Operations - Beta",
				sourceDataSnapshot: {
					company: "Beta",
					jobTitle: "Operations",
				},
				sortOrder: 2,
			},
			{
				...baseFact,
				id: "fact-b-relevant",
				sourceId: "fact-source-b-relevant",
				parentSelectionItemId: "employment-b",
				sourceTextSnapshot: "Managed client documentation and administrative deadlines.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Managed client documentation and administrative deadlines.",
				},
				sortOrder: 3,
			},
			{
				...baseFact,
				id: "fact-b-impact",
				sourceId: "fact-source-b-impact",
				parentSelectionItemId: "employment-b",
				sourceTextSnapshot: "Prepared 483 offers and contracts worth PLN 2.89 million.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Prepared 483 offers and contracts worth PLN 2.89 million.",
				},
				sortOrder: 4,
			},
			{
				...baseEmployment,
				id: "employment-c",
				sourceId: "employment-source-c",
				sourceTextSnapshot: "Production - Gamma",
				sourceDataSnapshot: {
					company: "Gamma",
					jobTitle: "Production",
				},
				sortOrder: 5,
			},
			{
				...baseFact,
				id: "fact-c-impact",
				sourceId: "fact-source-c-impact",
				parentSelectionItemId: "employment-c",
				sourceTextSnapshot: "Managed 27 production workers.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Managed 27 production workers.",
				},
				sortOrder: 6,
			},
		] as Parameters<typeof __testables.applyQualityCoveragePolicy>[1];

		const qualityRequirements = [
			{
				id: "req-docs",
				category: "responsibility" as const,
				priority: "important" as const,
				sourceText: null,
				text: "Manage administrative documentation and deadlines",
			},
			{
				id: "req-client",
				category: "required" as const,
				priority: "critical" as const,
				sourceText: null,
				text: "Communicate with clients and public offices",
			},
		];

		const result = __testables.applyQualityCoveragePolicy(
			new Map([
				["employment-a", "Manage administrative documentation and deadlines"],
				["fact-a", "Manage administrative documentation and deadlines"],
			]),
			qualityItems,
			qualityRequirements,
		);

		expect(result.has("employment-a")).toBe(true);
		expect(result.has("employment-b")).toBe(true);
		expect(result.has("fact-b-relevant")).toBe(true);
		expect(result.has("fact-b-impact")).toBe(true);
		expect(result.has("employment-c")).toBe(false);
		expect(result.has("fact-c-impact")).toBe(false);
	});

	it("supplements relevant standalone competencies but leaves irrelevant items alone", () => {
		const baseItem = selectionItems[2];
		if (!baseItem) throw new Error("Missing base selection fixture.");

		const qualityItems = [
			{
				...baseItem,
				id: "competency-docs",
				sourceType: "profile_list_item",
				sourceId: "competency-docs-source",
				sourceTextSnapshot: "Document workflow and deadline control",
				sourceDataSnapshot: {
					kind: "competency",
					value: "Document workflow and deadline control",
				},
				sortOrder: 0,
			},
			{
				...baseItem,
				id: "competency-unrelated",
				sourceType: "profile_list_item",
				sourceId: "competency-unrelated-source",
				sourceTextSnapshot: "Landscape photography",
				sourceDataSnapshot: {
					kind: "competency",
					value: "Landscape photography",
				},
				sortOrder: 1,
			},
		] as Parameters<typeof __testables.applyQualityCoveragePolicy>[1];

		const result = __testables.applyQualityCoveragePolicy(
			new Map(),
			qualityItems,
			[
				{
					id: "req-docs",
					category: "required",
					priority: "critical",
					sourceText: null,
					text: "Document workflow and deadline control",
				},
			],
		);

		expect(result.has("competency-docs")).toBe(true);
		expect(result.has("competency-unrelated")).toBe(false);
	});

	it("tells the provider to optimize recall, diversity and quantified evidence", () => {
		expect(__testables.SYSTEM_PROMPT).toContain("Optimize for high recall");
		expect(__testables.SYSTEM_PROMPT).toContain("evidence diversity across employers");
		expect(__testables.SYSTEM_PROMPT).toContain("quantified evidence");
	});
});

describe("cvmateBuildRecommendationsService.generate", () => {
	it("updates recommendation fields only and replaces only open detected gaps", async () => {
		const tx = createTransactionMock();

		generateJsonMock.mockResolvedValue({
			recommendations: [
				{
					selectionItemId: "s2",
					requirementIds: ["r1"],
				},
			],
			gapRequirementIds: ["r1", "r2"],
		});

		await cvmateBuildRecommendationsService.generate({
			id: "build-1",
			userId: "user-1",
		});

		expect(getModelMock).toHaveBeenCalledWith({
			provider: "openai",
			model: "test-model",
			apiKey: "secret",
			baseURL: "",
		});

		expect(generateJsonMock).toHaveBeenCalledOnce();
		expect(generateJsonMock.mock.calls[0]?.[3]).toMatchObject({
			maxOutputTokens: 4096,
			onUsage: expect.any(Function),
		});
		expect(generateJsonMock.mock.calls[0]?.[3]).not.toHaveProperty("providerOptions");

		expect(tx.set).toHaveBeenCalledWith({
			recommended: true,
			recommendationReason: "Excel",
		});

		expect(tx.set).toHaveBeenCalledWith({
			recommended: false,
			recommendationReason: null,
		});

		for (const [value] of tx.set.mock.calls) {
			expect(value).not.toHaveProperty("selected");
		}

		expect(tx.deleteWhere).toHaveBeenCalledWith([
			["gap_build_id", "build-1"],
			["gap_origin", "detected"],
			["gap_status", "open"],
		]);

		expect(tx.values).toHaveBeenCalledWith([
			{
				id: "gap-1",
				cvBuildId: "build-1",
				jobRequirementId: null,
				requirementTextSnapshot: "Excel",
				text: "Excel",
				severity: "critical",
				origin: "detected",
				status: "open",
				resolutionSourceType: null,
				resolutionSourceId: null,
				resolutionTextSnapshot: null,
				sortOrder: 0,
				resolvedAt: null,
			},
		]);

		expect(providerMock.markUsed).toHaveBeenCalledWith({
			id: "provider-1",
			userId: "user-1",
		});
	});

	it("uses low Groq reasoning for GPT-OSS recommendations only", async () => {
		createTransactionMock();

		providerMock.getDefaultRunnable.mockResolvedValue({
			...provider,
			provider: "groq",
			model: "openai/gpt-oss-120b",
		});

		generateJsonMock.mockResolvedValue({
			recommendations: [
				{
					selectionItemId: "s2",
					requirementIds: ["r1"],
				},
			],
			gapRequirementIds: [],
		});

		await cvmateBuildRecommendationsService.generate({
			id: "build-1",
			userId: "user-1",
		});

		expect(generateJsonMock).toHaveBeenCalledOnce();
		expect(generateJsonMock.mock.calls[0]?.[3]).toMatchObject({
			maxOutputTokens: 4096,
			providerOptions: {
				groq: {
					reasoningEffort: "low",
				},
			},
			onUsage: expect.any(Function),
		});
	});
	it("does not classify plain team headcount as quantified impact", () => {
		expect(__testables.hasQuantifiedImpactEvidence("Managed 27 production workers.")).toBe(false);
		expect(
			__testables.hasQuantifiedImpactEvidence(
				"Coordinated a multinational team of 12 to 27 employees.",
			),
		).toBe(false);
		expect(
			__testables.hasQuantifiedImpactEvidence(
				"Prepared 483 offers and contracts worth PLN 2.89 million.",
			),
		).toBe(true);
		expect(
			__testables.hasQuantifiedImpactEvidence(
				"66 applications resulted in PLN 720 thousand of secured funding.",
			),
		).toBe(true);
	});

	it("drops a weak optional third employment below 70 percent of the second-ranked score", () => {
		const selectionItems = [
			{
				id: "ratio-employment-a",
				sourceType: "employment",
				sourceId: "ratio-employment-a-source",
				parentSelectionItemId: null,
				sourceTextSnapshot: "Office document and contract coordination",
				sourceDataSnapshot: { company: "A", jobTitle: "Office Coordinator" },
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 0,
			},
			{
				id: "ratio-a-fact",
				sourceType: "experience_fact",
				sourceId: "ratio-a-fact-source",
				parentSelectionItemId: "ratio-employment-a",
				sourceTextSnapshot: "Prepared contracts, applications and document workflows with deadline control.",
				sourceDataSnapshot: { kind: "responsibility", text: "Prepared contracts, applications and document workflows with deadline control." },
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 1,
			},
			{
				id: "ratio-employment-b",
				sourceType: "employment",
				sourceId: "ratio-employment-b-source",
				parentSelectionItemId: null,
				sourceTextSnapshot: "Office documentation and client coordination",
				sourceDataSnapshot: { company: "B", jobTitle: "Administrative Coordinator" },
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 10,
			},
			{
				id: "ratio-b-fact",
				sourceType: "experience_fact",
				sourceId: "ratio-b-fact-source",
				parentSelectionItemId: "ratio-employment-b",
				sourceTextSnapshot: "Prepared documentation, offers and contracts and monitored deadlines.",
				sourceDataSnapshot: { kind: "responsibility", text: "Prepared documentation, offers and contracts and monitored deadlines." },
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 11,
			},
			{
				id: "ratio-employment-c",
				sourceType: "employment",
				sourceId: "ratio-employment-c-source",
				parentSelectionItemId: null,
				sourceTextSnapshot: "Production line coordinator",
				sourceDataSnapshot: { company: "C", jobTitle: "Production Coordinator" },
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 20,
			},
			{
				id: "ratio-c-fact",
				sourceType: "experience_fact",
				sourceId: "ratio-c-fact-source",
				parentSelectionItemId: "ratio-employment-c",
				sourceTextSnapshot: "Maintained production documentation.",
				sourceDataSnapshot: { kind: "responsibility", text: "Maintained production documentation." },
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 21,
			},
		] as unknown as Parameters<typeof __testables.applyRecommendationBudgetPolicy>[1];

		const recommendations = new Map(
			selectionItems.map((item) => [item.id, `reason-${item.id}`]),
		);

		const result = __testables.applyRecommendationBudgetPolicy(
			recommendations,
			selectionItems,
			[
				{
					id: "ratio-req",
					category: "required",
					priority: "critical",
					sourceText: null,
					text: "Office documentation, contracts, applications, offers and deadline coordination",
				},
			],
		);

		expect(result.has("ratio-employment-a")).toBe(true);
		expect(result.has("ratio-employment-b")).toBe(true);
		expect(result.has("ratio-employment-c")).toBe(false);
		expect(result.has("ratio-c-fact")).toBe(false);
	});

	it("keeps an optional third employment when its score remains close to the second-ranked score", () => {
		const selectionItems = ["a", "b", "c"].flatMap((suffix, index) => [
			{
				id: `near-employment-${suffix}`,
				sourceType: "employment",
				sourceId: `near-employment-${suffix}-source`,
				parentSelectionItemId: null,
				sourceTextSnapshot: "Office document and contract coordination",
				sourceDataSnapshot: { company: suffix.toUpperCase(), jobTitle: "Office Coordinator" },
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: index * 10,
			},
			{
				id: `near-fact-${suffix}`,
				sourceType: "experience_fact",
				sourceId: `near-fact-${suffix}-source`,
				parentSelectionItemId: `near-employment-${suffix}`,
				sourceTextSnapshot: "Prepared contracts, applications, offers and documentation and monitored deadlines.",
				sourceDataSnapshot: { kind: "responsibility", text: "Prepared contracts, applications, offers and documentation and monitored deadlines." },
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: index * 10 + 1,
			},
		]) as unknown as Parameters<typeof __testables.applyRecommendationBudgetPolicy>[1];

		const recommendations = new Map(
			selectionItems.map((item) => [item.id, `reason-${item.id}`]),
		);

		const result = __testables.applyRecommendationBudgetPolicy(
			recommendations,
			selectionItems,
			[
				{
					id: "near-req",
					category: "required",
					priority: "critical",
					sourceText: null,
					text: "Office documentation, contracts, applications, offers and deadline coordination",
				},
			],
		);

		expect(result.has("near-employment-a")).toBe(true);
		expect(result.has("near-employment-b")).toBe(true);
		expect(result.has("near-employment-c")).toBe(true);
	});

	it("caps an over-recall recommendation set while preserving impact and parent integrity", () => {
		const employments = Array.from({ length: 4 }, (_, index) => ({
			id: `budget-employment-${index}`,
			sourceType: "employment",
			sourceId: `budget-employment-source-${index}`,
			parentSelectionItemId: null,
			sourceTextSnapshot: `Office coordination and document workflow Employer ${index}`,
			sourceDataSnapshot: {
				company: `Employer ${index}`,
				jobTitle: "Office coordination",
			},
			selected: false,
			recommended: false,
			recommendationReason: null,
			sortOrder: index * 10,
		}));

		const facts = employments.flatMap((employment, employmentIndex) => [
			{
				id: `budget-fact-${employmentIndex}-docs`,
				sourceType: "experience_fact",
				sourceId: `budget-fact-${employmentIndex}-docs-source`,
				parentSelectionItemId: employment.id,
				sourceTextSnapshot: "Prepared documents, applications and contracts.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Prepared documents, applications and contracts.",
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: employment.sortOrder + 1,
			},
			{
				id: `budget-fact-${employmentIndex}-deadlines`,
				sourceType: "experience_fact",
				sourceId: `budget-fact-${employmentIndex}-deadlines-source`,
				parentSelectionItemId: employment.id,
				sourceTextSnapshot: "Monitored documentation and administrative deadlines.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Monitored documentation and administrative deadlines.",
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: employment.sortOrder + 2,
			},
			{
				id: `budget-fact-${employmentIndex}-vendors`,
				sourceType: "experience_fact",
				sourceId: `budget-fact-${employmentIndex}-vendors-source`,
				parentSelectionItemId: employment.id,
				sourceTextSnapshot: "Coordinated suppliers, contractors and office workflow.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Coordinated suppliers, contractors and office workflow.",
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: employment.sortOrder + 3,
			},
			{
				id: `budget-fact-${employmentIndex}-impact`,
				sourceType: "experience_fact",
				sourceId: `budget-fact-${employmentIndex}-impact-source`,
				parentSelectionItemId: employment.id,
				sourceTextSnapshot: `Prepared ${400 + employmentIndex} offers and contracts worth PLN ${2000 + employmentIndex}.`,
				sourceDataSnapshot: {
					kind: "responsibility",
					text: `Prepared ${400 + employmentIndex} offers and contracts worth PLN ${2000 + employmentIndex}.`,
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: employment.sortOrder + 4,
			},
		]);

		const profiles = Array.from({ length: 7 }, (_, index) => ({
			id: `budget-profile-${index}`,
			sourceType: "profile_list_item",
			sourceId: `budget-profile-source-${index}`,
			parentSelectionItemId: null,
			sourceTextSnapshot: `Document workflow competency ${index}`,
			sourceDataSnapshot: {
				kind: "competency",
				value: `Document workflow competency ${index}`,
			},
			selected: false,
			recommended: false,
			recommendationReason: null,
			sortOrder: 100 + index,
		}));

		const projects = Array.from({ length: 2 }, (_, index) => ({
			id: `budget-project-${index}`,
			sourceType: "project",
			sourceId: `budget-project-source-${index}`,
			parentSelectionItemId: null,
			sourceTextSnapshot: `Document workflow project ${index}`,
			sourceDataSnapshot: {
				name: `Project ${index}`,
				description: "Document workflow and deadline coordination",
			},
			selected: false,
			recommended: false,
			recommendationReason: null,
			sortOrder: 120 + index,
		}));

		const education = Array.from({ length: 2 }, (_, index) => ({
			id: `budget-education-${index}`,
			sourceType: "education",
			sourceId: `budget-education-source-${index}`,
			parentSelectionItemId: null,
			sourceTextSnapshot: `Education ${index}`,
			sourceDataSnapshot: {
				institution: `School ${index}`,
			},
			selected: false,
			recommended: false,
			recommendationReason: null,
			sortOrder: 130 + index,
		}));

		const volunteer = Array.from({ length: 2 }, (_, index) => ({
			id: `budget-volunteer-${index}`,
			sourceType: "volunteer",
			sourceId: `budget-volunteer-source-${index}`,
			parentSelectionItemId: null,
			sourceTextSnapshot: `Volunteer document coordination ${index}`,
			sourceDataSnapshot: {
				organization: `Organization ${index}`,
				summary: "Document coordination",
			},
			selected: false,
			recommended: false,
			recommendationReason: null,
			sortOrder: 140 + index,
		}));

		const selectionItems = [
			...employments,
			...facts,
			...profiles,
			...projects,
			...education,
			...volunteer,
		] as unknown as Parameters<typeof __testables.applyRecommendationBudgetPolicy>[1];

		const recommendations = new Map(
			selectionItems.map((item) => [item.id, `reason-${item.id}`]),
		);

		const requirements = [
			{
				id: "budget-req",
				category: "required",
				priority: "critical",
				sourceText: null,
				text: "Document workflow, deadlines, applications, offers, contracts and coordination",
			},
		] as Parameters<typeof __testables.applyRecommendationBudgetPolicy>[2];

		const result = __testables.applyRecommendationBudgetPolicy(
			recommendations,
			selectionItems,
			requirements,
		);

		expect(result.size).toBeLessThanOrEqual(20);
		expect([...result.keys()].filter((id) => id.startsWith("budget-employment-"))).toHaveLength(3);
		expect(result.has("budget-employment-3")).toBe(false);

		for (const employmentIndex of [0, 1, 2]) {
			const factIds = [...result.keys()].filter((id) =>
				id.startsWith(`budget-fact-${employmentIndex}-`),
			);
			expect(factIds).toHaveLength(employmentIndex < 2 ? 4 : 1);
			expect(result.has(`budget-fact-${employmentIndex}-impact`)).toBe(true);
		}

		expect([...result.keys()].filter((id) => id.startsWith("budget-profile-"))).toHaveLength(5);
		expect([...result.keys()].filter((id) => id.startsWith("budget-project-"))).toHaveLength(1);
		expect([...result.keys()].filter((id) => id.startsWith("budget-education-"))).toHaveLength(1);
		expect([...result.keys()].filter((id) => id.startsWith("budget-volunteer-"))).toHaveLength(1);
	});

	it("deduplicates quantified facts with the same numeric impact signature", () => {
		const selectionItems = [
			{
				id: "dedupe-employment",
				sourceType: "employment",
				sourceId: "dedupe-employment-source",
				parentSelectionItemId: null,
				sourceTextSnapshot: "Offer and contract coordination",
				sourceDataSnapshot: {
					company: "Example",
					jobTitle: "Coordinator",
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 0,
			},
			{
				id: "dedupe-impact-a",
				sourceType: "experience_fact",
				sourceId: "dedupe-impact-a-source",
				parentSelectionItemId: "dedupe-employment",
				sourceTextSnapshot: "Prepared 483 offers and contracts worth PLN 2.89 million.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Prepared 483 offers and contracts worth PLN 2.89 million.",
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 1,
			},
			{
				id: "dedupe-impact-b",
				sourceType: "experience_fact",
				sourceId: "dedupe-impact-b-source",
				parentSelectionItemId: "dedupe-employment",
				sourceTextSnapshot: "483 offers resulted in contracts worth PLN 2.89 million.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "483 offers resulted in contracts worth PLN 2.89 million.",
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 2,
			},
			{
				id: "dedupe-docs",
				sourceType: "experience_fact",
				sourceId: "dedupe-docs-source",
				parentSelectionItemId: "dedupe-employment",
				sourceTextSnapshot: "Prepared application and contract documentation.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Prepared application and contract documentation.",
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 3,
			},
			{
				id: "dedupe-deadlines",
				sourceType: "experience_fact",
				sourceId: "dedupe-deadlines-source",
				parentSelectionItemId: "dedupe-employment",
				sourceTextSnapshot: "Monitored documentation deadlines.",
				sourceDataSnapshot: {
					kind: "responsibility",
					text: "Monitored documentation deadlines.",
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
				sortOrder: 4,
			},
		] as unknown as Parameters<typeof __testables.applyRecommendationBudgetPolicy>[1];

		const recommendations = new Map(
			selectionItems.map((item) => [item.id, `reason-${item.id}`]),
		);

		const result = __testables.applyRecommendationBudgetPolicy(
			recommendations,
			selectionItems,
			[
				{
					id: "dedupe-req",
					category: "required",
					priority: "critical",
					sourceText: null,
					text: "Applications, offers, contracts, documentation and deadlines",
				},
			],
		);

		expect(result.has("dedupe-employment")).toBe(true);
		expect(result.has("dedupe-impact-a")).toBe(true);
		expect(result.has("dedupe-impact-b")).toBe(false);
		expect(
			[...result.keys()].filter((id) => id.startsWith("dedupe-") && id !== "dedupe-employment"),
		).toHaveLength(3);
	});

	it("rejects an invalid AI selection before mutating the database", async () => {
		generateJsonMock.mockResolvedValue({
			recommendations: [
				{
					selectionItemId: "invented-item",
					requirementIds: ["r1"],
				},
			],
			gapRequirementIds: [],
		});

		await expect(
			cvmateBuildRecommendationsService.generate({
				id: "build-1",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.transaction).not.toHaveBeenCalled();
	});

	it("requires an analyzed job-offer snapshot", async () => {
		buildServiceMock.getById.mockResolvedValue({
			...build,
			jobOfferSnapshot: {
				...jobOfferSnapshot,
				requirements: [],
			},
		});

		await expect(
			cvmateBuildRecommendationsService.generate({
				id: "build-1",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(providerMock.getDefaultRunnable).not.toHaveBeenCalled();
		expect(generateJsonMock).not.toHaveBeenCalled();
	});
});

describe("stage 9 recommendation completeness", () => {
it("retains one available education item for cv completeness even without lexical overlap", () => {
const baseEmployment = selectionItems[0];
const baseFact = selectionItems[1];

if (!baseEmployment || !baseFact) {
throw new Error("Missing base selection fixtures.");
}

const educationItem = {
...baseEmployment,
id: "stage9-education",
sourceType: "education",
sourceId: "stage9-education-source",
parentSelectionItemId: null,
sourceTextSnapshot: "University of Opole | Master | Biology",
sourceDataSnapshot: {
institution: "University of Opole",
degree: "Master",
fieldOfStudy: "Biology",
},
selected: false,
recommended: false,
recommendationReason: null,
sortOrder: 100,
};

const items = [
baseEmployment,
baseFact,
educationItem,
] as unknown as Parameters<
typeof __testables.applyQualityCoveragePolicy
>[1];

const result =
__testables.applyQualityCoveragePolicy(
new Map([
[
baseEmployment.id,
"Office administration",
],
[
baseFact.id,
"Office administration",
],
]),
items,
[
{
id: "stage9-admin-req",
category: "required",
priority: "critical",
sourceText: null,
text: "Office administration and document workflow",
},
],
);

expect(result.has("stage9-education")).toBe(true);
expect(result.get("stage9-education")).toBe(
"Available education retained for CV completeness.",
);
});

it("prefers requirement diversity while preserving quantified impact within four facts", () => {
const baseEmployment = selectionItems[0];

if (!baseEmployment) {
throw new Error("Missing base employment fixture.");
}

const employment = {
...baseEmployment,
id: "stage9-diverse-employment",
sourceId: "stage9-diverse-employment-source",
sourceTextSnapshot:
"Office administration, document workflow and supplier coordination",
sourceDataSnapshot: {
company: "Example",
jobTitle: "Office administration",
},
selected: false,
recommended: false,
recommendationReason: null,
sortOrder: 0,
};

const fact = (
id: string,
text: string,
sortOrder: number,
) => ({
...baseEmployment,
id,
sourceType: "experience_fact",
sourceId: `${id}-source`,
parentSelectionItemId: employment.id,
sourceTextSnapshot: text,
sourceDataSnapshot: {
kind: "responsibility",
text,
},
selected: false,
recommended: false,
recommendationReason: null,
sortOrder,
});

const items = [
employment,
fact(
"stage9-fact-impact",
"Prepared 483 offers and contracts worth PLN 2.89 million.",
1,
),
fact(
"stage9-fact-docs-a",
"Prepared documents, applications, contracts and offers.",
2,
),
fact(
"stage9-fact-docs-b",
"Coordinated documents, applications, contracts and offers.",
3,
),
fact(
"stage9-fact-docs-c",
"Managed documents, applications, contracts and offers.",
4,
),
fact(
"stage9-fact-vendors",
"Coordinated suppliers.",
5,
),
] as unknown as Parameters<
typeof __testables.applyRecommendationBudgetPolicy
>[1];

const recommendations = new Map(
items.map((item) => [
item.id,
`reason-${item.id}`,
]),
);

const result =
__testables.applyRecommendationBudgetPolicy(
recommendations,
items,
[
{
id: "stage9-docs-req",
category: "required",
priority: "critical",
sourceText: null,
text: "Documents applications contracts offers",
},
{
id: "stage9-vendor-req",
category: "required",
priority: "critical",
sourceText: null,
text: "Suppliers",
},
],
);

const selectedFacts = [...result.keys()].filter(
(id) => id.startsWith("stage9-fact-"),
);

expect(selectedFacts).toHaveLength(4);
expect(result.has("stage9-fact-impact")).toBe(true);
expect(result.has("stage9-fact-vendors")).toBe(true);
expect(result.has("stage9-fact-docs-c")).toBe(false);
expect(result.size).toBeLessThanOrEqual(20);
});
});
