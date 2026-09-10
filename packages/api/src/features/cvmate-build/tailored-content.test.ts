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

	generateJsonMock.mockResolvedValue({
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

describe("tailored content prompt safeguards", () => {
	it("contains frozen evidence, rewrite IDs, target language, and strict factuality rules", () => {
		const prompt = __testables.buildPrompt({
			jobOffer: build.jobOfferSnapshot,
			selectionItems: [employmentSelection, factSelection] as never,
			targetLanguage: "en",
		});

		expect(prompt).toContain("selection-fact");
		expect(prompt).toContain("REWRITE_ELIGIBLE_SELECTION_IDS");
		expect(prompt).toContain("Coordinated a multinational production team.");
		expect(prompt).toContain("<TARGET_LANGUAGE>");
		expect(__testables.SYSTEM_PROMPT).toContain("Never invent, infer, embellish");
		expect(__testables.SYSTEM_PROMPT).toContain("using ONLY that fact's own supplied");
		expect(__testables.SYSTEM_PROMPT).toContain("Do not use external knowledge");
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

describe("cvmateBuildTailoredContentService.generate", () => {
	it("uses only selected items and inserts summary plus selected experience fact content", async () => {
		const { values } = createTransactionMocks();

		await cvmateBuildTailoredContentService.generate({
			id: "build-1",
			userId: "user-1",
		});

		expect(generateJsonMock).toHaveBeenCalledTimes(1);

		const aiPrompt = generateJsonMock.mock.calls[0]?.[1]?.prompt as string;
		expect(aiPrompt).toContain("selection-fact");
		expect(aiPrompt).not.toContain("Prepared tender documentation.");

		expect(values).toHaveBeenCalledTimes(1);

		const inserted = values.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
		expect(inserted).toHaveLength(2);

		expect(inserted).toEqual(
			expect.arrayContaining([
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

	it("updates existing generated rows without overwriting user finalText", async () => {
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
			.mockResolvedValueOnce([existingSummary, existingFact])
			.mockResolvedValueOnce([existingSummary, existingFact]);

		const { set, values } = createTransactionMocks();

		await cvmateBuildTailoredContentService.generate({
			id: "build-1",
			userId: "user-1",
		});

		expect(set).toHaveBeenCalledTimes(2);

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
