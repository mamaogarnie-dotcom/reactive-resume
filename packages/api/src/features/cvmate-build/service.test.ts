import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));

const generateIdMock = vi.hoisted(() => vi.fn());
const getCurrentProfileMock = vi.hoisted(() => vi.fn());
const getJobOfferByIdMock = vi.hoisted(() => vi.fn());

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

vi.mock("@reactive-resume/db/schema", () => ({
	cvmateCvBuild: {
		id: "build_id",
		userId: "user_id",
		updatedAt: "updated_at",
	},
}));

vi.mock("drizzle-orm", () => ({
	and: (...args: unknown[]) => args,
	desc: (value: unknown) => value,
	eq: (...args: unknown[]) => args,
}));

vi.mock("@reactive-resume/utils/string", () => ({
	generateId: generateIdMock,
}));

vi.mock("../cvmate-profile/service", () => ({
	cvmateProfileService: {
		getCurrent: getCurrentProfileMock,
	},
}));

vi.mock("../cvmate-job-offer/service", () => ({
	cvmateJobOfferService: {
		getById: getJobOfferByIdMock,
	},
}));

const { cvmateBuildService } = await import("./service");

const build = {
	id: "build-1",
	userId: "user-1",
	masterProfileId: "profile-1",
	jobOfferId: "offer-1",
	currentStep: "selection" as const,
	status: "active" as const,
	targetLanguage: "pl",
	jobOfferSnapshot: {
		id: "offer-1",
		roleTitle: "Operations Manager",
	},
	designSettings: null,
	completedAt: null,
	createdAt: new Date("2026-09-09T10:00:00.000Z"),
	updatedAt: new Date("2026-09-09T11:00:00.000Z"),
};

const jobOfferDetail = {
	id: "offer-1",
	sourceUrl: "https://example.com/job",
	rawText: "Job offer text",
	roleTitle: "Operations Manager",
	companyName: "Acme",
	location: "Wroclaw",
	language: "pl",
	analysisStatus: "analyzed" as const,
	analyzedAt: new Date("2026-09-09T09:00:00.000Z"),
	createdAt: new Date("2026-09-09T08:00:00.000Z"),
	updatedAt: new Date("2026-09-09T09:00:00.000Z"),
	assets: [],
	requirements: [],
};

const createSelectChain = (rows: unknown[]) => {
	const whereResult = {
		orderBy: vi.fn(() => Promise.resolve(rows)),
		then: <TResult1 = unknown[], TResult2 = never>(
			onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
			onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
		) => Promise.resolve(rows).then(onfulfilled, onrejected),
	};

	return {
		from: vi.fn(() => ({
			where: vi.fn(() => whereResult),
		})),
	};
};

const setSelectResults = (...results: unknown[][]) => {
	dbMock.select.mockReset();

	for (const rows of results) {
		dbMock.select.mockReturnValueOnce(createSelectChain(rows));
	}

	dbMock.select.mockReturnValue(createSelectChain([]));
};

const mockInsert = () => {
	const values = vi.fn(() => Promise.resolve());
	dbMock.insert.mockReturnValue({ values });
	return { values };
};

const mockUpdateReturning = (rows: unknown[]) => {
	const returning = vi.fn(() => Promise.resolve(rows));
	const where = vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where }));

	dbMock.update.mockReturnValue({ set });

	return { set, where, returning };
};

const mockDeleteReturning = (rows: unknown[]) => {
	const returning = vi.fn(() => Promise.resolve(rows));
	const where = vi.fn(() => ({ returning }));

	dbMock.delete.mockReturnValue({ where });

	return { where, returning };
};

beforeEach(() => {
	dbMock.select.mockReset();
	dbMock.insert.mockReset();
	dbMock.update.mockReset();
	dbMock.delete.mockReset();

	generateIdMock.mockReset();
	getCurrentProfileMock.mockReset();
	getJobOfferByIdMock.mockReset();

	generateIdMock.mockReturnValue("generated-build-id");

	getCurrentProfileMock.mockResolvedValue({
		profile: {
			id: "profile-1",
		},
	});

	getJobOfferByIdMock.mockResolvedValue(jobOfferDetail);

	setSelectResults([]);
});

describe("cvmateBuildService.list", () => {
	it("returns only builds owned by the authenticated user without userId", async () => {
		setSelectResults([{ ...build }]);

		const result = await cvmateBuildService.list({
			userId: "user-1",
		});

		expect(result).toEqual([
			{
				id: build.id,
				masterProfileId: build.masterProfileId,
				jobOfferId: build.jobOfferId,
				currentStep: build.currentStep,
				status: build.status,
				targetLanguage: build.targetLanguage,
				jobOfferSnapshot: build.jobOfferSnapshot,
				designSettings: build.designSettings,
				completedAt: build.completedAt,
				createdAt: build.createdAt,
				updatedAt: build.updatedAt,
			},
		]);

		expect(result.at(0)).not.toHaveProperty("userId");
	});
});

