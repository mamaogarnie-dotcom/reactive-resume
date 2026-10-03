import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@reactive-resume/utils/monorepo.node", () => ({ findWorkspaceRoot: () => undefined }));

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("root resume configuration", () => {
	it.each([
		[undefined, undefined],
		["", undefined],
		["   ", undefined],
		[" root-id ", "root-id"],
	])("normalizes %s to %s", async (value, expected) => {
		vi.stubEnv("APP_URL", "https://resume.example");
		vi.stubEnv("DATABASE_URL", "postgresql://localhost/disposable");
		vi.stubEnv("AUTH_SECRET", "disposable");
		vi.stubEnv("ROOT_RESUME_ID", value);
		const { env } = await import("./server");
		expect(env.ROOT_RESUME_ID).toBe(expected);
	});
});

describe("email verification feature flag", () => {
	it.each([
		[undefined, false],
		["false", false],
		["true", true],
	])("parses %s as %s", async (value, expected) => {
		vi.stubEnv("APP_URL", "https://resume.example");
		vi.stubEnv("DATABASE_URL", "postgresql://localhost/disposable");
		vi.stubEnv("AUTH_SECRET", "disposable");
		vi.stubEnv("FLAG_REQUIRE_EMAIL_VERIFICATION", value);
		const { env } = await import("./server");
		expect(env.FLAG_REQUIRE_EMAIL_VERIFICATION).toBe(expected);
	});
});

describe("email preview log flag", () => {
	it.each([
		[undefined, false],
		["", false],
		["false", false],
		["0", false],
		["1", false],
		["yes", false],
		["TRUE", false],
		["true", true],
	])("parses %s as %s", async (value, expected) => {
		vi.stubEnv("APP_URL", "https://resume.example");
		vi.stubEnv("DATABASE_URL", "postgresql://localhost/disposable");
		vi.stubEnv("AUTH_SECRET", "disposable");
		vi.stubEnv("EMAIL_PREVIEW_LOG", value);
		const { env } = await import("./server");
		expect(env.EMAIL_PREVIEW_LOG).toBe(expected);
	});
});
