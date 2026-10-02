import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyCoverLetterStyle } from "@reactive-resume/resume/cover-letter";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

const mocks = vi.hoisted(() => ({
	select: vi.fn(),
	predicates: [] as unknown[],
	getProfile: vi.fn(),
	listOffers: vi.fn(),
	getOffer: vi.fn(),
	listBuilds: vi.fn(),
	listApplications: vi.fn(),
}));
vi.mock("@reactive-resume/db/client", () => ({ db: { select: mocks.select } }));
vi.mock("@reactive-resume/db/schema", () => ({
	user: { id: "user.id" },
	resume: { userId: "resume.userId" },
	coverLetter: { userId: "coverLetter.userId" },
}));
vi.mock("drizzle-orm", () => ({ eq: (column: unknown, value: unknown) => ({ column, value }) }));
vi.mock("@reactive-resume/env/server", () => ({ env: {} }));
vi.mock("../storage/service", () => ({ getStorageService: vi.fn() }));
vi.mock("../cvmate-profile/service", () => ({ cvmateProfileService: { getCurrent: mocks.getProfile } }));
vi.mock("../cvmate-job-offer/service", () => ({
	cvmateJobOfferService: { list: mocks.listOffers, getById: mocks.getOffer },
}));
vi.mock("../cvmate-build/service", () => ({ cvmateBuildService: { list: mocks.listBuilds } }));
vi.mock("../applications/service", () => ({ applicationService: { list: mocks.listApplications } }));
const { authService } = await import("./service");

const letter = {
	id: "letter",
	name: "Saved",
	recipient: "",
	content: "<p>Body</p>",
	style: copyCoverLetterStyle(defaultResumeData),
	sourceResumeId: null,
	sourceApplicationId: null,
	revision: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
};

function queueSelects() {
	for (const rows of [[{ id: "owner", name: "Owner" }], [{ id: "resume", data: defaultResumeData }], [letter]]) {
		mocks.select.mockReturnValueOnce({
			from: () => ({
				where: (predicate: unknown) => {
					mocks.predicates.push(predicate);
					return Promise.resolve(rows);
				},
			}),
		});
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.predicates.length = 0;
	mocks.getProfile.mockResolvedValue(null);
	mocks.listOffers.mockResolvedValue([]);
	mocks.listBuilds.mockResolvedValue([]);
	mocks.listApplications.mockResolvedValue([]);
});

describe("account backup", () => {
	it("includes owned independent cover letters alongside embedded resume letters", async () => {
		queueSelects();
		const exported = await authService.exportData({ userId: "owner" });
		expect(exported).toMatchObject({ coverLetters: [letter], resumes: [{ id: "resume" }] });
		expect(mocks.predicates).toContainEqual({ column: "coverLetter.userId", value: "owner" });
	});

	it("includes master profile, job offers, builds and applications without storage keys", async () => {
		queueSelects();
		mocks.getProfile.mockResolvedValue({
			id: "profile",
			firstName: "Jan",
			photos: [{ id: "photo", filename: "a.jpg", storageKey: "uploads/owner/secret.jpg" }],
		});
		mocks.listOffers.mockResolvedValue([{ id: "offer" }]);
		mocks.getOffer.mockResolvedValue({
			id: "offer",
			assets: [{ id: "asset", filename: "o.pdf", storageKey: "uploads/owner/offer-secret.pdf" }],
			requirements: [],
		});
		mocks.listBuilds.mockResolvedValue([{ id: "build" }]);
		mocks.listApplications.mockResolvedValue([{ id: "application" }]);

		const exported = await authService.exportData({ userId: "owner" });

		expect(exported.masterProfile).toMatchObject({ id: "profile", firstName: "Jan" });
		expect(exported.masterProfile?.photos[0]).not.toHaveProperty("storageKey");
		expect(exported.jobOffers[0]?.assets[0]).not.toHaveProperty("storageKey");
		expect(exported.cvBuilds).toHaveLength(1);
		expect(exported.applications).toHaveLength(1);
		expect(mocks.listApplications).toHaveBeenCalledWith({ userId: "owner", includeArchived: true });
		expect(JSON.stringify(exported)).not.toContain("secret");
	});
});
