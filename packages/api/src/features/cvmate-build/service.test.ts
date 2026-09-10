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
	cvmateCvSelectionItem: {
		id: "selection_item_id",
		cvBuildId: "cv_build_id",
		sourceType: "source_type",
		sourceId: "source_id",
		selected: "selected",
		sortOrder: "sort_order",
		createdAt: "created_at",
	},
	cvmateCvGap: {
		id: "gap_id",
		cvBuildId: "cv_build_id",
		sortOrder: "sort_order",
		createdAt: "created_at",
	},
	cvmateCvGeneratedContent: {
		id: "generated_content_id",
		cvBuildId: "cv_build_id",
		createdAt: "created_at",
	},
}));

vi.mock("drizzle-orm", () => ({
	and: (...args: unknown[]) => args,
	asc: (value: unknown) => value,
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

const secondBuild = {
	...build,
	id: "build-2",
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

const employment = {
	id: "employment-1",
	masterProfileId: "profile-1",
	company: "Acme",
	jobTitle: "Operations Manager",
	location: "Wroclaw",
	startDate: "2020-01",
	endDate: null,
	isCurrent: true,
	sortOrder: 0,
	createdAt: new Date("2026-09-09T07:00:00.000Z"),
	updatedAt: new Date("2026-09-09T07:00:00.000Z"),
};

const experienceFact = {
	id: "fact-1",
	masterProfileId: "profile-1",
	text: "Coordinated a multinational production team.",
	createdAt: new Date("2026-09-09T07:10:00.000Z"),
	updatedAt: new Date("2026-09-09T07:10:00.000Z"),
};

const unlinkedExperienceFact = {
	id: "fact-unlinked",
	masterProfileId: "profile-1",
	text: "Prepared tender documentation.",
	createdAt: new Date("2026-09-09T07:11:00.000Z"),
	updatedAt: new Date("2026-09-09T07:11:00.000Z"),
};

const employmentFact = {
	employmentId: "employment-1",
	experienceFactId: "fact-1",
	masterProfileId: "profile-1",
	sortOrder: 0,
	createdAt: new Date("2026-09-09T07:20:00.000Z"),
};

const masterProfile = {
	profile: {
		id: "profile-1",
	},
	sections: [],
	employments: [employment],
	experienceFacts: [experienceFact, unlinkedExperienceFact],
	employmentFacts: [employmentFact],
	listItems: [],
	projects: [],
	education: [],
	courses: [],
	certifications: [],
	volunteer: [],
	languages: [],
	awards: [],
	references: [],
	licenses: [],
	clauses: [],
	customSectionItems: [],
	photos: [],
};

const selectionItem = {
	id: "selection-1",
	cvBuildId: "build-1",
	parentSelectionItemId: null,
	sourceType: "experience_fact" as const,
	sourceId: "fact-1",
	sourceTextSnapshot: experienceFact.text,
	sourceDataSnapshot: { ...experienceFact },
	recommended: false,
	selected: true,
	recommendationReason: null,
	sortOrder: 0,
	createdAt: new Date("2026-09-09T12:00:00.000Z"),
	updatedAt: new Date("2026-09-09T12:00:00.000Z"),
};

const employmentSelectionItem = {
	id: "selection-employment",
	cvBuildId: "build-1",
	parentSelectionItemId: null,
	sourceType: "employment" as const,
	sourceId: "employment-1",
	sourceTextSnapshot: "Operations Manager — Acme",
	sourceDataSnapshot: { ...employment },
	recommended: false,
	selected: true,
	recommendationReason: null,
	sortOrder: 0,
	createdAt: new Date("2026-09-09T11:50:00.000Z"),
	updatedAt: new Date("2026-09-09T11:50:00.000Z"),
};
const gap = {
	id: "gap-1",
	cvBuildId: "build-1",
	jobRequirementId: null,
	requirementTextSnapshot: null,
	text: "Missing advanced Excel experience.",
	severity: "important" as const,
	origin: "user" as const,
	status: "open" as const,
	resolutionSourceType: null,
	resolutionSourceId: null,
	resolutionTextSnapshot: null,
	sortOrder: 0,
	resolvedAt: null,
	createdAt: new Date("2026-09-09T12:10:00.000Z"),
	updatedAt: new Date("2026-09-09T12:10:00.000Z"),
};

const resolvedGap = {
	...gap,
	status: "resolved" as const,
	resolutionSourceType: "experience_fact" as const,
	resolutionSourceId: "fact-1",
	resolutionTextSnapshot: experienceFact.text,
	resolvedAt: new Date("2026-09-09T12:20:00.000Z"),
};
const generatedContent = {
	id: "generated-1",
	cvBuildId: "build-1",
	selectionItemId: "selection-1",
	kind: "experience_fact" as const,
	sourceText: experienceFact.text,
	sourceDataSnapshot: { ...experienceFact },
	aiText: "AI rewritten experience fact.",
	finalText: null,
	model: "test-model",
	promptVersion: "v1",
	createdAt: new Date("2026-09-09T12:40:00.000Z"),
	updatedAt: new Date("2026-09-09T12:40:00.000Z"),
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

const mockInsertReturning = (rows: unknown[]) => {
	const returning = vi.fn(() => Promise.resolve(rows));
	const values = vi.fn(() => ({ returning }));

	dbMock.insert.mockReturnValue({ values });

	return { values, returning };
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
	getCurrentProfileMock.mockResolvedValue(masterProfile);
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

describe("cvmateBuildService.listSelectionItems", () => {
	it("lists selection items only after verifying ownership of the CV build", async () => {
		setSelectResults([{ ...build }], [{ ...selectionItem }]);

		const result = await cvmateBuildService.listSelectionItems({
			cvBuildId: "build-1",
			userId: "user-1",
		});

		expect(result).toEqual([selectionItem]);
	});

	it("rejects listing selection items for an inaccessible CV build", async () => {
		setSelectResults([]);

		await expect(
			cvmateBuildService.listSelectionItems({
				cvBuildId: "build-other-user",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});

describe("cvmateBuildService.createSelectionItem", () => {
	it("creates server-owned snapshots from an existing Master Profile source", async () => {
		setSelectResults([{ ...build }]);
		generateIdMock.mockReturnValue("selection-generated");

		const created = {
			...selectionItem,
			id: "selection-generated",
			selected: false,
			sortOrder: 0,
		};

		const { values } = mockInsertReturning([created]);

		const result = await cvmateBuildService.createSelectionItem({
			cvBuildId: "build-1",
			userId: "user-1",
			sourceType: "experience_fact",
			sourceId: "fact-1",
		});

		expect(values).toHaveBeenCalledWith({
			id: "selection-generated",
			cvBuildId: "build-1",
			parentSelectionItemId: null,
			sourceType: "experience_fact",
			sourceId: "fact-1",
			sourceTextSnapshot: experienceFact.text,
			sourceDataSnapshot: experienceFact,
			selected: false,
			sortOrder: 0,
		});

		expect(result).toEqual(created);
	});

	it("includes frozen custom section metadata in a custom section item snapshot", async () => {
		const customSection = {
			id: "custom-section-1",
			masterProfileId: "profile-1",
			kind: "custom" as const,
			title: "Additional Experience",
			isVisible: true,
			sortOrder: 20,
			createdAt: new Date("2026-09-08T10:00:00.000Z"),
			updatedAt: new Date("2026-09-08T10:00:00.000Z"),
		};
		const customItem = {
			id: "custom-item-1",
			profileSectionId: "custom-section-1",
			title: "Conference Speaker",
			subtitle: null,
			date: "2026",
			description: null,
			url: null,
			fields: null,
			sortOrder: 0,
			createdAt: new Date("2026-09-08T10:00:00.000Z"),
			updatedAt: new Date("2026-09-08T10:00:00.000Z"),
		};

		getCurrentProfileMock.mockResolvedValue({
			...masterProfile,
			sections: [customSection],
			customSectionItems: [customItem],
		});
		setSelectResults([{ ...build }]);
		generateIdMock.mockReturnValue("selection-custom-generated");

		const created = {
			...selectionItem,
			id: "selection-custom-generated",
			sourceType: "custom_section_item" as const,
			sourceId: "custom-item-1",
			sourceTextSnapshot: "Conference Speaker",
			sourceDataSnapshot: {
				...customItem,
				section: customSection,
			},
		};

		const { values } = mockInsertReturning([created]);

		await cvmateBuildService.createSelectionItem({
			cvBuildId: "build-1",
			userId: "user-1",
			sourceType: "custom_section_item",
			sourceId: "custom-item-1",
			selected: true,
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceType: "custom_section_item",
				sourceId: "custom-item-1",
				sourceTextSnapshot: "Conference Speaker",
				sourceDataSnapshot: {
					...customItem,
					section: customSection,
				},
			}),
		);
	});
	it("creates a deterministic text snapshot for an employment", async () => {
		setSelectResults([{ ...build }]);
		generateIdMock.mockReturnValue("selection-employment-generated");

		const created = {
			...employmentSelectionItem,
			id: "selection-employment-generated",
		};

		const { values } = mockInsertReturning([created]);

		await cvmateBuildService.createSelectionItem({
			cvBuildId: "build-1",
			userId: "user-1",
			sourceType: "employment",
			sourceId: "employment-1",
			selected: true,
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceTextSnapshot: "Operations Manager — Acme",
				sourceDataSnapshot: employment,
				selected: true,
			}),
		);
	});

	it("rejects a source that does not exist in the build Master Profile", async () => {
		setSelectResults([{ ...build }]);

		await expect(
			cvmateBuildService.createSelectionItem({
				cvBuildId: "build-1",
				userId: "user-1",
				sourceType: "experience_fact",
				sourceId: "missing-fact",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("rejects a parent selection item belonging to another CV build", async () => {
		const otherBuildParent = {
			...employmentSelectionItem,
			id: "selection-other-build",
			cvBuildId: "build-2",
		};

		setSelectResults([{ ...build }], [otherBuildParent], [{ ...secondBuild }]);

		await expect(
			cvmateBuildService.createSelectionItem({
				cvBuildId: "build-1",
				userId: "user-1",
				parentSelectionItemId: "selection-other-build",
				sourceType: "experience_fact",
				sourceId: "fact-1",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("allows an experience fact under an employment when the Master Profile links them", async () => {
		setSelectResults([{ ...build }], [{ ...employmentSelectionItem }], [{ ...build }]);

		generateIdMock.mockReturnValue("selection-fact-child");

		const created = {
			...selectionItem,
			id: "selection-fact-child",
			parentSelectionItemId: "selection-employment",
		};

		const { values } = mockInsertReturning([created]);

		await cvmateBuildService.createSelectionItem({
			cvBuildId: "build-1",
			userId: "user-1",
			parentSelectionItemId: "selection-employment",
			sourceType: "experience_fact",
			sourceId: "fact-1",
			selected: true,
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				parentSelectionItemId: "selection-employment",
				sourceType: "experience_fact",
				sourceId: "fact-1",
			}),
		);
	});

	it("rejects an experience fact under an employment when the Master Profile does not link them", async () => {
		setSelectResults([{ ...build }], [{ ...employmentSelectionItem }], [{ ...build }]);

		await expect(
			cvmateBuildService.createSelectionItem({
				cvBuildId: "build-1",
				userId: "user-1",
				parentSelectionItemId: "selection-employment",
				sourceType: "experience_fact",
				sourceId: "fact-unlinked",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.insert).not.toHaveBeenCalled();
	});
});

describe("cvmateBuildService.updateSelectionItem", () => {
	it("updates only user-editable selection fields", async () => {
		setSelectResults([{ ...selectionItem }], [{ ...build }]);

		const updated = {
			...selectionItem,
			selected: false,
			sortOrder: 5,
		};

		const { set } = mockUpdateReturning([updated]);

		const result = await cvmateBuildService.updateSelectionItem({
			id: "selection-1",
			userId: "user-1",
			selected: false,
			sortOrder: 5,
		});

		expect(set).toHaveBeenCalledWith({
			selected: false,
			sortOrder: 5,
		});

		expect(result).toEqual(updated);
	});

	it("rejects using the selection item itself as its parent", async () => {
		setSelectResults([{ ...selectionItem }], [{ ...build }]);

		await expect(
			cvmateBuildService.updateSelectionItem({
				id: "selection-1",
				userId: "user-1",
				parentSelectionItemId: "selection-1",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("rejects a parent hierarchy cycle", async () => {
		const cyclicParent = {
			...employmentSelectionItem,
			id: "selection-parent",
			parentSelectionItemId: "selection-1",
		};

		setSelectResults(
			[{ ...selectionItem }],
			[{ ...build }],
			[cyclicParent],
			[{ ...build }],
			[{ ...selectionItem }],
			[{ ...build }],
		);

		await expect(
			cvmateBuildService.updateSelectionItem({
				id: "selection-1",
				userId: "user-1",
				parentSelectionItemId: "selection-parent",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("rejects moving an experience fact under an unlinked employment", async () => {
		const unlinkedSelection = {
			...selectionItem,
			sourceId: "fact-unlinked",
			sourceTextSnapshot: unlinkedExperienceFact.text,
			sourceDataSnapshot: { ...unlinkedExperienceFact },
		};

		setSelectResults(
			[unlinkedSelection],
			[{ ...build }],
			[{ ...employmentSelectionItem }],
			[{ ...build }],
			[{ ...employmentSelectionItem }],
			[{ ...build }],
		);

		await expect(
			cvmateBuildService.updateSelectionItem({
				id: "selection-1",
				userId: "user-1",
				parentSelectionItemId: "selection-employment",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.update).not.toHaveBeenCalled();
	});
});

describe("cvmateBuildService.deleteSelectionItem", () => {
	it("deletes an owned selection item", async () => {
		setSelectResults([{ ...selectionItem }], [{ ...build }]);
		mockDeleteReturning([{ id: "selection-1" }]);

		await expect(
			cvmateBuildService.deleteSelectionItem({
				id: "selection-1",
				userId: "user-1",
			}),
		).resolves.toBeUndefined();

		expect(dbMock.delete).toHaveBeenCalled();
	});

	it("does not delete a selection item whose CV build is inaccessible", async () => {
		setSelectResults([{ ...selectionItem }], []);

		await expect(
			cvmateBuildService.deleteSelectionItem({
				id: "selection-1",
				userId: "user-other",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(dbMock.delete).not.toHaveBeenCalled();
	});
});
describe("cvmateBuildService.listGaps", () => {
	it("lists gaps only after verifying ownership of the CV build", async () => {
		setSelectResults([{ ...build }], [{ ...gap }]);

		const result = await cvmateBuildService.listGaps({
			cvBuildId: "build-1",
			userId: "user-1",
		});

		expect(result).toEqual([gap]);
	});

	it("rejects listing gaps for an inaccessible CV build", async () => {
		setSelectResults([]);

		await expect(
			cvmateBuildService.listGaps({
				cvBuildId: "build-other-user",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});

describe("cvmateBuildService.createGap", () => {
	it("creates a manual gap with server-owned defaults", async () => {
		setSelectResults([{ ...build }]);
		generateIdMock.mockReturnValue("gap-generated");

		const created = {
			...gap,
			id: "gap-generated",
			severity: "additional" as const,
		};

		const { values } = mockInsertReturning([created]);

		const result = await cvmateBuildService.createGap({
			cvBuildId: "build-1",
			userId: "user-1",
			text: "Missing advanced Excel experience.",
		});

		expect(values).toHaveBeenCalledWith({
			id: "gap-generated",
			cvBuildId: "build-1",
			jobRequirementId: null,
			requirementTextSnapshot: null,
			text: "Missing advanced Excel experience.",
			severity: "additional",
			origin: "user",
			status: "open",
			resolutionSourceType: null,
			resolutionSourceId: null,
			resolutionTextSnapshot: null,
			sortOrder: 0,
			resolvedAt: null,
		});

		expect(result).toEqual(created);
	});

	it("rejects creating a gap for an inaccessible CV build", async () => {
		setSelectResults([]);

		await expect(
			cvmateBuildService.createGap({
				cvBuildId: "build-other-user",
				userId: "user-1",
				text: "Missing requirement.",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(dbMock.insert).not.toHaveBeenCalled();
	});
});

describe("cvmateBuildService.updateGap", () => {
	it("updates user-editable gap fields", async () => {
		setSelectResults([{ ...gap }], [{ ...build }]);

		const updated = {
			...gap,
			text: "Updated gap text.",
			severity: "critical" as const,
			sortOrder: 4,
		};

		const { set } = mockUpdateReturning([updated]);

		const result = await cvmateBuildService.updateGap({
			id: "gap-1",
			userId: "user-1",
			text: "Updated gap text.",
			severity: "critical",
			sortOrder: 4,
		});

		expect(set).toHaveBeenCalledWith({
			text: "Updated gap text.",
			severity: "critical",
			sortOrder: 4,
			resolvedAt: null,
			resolutionSourceType: null,
			resolutionSourceId: null,
			resolutionTextSnapshot: null,
		});

		expect(result).toEqual(updated);
	});

	it("resolves a gap with a selected source from the same CV build", async () => {
		setSelectResults([{ ...gap }], [{ ...build }], [{ ...selectionItem }]);

		const updated = {
			...gap,
			status: "resolved" as const,
			resolutionSourceType: "experience_fact" as const,
			resolutionSourceId: "fact-1",
			resolutionTextSnapshot: experienceFact.text,
			resolvedAt: new Date("2026-09-09T12:30:00.000Z"),
		};

		const { set } = mockUpdateReturning([updated]);

		const result = await cvmateBuildService.updateGap({
			id: "gap-1",
			userId: "user-1",
			resolutionSourceType: "experience_fact",
			resolutionSourceId: "fact-1",
		});

		expect(set).toHaveBeenCalledWith({
			resolutionSourceType: "experience_fact",
			resolutionSourceId: "fact-1",
			resolutionTextSnapshot: experienceFact.text,
			status: "resolved",
			resolvedAt: expect.any(Date),
		});

		expect(result).toEqual(updated);
	});

	it("rejects a resolution source that is not selected in the same CV build", async () => {
		setSelectResults([{ ...gap }], [{ ...build }], []);

		await expect(
			cvmateBuildService.updateGap({
				id: "gap-1",
				userId: "user-1",
				resolutionSourceType: "experience_fact",
				resolutionSourceId: "fact-1",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("clears resolution metadata when a resolved gap is reopened", async () => {
		setSelectResults([{ ...resolvedGap }], [{ ...build }]);

		const updated = {
			...resolvedGap,
			status: "open" as const,
			resolutionSourceType: null,
			resolutionSourceId: null,
			resolutionTextSnapshot: null,
			resolvedAt: null,
		};

		const { set } = mockUpdateReturning([updated]);

		const result = await cvmateBuildService.updateGap({
			id: "gap-1",
			userId: "user-1",
			status: "open",
		});

		expect(set).toHaveBeenCalledWith({
			status: "open",
			resolvedAt: null,
			resolutionSourceType: null,
			resolutionSourceId: null,
			resolutionTextSnapshot: null,
		});

		expect(result).toEqual(updated);
	});
});

describe("cvmateBuildService.deleteGap", () => {
	it("deletes an owned gap", async () => {
		setSelectResults([{ ...gap }], [{ ...build }]);
		mockDeleteReturning([{ id: "gap-1" }]);

		await expect(
			cvmateBuildService.deleteGap({
				id: "gap-1",
				userId: "user-1",
			}),
		).resolves.toBeUndefined();

		expect(dbMock.delete).toHaveBeenCalled();
	});

	it("does not delete a gap whose CV build is inaccessible", async () => {
		setSelectResults([{ ...gap }], []);

		await expect(
			cvmateBuildService.deleteGap({
				id: "gap-1",
				userId: "user-other",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(dbMock.delete).not.toHaveBeenCalled();
	});
});
describe("cvmateBuildService.listGeneratedContent", () => {
	it("lists generated content only after verifying ownership of the CV build", async () => {
		setSelectResults([{ ...build }], [{ ...generatedContent }]);

		const result = await cvmateBuildService.listGeneratedContent({
			cvBuildId: "build-1",
			userId: "user-1",
		});

		expect(result).toEqual([generatedContent]);
	});

	it("rejects listing generated content for an inaccessible CV build", async () => {
		setSelectResults([]);

		await expect(
			cvmateBuildService.listGeneratedContent({
				cvBuildId: "build-other-user",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});

describe("cvmateBuildService.updateGeneratedContentFinalText", () => {
	it("updates only finalText on an owned generated content record", async () => {
		setSelectResults([{ ...generatedContent }], [{ ...build }]);

		const updated = {
			...generatedContent,
			finalText: "User-approved final experience text.",
		};

		const { set } = mockUpdateReturning([updated]);

		const result = await cvmateBuildService.updateGeneratedContentFinalText({
			id: "generated-1",
			userId: "user-1",
			finalText: "User-approved final experience text.",
		});

		expect(set).toHaveBeenCalledWith({
			finalText: "User-approved final experience text.",
		});

		expect(result).toEqual(updated);
	});

	it("clears the finalText override with null", async () => {
		const contentWithFinalText = {
			...generatedContent,
			finalText: "User-approved final experience text.",
		};

		setSelectResults([contentWithFinalText], [{ ...build }]);

		const updated = {
			...contentWithFinalText,
			finalText: null,
		};

		const { set } = mockUpdateReturning([updated]);

		const result = await cvmateBuildService.updateGeneratedContentFinalText({
			id: "generated-1",
			userId: "user-1",
			finalText: null,
		});

		expect(set).toHaveBeenCalledWith({
			finalText: null,
		});

		expect(result).toEqual(updated);
	});

	it("does not update generated content whose CV build is inaccessible", async () => {
		setSelectResults([{ ...generatedContent }], []);

		await expect(
			cvmateBuildService.updateGeneratedContentFinalText({
				id: "generated-1",
				userId: "user-other",
				finalText: "Unauthorized edit.",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(dbMock.update).not.toHaveBeenCalled();
	});
});
