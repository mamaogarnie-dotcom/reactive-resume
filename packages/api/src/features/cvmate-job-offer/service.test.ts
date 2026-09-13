import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	transaction: vi.fn(),
}));

const uploadFileMock = vi.hoisted(() => vi.fn());
const storageDeleteMock = vi.hoisted(() => vi.fn());
const inspectImageUploadMock = vi.hoisted(() => vi.fn());
const hasPdfSignatureMock = vi.hoisted(() => vi.fn());
const generateIdMock = vi.hoisted(() => vi.fn());

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

vi.mock("@reactive-resume/db/schema", () => ({
	cvmateJobOffer: {
		id: "offer_id",
		userId: "user_id",
		updatedAt: "updated_at",
	},
	cvmateJobOfferAsset: {
		id: "asset_id",
		jobOfferId: "job_offer_id",
		storageKey: "storage_key",
		sortOrder: "sort_order",
		createdAt: "created_at",
	},
	cvmateJobRequirement: {
		id: "requirement_id",
		jobOfferId: "job_offer_id",
		sortOrder: "sort_order",
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

vi.mock("../storage/service", () => ({
	MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
	uploadFile: uploadFileMock,
	inspectImageUpload: inspectImageUploadMock,
	hasPdfSignature: hasPdfSignatureMock,
	getStorageService: () => ({
		delete: storageDeleteMock,
	}),
}));

const { cvmateJobOfferService } = await import("./service");

const offer = {
	id: "offer-1",
	userId: "user-1",
	sourceUrl: "https://example.com/jobs/1",
	rawText: "Job offer text",
	roleTitle: "Operations Manager",
	companyName: "Acme",
	location: "Wroclaw",
	language: "pl",
	analysisStatus: "analyzed" as const,
	analyzedAt: new Date("2026-09-09T08:00:00.000Z"),
	createdAt: new Date("2026-09-09T07:00:00.000Z"),
	updatedAt: new Date("2026-09-09T08:00:00.000Z"),
};

const asset = {
	id: "asset-1",
	jobOfferId: "offer-1",
	storageKey: "uploads/user-1/pictures/job-offer.png",
	filename: "job-offer.png",
	mediaType: "image/png",
	size: 3,
	width: 1200,
	height: 2000,
	sortOrder: 0,
	createdAt: new Date("2026-09-09T07:30:00.000Z"),
};

const requirement = {
	id: "requirement-1",
	jobOfferId: "offer-1",
	category: "required" as const,
	priority: "critical" as const,
	sourceText: "Minimum 3 years of experience",
	text: "3 years of experience",
	isUserEdited: false,
	sortOrder: 0,
	createdAt: new Date("2026-09-09T07:40:00.000Z"),
	updatedAt: new Date("2026-09-09T07:40:00.000Z"),
};

const createSelectChain = (rows: unknown[]) => {
	const whereResult = {
		orderBy: vi.fn(() => Promise.resolve(rows)),
		// biome-ignore lint/suspicious/noThenProperty: Intentional thenable mock for Drizzle query behavior.
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
	dbMock.transaction.mockReset();
	dbMock.transaction.mockImplementation((callback) => callback(dbMock));

	uploadFileMock.mockReset();
	storageDeleteMock.mockReset();
	inspectImageUploadMock.mockReset();
	hasPdfSignatureMock.mockReset();
	generateIdMock.mockReset();

	generateIdMock.mockReturnValue("generated-id");

	uploadFileMock.mockResolvedValue({
		key: "uploads/user-1/pictures/job-offer.png",
		url: "http://localhost:3000/api/uploads/user-1/pictures/job-offer.png",
	});

	storageDeleteMock.mockResolvedValue(true);
	inspectImageUploadMock.mockResolvedValue({
		width: 1200,
		height: 2000,
		mediaType: "image/png",
	});
	hasPdfSignatureMock.mockReturnValue(true);

	setSelectResults([]);
});

describe("cvmateJobOfferService.list", () => {
	it("returns only public job-offer data without userId", async () => {
		setSelectResults([{ ...offer }]);

		const result = await cvmateJobOfferService.list({
			userId: "user-1",
		});

		expect(result).toEqual([
			{
				id: offer.id,
				sourceUrl: offer.sourceUrl,
				rawText: offer.rawText,
				roleTitle: offer.roleTitle,
				companyName: offer.companyName,
				location: offer.location,
				language: offer.language,
				analysisStatus: offer.analysisStatus,
				analyzedAt: offer.analyzedAt,
				createdAt: offer.createdAt,
				updatedAt: offer.updatedAt,
			},
		]);

		expect(result.at(0)).not.toHaveProperty("userId");
	});
});

describe("cvmateJobOfferService.getById", () => {
	it("returns an owned offer together with assets and requirements", async () => {
		setSelectResults([{ ...offer }], [{ ...asset }], [{ ...requirement }]);

		const result = await cvmateJobOfferService.getById({
			id: "offer-1",
			userId: "user-1",
		});

		expect(result).not.toHaveProperty("userId");
		expect(result.assets).toEqual([asset]);
		expect(result.requirements).toEqual([requirement]);
	});

	it("returns NOT_FOUND when the offer does not belong to the user", async () => {
		setSelectResults([]);

		await expect(
			cvmateJobOfferService.getById({
				id: "offer-other-user",
				userId: "user-1",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});

describe("cvmateJobOfferService.create", () => {
	it("creates an offer owned by the authenticated user", async () => {
		const { values } = mockInsertReturning([]);

		const result = await cvmateJobOfferService.create({
			userId: "user-1",
			rawText: "Job offer text",
			roleTitle: "Operations Manager",
		});

		expect(values).toHaveBeenCalledWith({
			id: "generated-id",
			userId: "user-1",
			rawText: "Job offer text",
			roleTitle: "Operations Manager",
		});

		expect(result).toBe("generated-id");
	});
});

describe("cvmateJobOfferService.update", () => {
	it("resets analysis when source text changes", async () => {
		const updatedOffer = {
			...offer,
			rawText: "Updated source text",
			analysisStatus: "pending" as const,
			analyzedAt: null,
		};

		setSelectResults([{ ...offer }], [updatedOffer], [{ ...asset }], [{ ...requirement }]);

		const { set } = mockUpdateReturning([{ id: "offer-1" }]);

		const result = await cvmateJobOfferService.update({
			id: "offer-1",
			userId: "user-1",
			rawText: "Updated source text",
		});

		expect(set).toHaveBeenCalledWith({
			rawText: "Updated source text",
			analysisStatus: "pending",
			analyzedAt: null,
		});

		expect(result.analysisStatus).toBe("pending");
		expect(result.analyzedAt).toBeNull();
	});

	it("does not reset analysis when only descriptive metadata changes", async () => {
		const updatedOffer = {
			...offer,
			roleTitle: "Senior Operations Manager",
		};

		setSelectResults([{ ...offer }], [updatedOffer], [], []);

		const { set } = mockUpdateReturning([{ id: "offer-1" }]);

		await cvmateJobOfferService.update({
			id: "offer-1",
			userId: "user-1",
			roleTitle: "Senior Operations Manager",
		});

		expect(set).toHaveBeenCalledWith({
			roleTitle: "Senior Operations Manager",
		});
	});
});

describe("cvmateJobOfferService.delete", () => {
	it("deletes the offer and then cleans up its stored assets", async () => {
		setSelectResults([{ ...offer }], [{ storageKey: asset.storageKey }]);

		mockDeleteReturning([{ id: "offer-1" }]);

		await expect(
			cvmateJobOfferService.delete({
				id: "offer-1",
				userId: "user-1",
			}),
		).resolves.toBeUndefined();

		expect(storageDeleteMock).toHaveBeenCalledWith(asset.storageKey);
	});
});

describe("cvmateJobOfferService.uploadAsset", () => {
	it("preserves original image bytes, stores metadata, and resets analysis atomically", async () => {
		setSelectResults([{ ...offer }]);

		const uploadedAsset = {
			...asset,
			id: "generated-id",
			filename: "screenshot.png",
			sortOrder: 2,
		};

		const { values } = mockInsertReturning([uploadedAsset]);
		const { set } = mockUpdateReturning([{ id: "offer-1" }]);

		const file = new File([new Uint8Array([9, 8, 7])], "screenshot.png", {
			type: "image/png",
		});

		const result = await cvmateJobOfferService.uploadAsset({
			jobOfferId: "offer-1",
			userId: "user-1",
			file,
			sortOrder: 2,
		});

		expect(uploadFileMock).toHaveBeenCalledWith({
			userId: "user-1",
			data: new Uint8Array([9, 8, 7]),
			contentType: "image/png",
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "generated-id",
				jobOfferId: "offer-1",
				storageKey: "uploads/user-1/pictures/job-offer.png",
				filename: "screenshot.png",
				mediaType: "image/png",
				size: 3,
				width: 1200,
				height: 2000,
				sortOrder: 2,
			}),
		);

		expect(set).toHaveBeenCalledWith({
			analysisStatus: "pending",
			analyzedAt: null,
		});

		expect(dbMock.transaction).toHaveBeenCalledTimes(1);
		expect(result).toEqual(uploadedAsset);
	});

	it("rejects unsupported file types before upload", async () => {
		setSelectResults([{ ...offer }]);

		const file = new File([new Uint8Array([1])], "offer.txt", {
			type: "text/plain",
		});

		await expect(
			cvmateJobOfferService.uploadAsset({
				jobOfferId: "offer-1",
				userId: "user-1",
				file,
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(uploadFileMock).not.toHaveBeenCalled();
		expect(dbMock.transaction).not.toHaveBeenCalled();
	});

	it("rejects oversized files even when the service is called directly", async () => {
		setSelectResults([{ ...offer }]);

		const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
		const file = {
			arrayBuffer,
			name: "offer.pdf",
			size: 10 * 1024 * 1024 + 1,
			type: "application/pdf",
		} as unknown as File;

		await expect(
			cvmateJobOfferService.uploadAsset({
				jobOfferId: "offer-1",
				userId: "user-1",
				file,
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(arrayBuffer).not.toHaveBeenCalled();
		expect(uploadFileMock).not.toHaveBeenCalled();
	});

	it("rejects a PDF whose bytes do not have a PDF signature", async () => {
		setSelectResults([{ ...offer }]);
		hasPdfSignatureMock.mockReturnValueOnce(false);

		const file = new File([new TextEncoder().encode("<html>not a pdf</html>")], "offer.pdf", {
			type: "application/pdf",
		});

		await expect(
			cvmateJobOfferService.uploadAsset({
				jobOfferId: "offer-1",
				userId: "user-1",
				file,
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(uploadFileMock).not.toHaveBeenCalled();
		expect(dbMock.transaction).not.toHaveBeenCalled();
	});

	it("rejects image content that does not match the declared media type", async () => {
		setSelectResults([{ ...offer }]);
		inspectImageUploadMock.mockRejectedValueOnce(new Error("Image content does not match its declared media type"));

		const file = new File([new Uint8Array([1, 2, 3])], "offer.png", {
			type: "image/png",
		});

		await expect(
			cvmateJobOfferService.uploadAsset({
				jobOfferId: "offer-1",
				userId: "user-1",
				file,
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(uploadFileMock).not.toHaveBeenCalled();
		expect(dbMock.transaction).not.toHaveBeenCalled();
	});

	it("removes the uploaded file when the database transaction fails", async () => {
		setSelectResults([{ ...offer }]);

		mockInsertReturning([{ ...asset }]);
		mockUpdateReturning([]);

		const file = new File([new Uint8Array([9, 8, 7])], "job-offer.png", {
			type: "image/png",
		});

		await expect(
			cvmateJobOfferService.uploadAsset({
				jobOfferId: "offer-1",
				userId: "user-1",
				file,
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(storageDeleteMock).toHaveBeenCalledWith("uploads/user-1/pictures/job-offer.png");
	});
});

describe("cvmateJobOfferService.updateAsset", () => {
	it("blocks access to an asset whose parent offer is not owned by the user", async () => {
		setSelectResults([{ ...asset }], []);

		await expect(
			cvmateJobOfferService.updateAsset({
				id: "asset-1",
				userId: "user-1",
				sortOrder: 3,
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(dbMock.update).not.toHaveBeenCalled();
	});
});

describe("cvmateJobOfferService.deleteAsset", () => {
	it("deletes the asset, resets analysis in the transaction, and then removes storage", async () => {
		setSelectResults([{ ...asset }], [{ ...offer }]);

		mockDeleteReturning([{ id: "asset-1" }]);
		const { set } = mockUpdateReturning([{ id: "offer-1" }]);

		await expect(
			cvmateJobOfferService.deleteAsset({
				id: "asset-1",
				userId: "user-1",
			}),
		).resolves.toBeUndefined();

		expect(dbMock.transaction).toHaveBeenCalledTimes(1);
		expect(set).toHaveBeenCalledWith({
			analysisStatus: "pending",
			analyzedAt: null,
		});
		expect(storageDeleteMock).toHaveBeenCalledWith(asset.storageKey);
	});
});

describe("cvmateJobOfferService.createRequirement", () => {
	it("marks manually created requirements as user edited", async () => {
		setSelectResults([{ ...offer }]);

		const manualRequirement = {
			...requirement,
			id: "generated-id",
			text: "Driving licence category B",
			isUserEdited: true,
		};

		const { values } = mockInsertReturning([manualRequirement]);

		const result = await cvmateJobOfferService.createRequirement({
			jobOfferId: "offer-1",
			userId: "user-1",
			text: "Driving licence category B",
			category: "required",
			priority: "important",
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "generated-id",
				jobOfferId: "offer-1",
				text: "Driving licence category B",
				category: "required",
				priority: "important",
				isUserEdited: true,
			}),
		);

		expect(result.isUserEdited).toBe(true);
	});
});

describe("cvmateJobOfferService.updateRequirement", () => {
	it("marks a manually updated requirement as user edited", async () => {
		setSelectResults([{ ...requirement }], [{ ...offer }]);

		const updatedRequirement = {
			...requirement,
			text: "At least 5 years of experience",
			isUserEdited: true,
		};

		const { set } = mockUpdateReturning([updatedRequirement]);

		const result = await cvmateJobOfferService.updateRequirement({
			id: "requirement-1",
			userId: "user-1",
			text: "At least 5 years of experience",
		});

		expect(set).toHaveBeenCalledWith({
			text: "At least 5 years of experience",
			isUserEdited: true,
		});

		expect(result.isUserEdited).toBe(true);
	});
});

describe("cvmateJobOfferService.deleteRequirement", () => {
	it("deletes only a requirement belonging to an owned offer", async () => {
		setSelectResults([{ ...requirement }], [{ ...offer }]);

		const { returning } = mockDeleteReturning([{ id: "requirement-1" }]);

		await expect(
			cvmateJobOfferService.deleteRequirement({
				id: "requirement-1",
				userId: "user-1",
			}),
		).resolves.toBeUndefined();

		expect(returning).toHaveBeenCalledTimes(1);
	});
});
