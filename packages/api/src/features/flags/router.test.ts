import { beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "@orpc/server";

const mocks = vi.hoisted(() => ({
	env: {
		FLAG_DISABLE_SIGNUPS: false,
		FLAG_DISABLE_EMAIL_AUTH: false,
		FLAG_REQUIRE_EMAIL_VERIFICATION: false,
	} as Record<string, string | boolean | undefined>,
}));

vi.mock("@reactive-resume/env/server", () => ({ env: mocks.env }));
vi.mock("@reactive-resume/auth/config", () => ({
	auth: { api: { getSession: vi.fn(async () => null) } },
	verifyOAuthToken: vi.fn(),
}));
vi.mock("@reactive-resume/db/client", () => ({ db: {} }));
vi.mock("../ai-providers/service", () => ({ aiProvidersService: {} }));

const { flagsRouter } = await import("./router");

// Fictional values only.
const PLATFORM_KEY = "gsk_platform_fictional_key_123";
const context = { reqHeaders: new Headers(), resHeaders: new Headers(), locale: "pl-PL" };

beforeEach(() => {
	delete mocks.env.ONE_STORY_AI_PROVIDER;
	delete mocks.env.ONE_STORY_AI_MODEL;
	delete mocks.env.ONE_STORY_AI_API_KEY;
});

describe("flags.get platformAiEnabled", () => {
	it("is false without the platform provider", async () => {
		const flags = await call(flagsRouter.get, undefined, { context: context as never });

		expect(flags.platformAiEnabled).toBe(false);
	});

	it("is true with groq configured, and never carries the configuration", async () => {
		Object.assign(mocks.env, {
			ONE_STORY_AI_PROVIDER: "groq",
			ONE_STORY_AI_MODEL: "openai/gpt-oss-120b",
			ONE_STORY_AI_API_KEY: PLATFORM_KEY,
		});

		const flags = await call(flagsRouter.get, undefined, { context: context as never });
		const body = JSON.stringify(flags);

		expect(flags.platformAiEnabled).toBe(true);
		expect(body).not.toContain(PLATFORM_KEY);
		expect(body).not.toContain("gpt-oss");
		expect(body).not.toContain("groq");
	});

	it("is false for an unsupported provider", async () => {
		Object.assign(mocks.env, {
			ONE_STORY_AI_PROVIDER: "openai",
			ONE_STORY_AI_MODEL: "gpt-4o-mini",
			ONE_STORY_AI_API_KEY: PLATFORM_KEY,
		});

		const flags = await call(flagsRouter.get, undefined, { context: context as never });

		expect(flags.platformAiEnabled).toBe(false);
	});
});
