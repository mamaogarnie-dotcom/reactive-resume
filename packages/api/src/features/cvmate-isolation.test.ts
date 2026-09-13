import { createRouterClient, ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	verifyApiKey: vi.fn(),
	verifyOAuthToken: vi.fn(),
}));

const profileServiceMock = vi.hoisted(() => ({
	deleteEmployment: vi.fn(),
}));

const jobOfferServiceMock = vi.hoisted(() => ({
	getById: vi.fn(),
}));

const jobOfferAnalysisServiceMock = vi.hoisted(() => ({
	analyze: vi.fn(),
}));

const buildServiceMock = vi.hoisted(() => ({
	getById: vi.fn(),
}));

const materializeServiceMock = vi.hoisted(() => ({
	materialize: vi.fn(),
}));

const recommendationsServiceMock = vi.hoisted(() => ({
	generate: vi.fn(),
}));

const tailoredContentServiceMock = vi.hoisted(() => ({
	generate: vi.fn(),
}));

vi.mock("@reactive-resume/auth/config", () => ({
	auth: {
		api: {
			getSession: authMocks.getSession,
			verifyApiKey: authMocks.verifyApiKey,
		},
	},
	verifyOAuthToken: authMocks.verifyOAuthToken,
}));

vi.mock("../middleware/rate-limit", async () => {
	const { os } = await import("@orpc/server");
	const passThrough = os.middleware(({ context, next }) => next({ context }));

	return {
		aiRequestRateLimit: passThrough,
		resumeMutationRateLimit: passThrough,
		storageUploadRateLimit: passThrough,
	};
});

vi.mock("./cvmate-profile/service", () => ({
	cvmateProfileService: profileServiceMock,
}));

vi.mock("./cvmate-job-offer/service", () => ({
	cvmateJobOfferService: jobOfferServiceMock,
}));

vi.mock("./cvmate-job-offer/analysis", () => ({
	cvmateJobOfferAnalysisService: jobOfferAnalysisServiceMock,
}));

vi.mock("./cvmate-build/service", () => ({
	cvmateBuildService: buildServiceMock,
}));

vi.mock("./cvmate-build/materialize", () => ({
	cvmateBuildMaterializeService: materializeServiceMock,
}));

vi.mock("./cvmate-build/recommendations", () => ({
	cvmateBuildRecommendationsService: recommendationsServiceMock,
}));

vi.mock("./cvmate-build/tailored-content", () => ({
	cvmateBuildTailoredContentService: tailoredContentServiceMock,
}));

const { cvmateProfileRouter } = await import("./cvmate-profile/router");
const { cvmateJobOfferRouter } = await import("./cvmate-job-offer/router");
const { cvmateBuildRouter } = await import("./cvmate-build/router");

const clientContext = {
	locale: "en-US" as const,
	reqHeaders: new Headers(),
};

const profileClient = createRouterClient(cvmateProfileRouter, { context: clientContext });
const jobOfferClient = createRouterClient(cvmateJobOfferRouter, { context: clientContext });
const buildClient = createRouterClient(cvmateBuildRouter, { context: clientContext });

const notFound = () => new ORPCError("NOT_FOUND");

beforeEach(() => {
	vi.clearAllMocks();

	authMocks.getSession.mockResolvedValue({
		user: {
			id: "attacker-user",
			email: "attacker@example.test",
		},
	});

	authMocks.verifyApiKey.mockResolvedValue({ key: null, valid: false });
	authMocks.verifyOAuthToken.mockResolvedValue(null);
});

describe("1story API cross-user isolation", () => {
	it("rejects 1story resource access before service execution when the request is unauthenticated", async () => {
		authMocks.getSession.mockResolvedValueOnce(null);

		await expect(jobOfferClient.getById({ id: "offer-victim" })).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});

		expect(jobOfferServiceMock.getById).not.toHaveBeenCalled();
	});

	it("binds Master Profile child mutations to the authenticated user", async () => {
		profileServiceMock.deleteEmployment.mockRejectedValueOnce(notFound());

		await expect(profileClient.deleteEmployment({ id: "employment-victim" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(profileServiceMock.deleteEmployment).toHaveBeenCalledExactlyOnceWith({
			id: "employment-victim",
			userId: "attacker-user",
		});
	});

	it("binds Job Offer reads and AI analysis to the authenticated user", async () => {
		jobOfferServiceMock.getById.mockRejectedValueOnce(notFound());
		jobOfferAnalysisServiceMock.analyze.mockRejectedValueOnce(notFound());

		await expect(jobOfferClient.getById({ id: "offer-victim" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(jobOfferClient.analyze({ id: "offer-victim" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(jobOfferServiceMock.getById).toHaveBeenCalledExactlyOnceWith({
			id: "offer-victim",
			userId: "attacker-user",
		});
		expect(jobOfferAnalysisServiceMock.analyze).toHaveBeenCalledExactlyOnceWith({
			id: "offer-victim",
			userId: "attacker-user",
		});
	});

	it("binds CV Build reads, AI generation, and materialization to the authenticated user", async () => {
		buildServiceMock.getById.mockRejectedValueOnce(notFound());
		recommendationsServiceMock.generate.mockRejectedValueOnce(notFound());
		tailoredContentServiceMock.generate.mockRejectedValueOnce(notFound());
		materializeServiceMock.materialize.mockRejectedValueOnce(notFound());

		await expect(buildClient.getById({ id: "build-victim" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(buildClient.generateRecommendations({ id: "build-victim" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(buildClient.generateTailoredContent({ id: "build-victim" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(buildClient.materialize({ id: "build-victim" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(buildServiceMock.getById).toHaveBeenCalledExactlyOnceWith({
			id: "build-victim",
			userId: "attacker-user",
		});
		expect(recommendationsServiceMock.generate).toHaveBeenCalledExactlyOnceWith({
			id: "build-victim",
			userId: "attacker-user",
		});
		expect(tailoredContentServiceMock.generate).toHaveBeenCalledExactlyOnceWith({
			id: "build-victim",
			userId: "attacker-user",
		});
		expect(materializeServiceMock.materialize).toHaveBeenCalledExactlyOnceWith({
			id: "build-victim",
			userId: "attacker-user",
		});
	});
});