describe("cvmateBuildService.getById", () => {
	it("returns an owned build without userId", async () => {
		setSelectResults([{ ...build }]);

		const result = await cvmateBuildService.getById({
			id: "build-1",
			userId: "user-1",
		});

		expect(result).not.toHaveProperty("userId");
		expect(result.id).toBe("build-1");
	});

	it("returns NOT_FOUND when the build is inaccessible", async () => {
		setSelectResults([]);

		await expect(
			cvmateBuildService.getById({
				id: "build-other-user",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});

describe("cvmateBuildService.create", () => {
	it("requires an existing Master Profile", async () => {
		getCurrentProfileMock.mockResolvedValue(null);

		await expect(
			cvmateBuildService.create({
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("creates a build linked to the current Master Profile", async () => {
		const { values } = mockInsert();

		const result = await cvmateBuildService.create({
			userId: "user-1",
			targetLanguage: "pl",
		});

		expect(result).toBe("generated-build-id");

		expect(values).toHaveBeenCalledWith({
			id: "generated-build-id",
			userId: "user-1",
			masterProfileId: "profile-1",
			jobOfferId: null,
			jobOfferSnapshot: null,
			targetLanguage: "pl",
			designSettings: null,
		});

		expect(getJobOfferByIdMock).not.toHaveBeenCalled();
	});

	it("stores a snapshot of an owned job offer", async () => {
		const { values } = mockInsert();

		await cvmateBuildService.create({
			userId: "user-1",
			jobOfferId: "offer-1",
		});

		expect(getJobOfferByIdMock).toHaveBeenCalledWith({
			id: "offer-1",
			userId: "user-1",
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				jobOfferId: "offer-1",
				jobOfferSnapshot: jobOfferDetail,
			}),
		);
	});
});

describe("cvmateBuildService.update", () => {
	it("refreshes the job-offer snapshot when the linked offer changes", async () => {
		setSelectResults([{ ...build }]);

		const updatedBuild = {
			...build,
			jobOfferId: "offer-2",
			jobOfferSnapshot: {
				...jobOfferDetail,
				id: "offer-2",
			},
		};

		getJobOfferByIdMock.mockResolvedValue({
			...jobOfferDetail,
			id: "offer-2",
		});

		const { set } = mockUpdateReturning([updatedBuild]);

		const result = await cvmateBuildService.update({
			id: "build-1",
			userId: "user-1",
			jobOfferId: "offer-2",
		});

		expect(getJobOfferByIdMock).toHaveBeenCalledWith({
			id: "offer-2",
			userId: "user-1",
		});

		expect(set).toHaveBeenCalledWith({
			jobOfferId: "offer-2",
			jobOfferSnapshot: {
				...jobOfferDetail,
				id: "offer-2",
			},
		});

		expect(result).not.toHaveProperty("userId");
	});

	it("rejects completing only the step without completed status", async () => {
		setSelectResults([{ ...build }]);

		await expect(
			cvmateBuildService.update({
				id: "build-1",
				userId: "user-1",
				currentStep: "completed",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("rejects completed status without completed step", async () => {
		setSelectResults([{ ...build }]);

		await expect(
			cvmateBuildService.update({
				id: "build-1",
				userId: "user-1",
				status: "completed",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("sets completedAt when step and status become completed together", async () => {
		setSelectResults([{ ...build }]);

		const completedBuild = {
			...build,
			currentStep: "completed" as const,
			status: "completed" as const,
			completedAt: new Date(),
		};

		const { set } = mockUpdateReturning([completedBuild]);

		await cvmateBuildService.update({
			id: "build-1",
			userId: "user-1",
			currentStep: "completed",
			status: "completed",
		});

		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				currentStep: "completed",
				status: "completed",
				completedAt: expect.any(Date),
			}),
		);
	});

	it("clears completedAt when a completed build is reopened", async () => {
		const completedAt = new Date("2026-09-09T12:00:00.000Z");

		setSelectResults([
			{
				...build,
				currentStep: "completed" as const,
				status: "completed" as const,
				completedAt,
			},
		]);

		const reopenedBuild = {
			...build,
			currentStep: "review" as const,
			status: "active" as const,
			completedAt: null,
		};

		const { set } = mockUpdateReturning([reopenedBuild]);

		await cvmateBuildService.update({
			id: "build-1",
			userId: "user-1",
			currentStep: "review",
			status: "active",
		});

		expect(set).toHaveBeenCalledWith({
			currentStep: "review",
			status: "active",
			completedAt: null,
		});
	});
});

describe("cvmateBuildService.delete", () => {
	it("deletes an owned build", async () => {
		setSelectResults([{ ...build }]);
		mockDeleteReturning([{ id: "build-1" }]);

		await expect(
			cvmateBuildService.delete({
				id: "build-1",
				userId: "user-1",
			}),
		).resolves.toBeUndefined();

		expect(dbMock.delete).toHaveBeenCalled();
	});

	it("does not delete an inaccessible build", async () => {
		setSelectResults([]);

		await expect(
			cvmateBuildService.delete({
				id: "build-other-user",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(dbMock.delete).not.toHaveBeenCalled();
	});
});
