import { afterEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	SMTP_HOST: undefined as string | undefined,
	SMTP_USER: undefined as string | undefined,
	SMTP_PASS: undefined as string | undefined,
	SMTP_FROM: undefined as string | undefined,
	ONE_STORY_AI_PROVIDER: undefined as string | undefined,
	ONE_STORY_AI_MODEL: undefined as string | undefined,
	ONE_STORY_AI_API_KEY: undefined as string | undefined,
	ONE_STORY_AI_BASE_URL: undefined as string | undefined,
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

const { warnIfPlatformAiMisconfigured, warnIfSmtpNotConfigured } = await import("./checks");

afterEach(() => {
	envMock.SMTP_HOST = undefined;
	envMock.SMTP_USER = undefined;
	envMock.SMTP_PASS = undefined;
	envMock.SMTP_FROM = undefined;
	envMock.ONE_STORY_AI_PROVIDER = undefined;
	envMock.ONE_STORY_AI_MODEL = undefined;
	envMock.ONE_STORY_AI_API_KEY = undefined;
	envMock.ONE_STORY_AI_BASE_URL = undefined;
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

describe("warnIfSmtpNotConfigured", () => {
	it("warns in production when SMTP is incomplete", () => {
		vi.stubEnv("NODE_ENV", "production");
		envMock.SMTP_HOST = "smtp.example.com";
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		warnIfSmtpNotConfigured();

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(String(warnSpy.mock.calls[0]?.[0])).toContain("SMTP is not configured");
	});

	it("stays quiet in production when SMTP is fully configured", () => {
		vi.stubEnv("NODE_ENV", "production");
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		warnIfSmtpNotConfigured();

		expect(warnSpy).not.toHaveBeenCalled();
	});

	it.each([undefined, "development", "test"])("warns when SMTP is missing and NODE_ENV=%s", (nodeEnv) => {
		vi.stubEnv("NODE_ENV", nodeEnv);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		warnIfSmtpNotConfigured();

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(String(warnSpy.mock.calls[0]?.[0])).toContain("SMTP is not configured");
	});

	it("stays quiet without NODE_ENV when SMTP is fully configured", () => {
		vi.stubEnv("NODE_ENV", undefined);
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		warnIfSmtpNotConfigured();

		expect(warnSpy).not.toHaveBeenCalled();
	});
});

describe("warnIfPlatformAiMisconfigured", () => {
	// Fictional values only.
	const PLATFORM_KEY = "gsk_platform_fictional_key_123";
	const MODEL = "openai/gpt-oss-120b";

	function configure(provider: string | undefined, model: string | undefined, apiKey: string | undefined) {
		envMock.ONE_STORY_AI_PROVIDER = provider;
		envMock.ONE_STORY_AI_MODEL = model;
		envMock.ONE_STORY_AI_API_KEY = apiKey;
	}

	it("stays quiet when the platform provider is not configured", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		await warnIfPlatformAiMisconfigured();

		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("stays quiet when groq is fully configured", async () => {
		configure("groq", MODEL, PLATFORM_KEY);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		await warnIfPlatformAiMisconfigured();

		expect(warnSpy).not.toHaveBeenCalled();
	});

	it.each([
		["an unsupported provider", "openai", MODEL, PLATFORM_KEY, "only groq is"],
		["a missing key", "groq", MODEL, undefined, "must all be set"],
		["a missing model", "groq", undefined, PLATFORM_KEY, "must all be set"],
	])("warns once about %s without printing any value", async (_name, provider, model, apiKey, expected) => {
		configure(provider, model, apiKey);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		await warnIfPlatformAiMisconfigured();

		expect(warnSpy).toHaveBeenCalledOnce();
		const logged = JSON.stringify(warnSpy.mock.calls);
		expect(logged).toContain(expected);
		expect(logged).not.toContain(PLATFORM_KEY);
		expect(logged).not.toContain(MODEL);
		expect(logged).not.toContain('"openai"');
	});
});
