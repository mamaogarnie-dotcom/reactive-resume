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

const getCurrentProfileMock = vi.hoisted(() => vi.fn());

const resumeServiceMock = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
}));

const adapterMock = vi.hoisted(() => vi.fn());

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

vi.mock("@reactive-resume/db/schema", () => ({
	cvmateCvDocument: {
		id: "document_id",
		userId: "user_id",
		cvBuildId: "cv_build_id",
		updatedAt: "updated_at",
	},
}));

vi.mock("drizzle-orm", () => ({
	and: (...args: unknown[]) => args,
	desc: (value: unknown) => value,
	eq: (...args: unknown[]) => args,
}));

vi.mock("../cvmate-profile/service", () => ({
	cvmateProfileService: {
		getCurrent: getCurrentProfileMock,
	},
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

const { cvmateBuildMaterializeService } = await import("./materialize");

const build = {
	id: "build-1",
	masterProfileId: "profile-1",
	targetLanguage: "pl",
	jobOfferSnapshot: {
		roleTitle: "Operations Manager",
		companyName: "Acme",
	},
};

const profile = {
	profile: {
		id: "profile-1",
	},
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
	getCurrentProfileMock.mockResolvedValue(profile);
	adapterMock.mockReturnValue(resumeData);
	resumeServiceMock.create.mockResolvedValue("resume-1");
	resumeServiceMock.update.mockResolvedValue(undefined);
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
			profile,
			selectionItems,
			generatedContent,
			targetLanguage: "pl",
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

	it("rejects materialization when the build Master Profile is unavailable", async () => {
		getCurrentProfileMock.mockResolvedValue({
			profile: {
				id: "profile-other",
			},
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
});
