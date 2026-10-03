import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORPCError } from "@orpc/client";

const mocks = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>,
	getRunnableById: vi.fn(),
	getDefaultRunnable: vi.fn(),
}));

vi.mock("@reactive-resume/env/server", () => ({ env: mocks.env }));
vi.mock("../ai-providers/service", () => ({
	aiProvidersService: {
		getRunnableById: mocks.getRunnableById,
		getDefaultRunnable: mocks.getDefaultRunnable,
	},
}));

const { getPlatformAiConfigIssue, getPlatformCvmateProvider, isPlatformAiProviderAvailable, resolveCvmateAiProvider } =
	await import("./service");

// Fictional values only.
const PLATFORM_KEY = "gsk_platform_fictional_key_123";
const USER_KEY = "sk-user-fictional-key-456";

const userProvider = (id: string) => ({
	id,
	label: "Mine",
	provider: "openai" as const,
	model: "gpt-4o-mini",
	apiKey: USER_KEY,
	baseURL: "",
	enabled: true,
	testStatus: "success",
});

function setPlatformEnv(values: Record<string, string | undefined>) {
	for (const key of Object.keys(mocks.env)) delete mocks.env[key];
	Object.assign(mocks.env, values);
}

const GROQ_ENV = {
	ONE_STORY_AI_PROVIDER: "groq",
	ONE_STORY_AI_MODEL: "openai/gpt-oss-120b",
	ONE_STORY_AI_API_KEY: PLATFORM_KEY,
};

beforeEach(() => {
	vi.clearAllMocks();
	setPlatformEnv({});
	mocks.getDefaultRunnable.mockResolvedValue(null);
});

describe("resolveCvmateAiProvider", () => {
	it("1. uses the provider the user chose", async () => {
		setPlatformEnv(GROQ_ENV);
		mocks.getRunnableById.mockResolvedValueOnce(userProvider("chosen"));

		const provider = await resolveCvmateAiProvider({ userId: "user-1", aiProviderId: "chosen" });

		expect(provider).toEqual({
			id: "chosen",
			provider: "openai",
			model: "gpt-4o-mini",
			apiKey: USER_KEY,
			baseURL: "",
		});
		expect(mocks.getRunnableById).toHaveBeenCalledWith({ id: "chosen", userId: "user-1" });
		expect(mocks.getDefaultRunnable).not.toHaveBeenCalled();
	});

	it("1b. never falls back when the chosen provider is not tested and enabled", async () => {
		setPlatformEnv(GROQ_ENV);
		const notTested = new ORPCError("BAD_REQUEST", { message: "AI provider must be tested and enabled before use." });
		mocks.getRunnableById.mockRejectedValueOnce(notTested);

		await expect(resolveCvmateAiProvider({ userId: "user-1", aiProviderId: "chosen" })).rejects.toBe(notTested);
	});

	it("2. uses the user's default tested provider before the platform", async () => {
		setPlatformEnv(GROQ_ENV);
		mocks.getDefaultRunnable.mockResolvedValueOnce(userProvider("default"));

		const provider = await resolveCvmateAiProvider({ userId: "user-1" });

		expect(provider.id).toBe("default");
		expect(provider.apiKey).toBe(USER_KEY);
	});

	it("3. falls back to the platform provider", async () => {
		setPlatformEnv({ ...GROQ_ENV, ONE_STORY_AI_BASE_URL: "https://api.groq.com/openai/v1" });

		const provider = await resolveCvmateAiProvider({ userId: "user-1" });

		expect(provider).toEqual({
			id: null,
			provider: "groq",
			model: "openai/gpt-oss-120b",
			apiKey: PLATFORM_KEY,
			baseURL: "https://api.groq.com/openai/v1",
		});
	});

	it("4. keeps the existing error when nothing is available", async () => {
		const error = await resolveCvmateAiProvider({ userId: "user-1" }).catch((thrown: unknown) => thrown);

		expect(error).toBeInstanceOf(ORPCError);
		expect(error).toMatchObject({ code: "BAD_REQUEST", message: "No tested AI provider is available." });
	});

	it("no longer bootstraps Gemini from GOOGLE_CLOUD_API_KEY", async () => {
		vi.stubEnv("GOOGLE_CLOUD_API_KEY", "fictional-fonts-key");

		await expect(resolveCvmateAiProvider({ userId: "user-1" })).rejects.toMatchObject({
			message: "No tested AI provider is available.",
		});
		expect(getPlatformCvmateProvider()).toBeNull();

		vi.unstubAllEnvs();
	});
});

describe("platform provider configuration", () => {
	it("is silent and unavailable when nothing is set", () => {
		expect(getPlatformCvmateProvider()).toBeNull();
		expect(isPlatformAiProviderAvailable()).toBe(false);
		expect(getPlatformAiConfigIssue()).toBeNull();
	});

	it("is available with groq, a model and a key", () => {
		setPlatformEnv({ ...GROQ_ENV, ONE_STORY_AI_PROVIDER: " groq " });

		expect(isPlatformAiProviderAvailable()).toBe(true);
		expect(getPlatformAiConfigIssue()).toBeNull();
	});

	it.each([
		["openai", "unsupported_provider"],
		["gemini", "unsupported_provider"],
		["GROQ", "unsupported_provider"],
		["not-a-provider", "unsupported_provider"],
	])("rejects provider %s", (provider, issue) => {
		setPlatformEnv({ ...GROQ_ENV, ONE_STORY_AI_PROVIDER: provider });

		expect(getPlatformCvmateProvider()).toBeNull();
		expect(getPlatformAiConfigIssue()).toBe(issue);
	});

	it.each([
		["the key", { ONE_STORY_AI_API_KEY: undefined }],
		["the model", { ONE_STORY_AI_MODEL: "  " }],
		["the provider", { ONE_STORY_AI_PROVIDER: undefined }],
	])("is incomplete without %s", (_name, override) => {
		setPlatformEnv({ ...GROQ_ENV, ...override });

		expect(getPlatformCvmateProvider()).toBeNull();
		expect(getPlatformAiConfigIssue()).toBe("incomplete");
	});

	it("never exposes the key through the config issue or the resolver's error", async () => {
		setPlatformEnv({ ...GROQ_ENV, ONE_STORY_AI_PROVIDER: "openai" });

		const error = await resolveCvmateAiProvider({ userId: "user-1" }).catch((thrown: unknown) => thrown);

		expect(JSON.stringify(getPlatformAiConfigIssue())).not.toContain(PLATFORM_KEY);
		expect(String((error as Error).message)).not.toContain(PLATFORM_KEY);
		expect(JSON.stringify(error)).not.toContain(PLATFORM_KEY);
	});
});
