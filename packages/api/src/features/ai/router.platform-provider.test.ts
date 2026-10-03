import { beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "@orpc/server";
import z from "zod";

const mocks = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>,
	generateText: vi.fn(),
	getModel: vi.fn(() => ({ model: "mock" })),
	parsePdf: vi.fn(),
	getRunnableById: vi.fn(),
	getDefaultRunnable: vi.fn(),
	// Fictional data only.
	user: { id: "user-1", name: "Jan Kowalski", email: "jan.kowalski@example.com" },
}));

vi.mock("@reactive-resume/env/server", () => ({ env: mocks.env }));
vi.mock("@reactive-resume/auth/config", () => ({
	auth: { api: { getSession: vi.fn(async () => ({ user: mocks.user })) } },
	verifyOAuthToken: vi.fn(),
}));
vi.mock("@reactive-resume/db/client", () => ({ db: {} }));
vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateText: mocks.generateText,
}));
vi.mock("./service", () => ({
	getModel: mocks.getModel,
	aiService: { parsePdf: mocks.parsePdf },
	fileInputSchema: z.object({ name: z.string(), data: z.string() }),
}));
vi.mock("../ai-providers/service", () => ({
	aiProvidersService: {
		getRunnableById: mocks.getRunnableById,
		getDefaultRunnable: mocks.getDefaultRunnable,
	},
}));
vi.mock("../resume/service", () => ({ resumeService: {} }));
vi.mock("../cvmate-build/ai-redaction-context", () => ({ loadMasterProfileAiIdentity: vi.fn(async () => null) }));

const { aiRouter } = await import("./router");

// Fictional data only.
const PLATFORM_KEY = "gsk_platform_fictional_key_123";
const USER = mocks.user;
const CV_TEXT = [
	"Jan Kowalski",
	"jan.kowalski@example.com · +48 600 100 200",
	"Specjalista ds. logistyki",
	"2019–2024 Logistyka Sp. z o.o. — planowanie dostaw dla 40 sklepów",
].join("\n");

const context = { user: USER, reqHeaders: new Headers(), resHeaders: new Headers(), locale: "pl-PL" };

beforeEach(() => {
	vi.clearAllMocks();
	for (const key of Object.keys(mocks.env)) delete mocks.env[key];
	Object.assign(mocks.env, {
		ONE_STORY_AI_PROVIDER: "groq",
		ONE_STORY_AI_MODEL: "openai/gpt-oss-120b",
		ONE_STORY_AI_API_KEY: PLATFORM_KEY,
	});
	mocks.getDefaultRunnable.mockResolvedValue(null);
	mocks.generateText.mockResolvedValue({
		text: JSON.stringify({ summary: "Czytelne CV.", suggestions: [], strengths: [], jdAlignment: null }),
		usage: {},
	});
});

describe("ai.atsReview with the platform provider", () => {
	it("runs on the platform provider when the user has none, with the payload redacted", async () => {
		const review = await call(
			aiRouter.atsReview,
			{ extractedText: CV_TEXT, findings: [] },
			{ context: context as never },
		);

		expect(review.summary).toBe("Czytelne CV.");
		expect(mocks.getModel).toHaveBeenCalledWith(
			expect.objectContaining({ provider: "groq", model: "openai/gpt-oss-120b", apiKey: PLATFORM_KEY }),
		);

		// Same model settings as a groq provider saved on the account: default base URL, no provider options.
		expect(mocks.getModel).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "" }));
		expect(mocks.generateText.mock.calls[0]?.[0]).not.toHaveProperty("providerOptions");

		const payload = JSON.stringify(mocks.generateText.mock.calls[0]?.[0]);
		expect(payload).not.toContain("jan.kowalski@example.com");
		expect(payload).not.toContain("600 100 200");
		expect(payload).not.toContain("Kowalski");
		expect(payload).toContain("planowanie dostaw dla 40 sklepów");
		expect(payload).not.toContain(PLATFORM_KEY);
	});

	it("keeps the existing error when neither the user nor the platform has a provider", async () => {
		for (const key of Object.keys(mocks.env)) delete mocks.env[key];

		await expect(
			call(aiRouter.atsReview, { extractedText: CV_TEXT, findings: [] }, { context: context as never }),
		).rejects.toMatchObject({ code: "BAD_REQUEST", message: "No tested AI provider is available." });
		expect(mocks.generateText).not.toHaveBeenCalled();
	});

	it("never returns the platform key when the provider call fails", async () => {
		mocks.generateText.mockRejectedValueOnce(new Error("upstream failure"));

		const error = await call(
			aiRouter.atsReview,
			{ extractedText: CV_TEXT, findings: [] },
			{ context: context as never },
		).catch((thrown: unknown) => thrown);

		expect(JSON.stringify(error)).not.toContain(PLATFORM_KEY);
		expect(String((error as Error).message)).not.toContain(PLATFORM_KEY);
	});

	it("keeps the platform key out of the server log even when a provider error echoes it", async () => {
		const { logSafeError } = await import("@reactive-resume/utils/error-log");
		mocks.generateText.mockRejectedValueOnce(
			Object.assign(new Error(`Invalid API Key: ${PLATFORM_KEY}`), {
				name: "AI_APICallError",
				responseBody: JSON.stringify({ error: { message: `Invalid API Key: ${PLATFORM_KEY}` } }),
			}),
		);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const error = await call(
			aiRouter.atsReview,
			{ extractedText: CV_TEXT, findings: [] },
			{ context: context as never },
		).catch((thrown: unknown) => thrown);
		// The RPC handler logs a failed procedure exactly like this (apps/server/src/rpc/error-logging.ts).
		logSafeError("[oRPC Server]", error, { procedure: "ai.atsReview" });

		expect(errorSpy).toHaveBeenCalled();
		expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(PLATFORM_KEY);
		// What the RPC handler sends to the browser for this error.
		const { toORPCError } = await import("@orpc/client");
		expect(JSON.stringify(toORPCError(error).toJSON())).not.toContain(PLATFORM_KEY);
		errorSpy.mockRestore();
	});
});

describe("ai.parsePdf never uses the platform provider", () => {
	it("fails without a provider of the user's own, even with the platform configured", async () => {
		await expect(
			call(aiRouter.parsePdf, { file: { name: "cv.pdf", data: "JVBERi0=" } }, { context: context as never }),
		).rejects.toMatchObject({ code: "BAD_REQUEST", message: "No tested AI provider is available." });
		expect(mocks.parsePdf).not.toHaveBeenCalled();
	});
});
