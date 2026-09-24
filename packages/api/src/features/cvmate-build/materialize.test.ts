import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
}));

const buildServiceMock = vi.hoisted(() => ({
	getById: vi.fn(),
	listSelectionItems: vi.fn(),
	listGeneratedContent: vi.fn(),
}));

const resumeServiceMock = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
}));

const adapterMock = vi.hoisted(() => vi.fn());

const pdfMetricsMock = vi.hoisted(() => vi.fn());

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

vi.mock("@reactive-resume/db/schema", () => ({
	cvmateCvDocument: {
		id: "document_id",
		userId: "user_id",
		cvBuildId: "cv_build_id",
		updatedAt: "updated_at",
	},
}));

vi.mock("../../dto/cvmate-build", async () => {
	const { z } = await import("zod");

	return {
		cvmateBuildIdentitySnapshotSchema: z.object({
			id: z.string(),
			firstName: z.string().nullable(),
			lastName: z.string().nullable(),
			email: z.string().nullable(),
			phone: z.string().nullable(),
			location: z.string().nullable(),
			linkedinUrl: z.string().nullable(),
			websiteUrl: z.string().nullable(),
		}),
	};
});

vi.mock("drizzle-orm", () => ({
	and: (...args: unknown[]) => args,
	desc: (value: unknown) => value,
	eq: (...args: unknown[]) => args,
}));

vi.mock("../resume/service", () => ({
	resumeService: resumeServiceMock,
}));

vi.mock("./service", () => ({
	cvmateBuildService: buildServiceMock,
}));

vi.mock("./resume-adapter", () => ({
	createResumeDataFromCvmate: adapterMock,
}));

vi.mock("@reactive-resume/pdf/server", () => ({
	createResumePdfMetrics: pdfMetricsMock,
}));

const { cvmateBuildMaterializeService } = await import("./materialize");

const build = {
	id: "build-1",
	masterProfileId: "profile-1",
	targetLanguage: "pl",
	designSettings: null,
	jobOfferSnapshot: {
		roleTitle: "Operations Manager",
		companyName: "Acme",
	},
	identitySnapshot: {
		id: "profile-1",
		firstName: "Aga",
		lastName: "Nowak",
		email: "aga@example.com",
		phone: "+48 500 600 700",
		location: "Wroclaw",
		linkedinUrl: "https://www.linkedin.com/in/aga-nowak",
		websiteUrl: "https://example.com",
	},
};

const frozenProfile = {
	profile: build.identitySnapshot,
};

const selectionItems = [{ id: "selection-1" }];
const generatedContent = [{ id: "generated-1" }];

const resumeData = {
	metadata: {
		page: {
			locale: "pl-PL",
		},
	},
};

const existingDocument = {
	id: "document-1",
	userId: "user-1",
	cvBuildId: "build-1",
	resumeId: "resume-1",
	status: "draft",
	isFavorite: false,
	trashedAt: null,
	createdAt: new Date("2026-09-10T10:00:00.000Z"),
	updatedAt: new Date("2026-09-10T10:00:00.000Z"),
};

function mockDocumentSelect(rows: unknown[]) {
	const limit = vi.fn(async () => rows);
	const orderBy = vi.fn(() => ({ limit }));
	const where = vi.fn(() => ({ orderBy }));
	const from = vi.fn(() => ({ where }));

	dbMock.select.mockReturnValueOnce({ from });

	return { from, where, orderBy, limit };
}

function mockDocumentInsert(row: unknown) {
	const returning = vi.fn(async () => [row]);
	const values = vi.fn(() => ({ returning }));

	dbMock.insert.mockReturnValueOnce({ values });

	return { values, returning };
}

function mockDocumentUpdate() {
	const where = vi.fn(async () => undefined);
	const set = vi.fn(() => ({ where }));

	dbMock.update.mockReturnValueOnce({ set });

	return { set, where };
}

beforeEach(() => {
	vi.clearAllMocks();

	buildServiceMock.getById.mockResolvedValue(build);
	buildServiceMock.listSelectionItems.mockResolvedValue(selectionItems);
	buildServiceMock.listGeneratedContent.mockResolvedValue(generatedContent);
	adapterMock.mockReturnValue(resumeData);
	pdfMetricsMock.mockResolvedValue({
		actualPageCount: 1,
		lastPageTextUtilization: 0.72,
	});
	resumeServiceMock.create.mockResolvedValue("resume-1");
	resumeServiceMock.update.mockResolvedValue(undefined);
});

