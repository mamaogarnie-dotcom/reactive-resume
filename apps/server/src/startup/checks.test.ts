import { afterEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	SMTP_HOST: undefined as string | undefined,
	SMTP_USER: undefined as string | undefined,
	SMTP_PASS: undefined as string | undefined,
	SMTP_FROM: undefined as string | undefined,
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

const { warnIfSmtpNotConfigured } = await import("./checks");

afterEach(() => {
	envMock.SMTP_HOST = undefined;
	envMock.SMTP_USER = undefined;
	envMock.SMTP_PASS = undefined;
	envMock.SMTP_FROM = undefined;
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
