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