describe("cvmateBuildMaterializeService.preview", () => {
	it("returns canonical preview data without materializing a Resume", async () => {
		const result = await cvmateBuildMaterializeService.preview({
			id: "build-1",
			userId: "user-1",
		});

		const recommendedDesignSettings = {
			template: "lapras",
			primaryColor: "#4E6B35",
			textColor: "#1F2937",
			backgroundColor: "#FFFFFF",
		};

		expect(adapterMock).toHaveBeenCalledWith({
			profile: frozenProfile,
			selectionItems,
			generatedContent,
			targetLanguage: "pl",
			designSettings: recommendedDesignSettings,
		});

		expect(result).toEqual({
			data: resumeData,
			designSettings: recommendedDesignSettings,
			pageMetrics: {
				actualPageCount: 1,
				lastPageTextUtilization: 0.72,
			},
			usesRecommendation: true,
		});

		expect(pdfMetricsMock).toHaveBeenCalledWith({
			data: resumeData,
		});
		expect(resumeServiceMock.create).not.toHaveBeenCalled();
		expect(resumeServiceMock.update).not.toHaveBeenCalled();
		expect(dbMock.select).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
	});
});
describe("cvmateBuildMaterializeService.materialize", () => {
	it("creates a Reactive Resume and 1story document on first materialization", async () => {
		mockDocumentSelect([]);

		const document = {
			...existingDocument,
			id: "document-new",
		};

		const { values } = mockDocumentInsert(document);

		const result = await cvmateBuildMaterializeService.materialize({
			id: "build-1",
			userId: "user-1",
		});

		expect(adapterMock).toHaveBeenCalledWith({
			profile: frozenProfile,
			selectionItems,
			generatedContent,
			targetLanguage: "pl",
			designSettings: {
				template: "lapras",
				primaryColor: "#4E6B35",
				textColor: "#1F2937",
				backgroundColor: "#FFFFFF",
			},
		});

		expect(resumeServiceMock.create).toHaveBeenCalledWith({
			userId: "user-1",
			name: "Operations Manager - Acme",
			slug: "cvmate-build-1",
			tags: [],
			locale: "pl-PL",
			data: resumeData,
		});

		expect(values).toHaveBeenCalledWith({
			userId: "user-1",
			cvBuildId: "build-1",
			resumeId: "resume-1",
			status: "draft",
		});

		expect(result).toEqual({
			documentId: "document-new",
			resumeId: "resume-1",
			created: true,
		});
	});

	it("updates the existing Reactive Resume instead of creating another document", async () => {
		mockDocumentSelect([existingDocument]);
		const { set } = mockDocumentUpdate();

		const result = await cvmateBuildMaterializeService.materialize({
			id: "build-1",
			userId: "user-1",
		});

		expect(resumeServiceMock.update).toHaveBeenCalledWith({
			id: "resume-1",
			userId: "user-1",
			name: "Operations Manager - Acme",
			data: resumeData,
		});

		expect(resumeServiceMock.create).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();

		expect(set).toHaveBeenCalledWith({
			updatedAt: expect.any(Date),
		});

		expect(result).toEqual({
			documentId: "document-1",
			resumeId: "resume-1",
			created: false,
		});
	});

	it("rejects materialization when the frozen candidate identity is missing", async () => {
		buildServiceMock.getById.mockResolvedValueOnce({
			...build,
			identitySnapshot: null,
		});

		await expect(
			cvmateBuildMaterializeService.materialize({
				id: "build-1",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(adapterMock).not.toHaveBeenCalled();
		expect(resumeServiceMock.create).not.toHaveBeenCalled();
		expect(resumeServiceMock.update).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("uses the frozen build identity without reading the current Master Profile", async () => {
		await cvmateBuildMaterializeService.preview({
			id: "build-1",
			userId: "user-1",
		});

		expect(adapterMock).toHaveBeenCalledWith(
			expect.objectContaining({
				profile: frozenProfile,
			}),
		);
	});

	it("keeps the frozen identity valid after the source Master Profile is deleted", async () => {
		buildServiceMock.getById.mockResolvedValueOnce({
			...build,
			masterProfileId: null,
		});

		await cvmateBuildMaterializeService.preview({
			id: "build-1",
			userId: "user-1",
		});

		expect(adapterMock).toHaveBeenCalledWith(
			expect.objectContaining({
				profile: frozenProfile,
			}),
		);
	});
});
