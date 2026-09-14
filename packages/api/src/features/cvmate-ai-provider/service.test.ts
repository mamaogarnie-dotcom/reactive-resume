import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
ONE_STORY_AI_PROVIDER: undefined as string | undefined,
ONE_STORY_AI_MODEL: undefined as string | undefined,
ONE_STORY_AI_API_KEY: undefined as string | undefined,
ONE_STORY_AI_BASE_URL: undefined as string | undefined,
GOOGLE_CLOUD_API_KEY: undefined as string | undefined,
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

import { getPlatformCvmateProvider } from "./service";

function resetEnv() {
envMock.ONE_STORY_AI_PROVIDER = undefined;
envMock.ONE_STORY_AI_MODEL = undefined;
envMock.ONE_STORY_AI_API_KEY = undefined;
envMock.ONE_STORY_AI_BASE_URL = undefined;
envMock.GOOGLE_CLOUD_API_KEY = undefined;
}

describe("1story platform AI provider", () => {
beforeEach(() => {
resetEnv();
vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
vi.unstubAllEnvs();
});

it("returns null when platform AI is not configured", () => {
expect(getPlatformCvmateProvider()).toBeNull();
});

it("uses explicit provider-agnostic 1story configuration", () => {
envMock.ONE_STORY_AI_PROVIDER = "openai";
envMock.ONE_STORY_AI_MODEL = "test-model";
envMock.ONE_STORY_AI_API_KEY = "test-key";

expect(getPlatformCvmateProvider()).toEqual({
id: null,
provider: "openai",
model: "test-model",
apiKey: "test-key",
baseURL: null,
});
});

it("rejects partial explicit configuration", () => {
envMock.ONE_STORY_AI_PROVIDER = "openai";

expect(() => getPlatformCvmateProvider()).toThrow(
"ONE_STORY_PLATFORM_AI_CONFIGURATION_INVALID",
);
});

it("uses the existing Google key only as a production bootstrap fallback", () => {
vi.stubEnv("NODE_ENV", "production");
envMock.GOOGLE_CLOUD_API_KEY = "google-test-key";

expect(getPlatformCvmateProvider()).toEqual({
id: null,
provider: "gemini",
model: "",
apiKey: "google-test-key",
baseURL: null,
});
});
});