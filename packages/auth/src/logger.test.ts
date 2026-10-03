import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "better-auth";
import { createSafeAuthLogger, sanitizeAuthLogMessage } from "./logger";

// Fictional data only.
const EMAIL = "jan.kowalski@example.com";
const TOKEN = "Xk9qT2mPz7Lw4Rb8Vn3Hc6Jd1Fs5Gy0A";
const UUID = "0199a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b";
const SHORT_TOKEN = "AbC123xyZ";

type ConsoleSpies = { error: MockInstance; warn: MockInstance; log: MockInstance };

let spies: ConsoleSpies;

beforeEach(() => {
	spies = {
		error: vi.spyOn(console, "error").mockImplementation(() => undefined),
		warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
		log: vi.spyOn(console, "log").mockImplementation(() => undefined),
	};
});

afterEach(() => {
	vi.restoreAllMocks();
});

function output(): string {
	return [spies.error, spies.warn, spies.log]
		.flatMap((spy) => spy.mock.calls)
		.flat()
		.map((value) => String(value))
		.join("\n");
}

function log(level: "error" | "warn" | "info" | "debug", message: unknown, ...args: unknown[]) {
	createSafeAuthLogger().log?.(level, message as string, ...args);
}

function expectNoSecrets(text: string) {
	expect(text).not.toContain(EMAIL);
	expect(text).not.toContain("kowalski");
	expect(text).not.toContain(TOKEN);
	expect(text).not.toContain(UUID);
	expect(text).not.toContain(SHORT_TOKEN);
	expect(text).not.toContain("evil.example");
	expect(text).not.toContain("token=");
	expect(text).not.toMatch(/\?(?!\[query\])/);
}

describe("database errors", () => {
	it("removes the e-mail and reset token from the message and from the error argument", () => {
		const message = `Failed query: select "id" from "verification" where "identifier" = $1 and "email" = $2\nparams: reset-password:${TOKEN},${EMAIL}`;
		const cause = Object.assign(new Error(`duplicate key value violates unique constraint "user_email_unique"`), {
			code: "23505",
			table: "user",
			constraint: "user_email_unique",
			detail: `Key (email)=(${EMAIL}) already exists.`,
		});
		const error = new Error(message, { cause });
		error.name = "DrizzleQueryError";

		log("error", message, error);

		const text = output();
		expectNoSecrets(text);
		expect(text).not.toContain("already exists");
		expect(text).toContain("ERROR [Better Auth]: Failed query: select");
		expect(text).toContain("params: [redacted]");
		expect(text).toContain('"name":"DrizzleQueryError"');
		expect(text).toContain('"code":"23505"');
		expect(text).toContain('"table":"user"');
		expect(spies.error).toHaveBeenCalledTimes(1);
	});

	it("masks a reset token and a user id embedded without a params list", () => {
		log("error", `Verification reset-password:${TOKEN} for user ${UUID} not found (${EMAIL})`);

		const text = output();
		expectNoSecrets(text);
		expect(text).toContain("[TOKEN]");
		expect(text).toContain("[EMAIL]");
	});
});

describe("rejected callback URLs", () => {
	it.each([
		`https://evil.example/callback?token=${TOKEN}&email=${encodeURIComponent(EMAIL)}`,
		`//evil.example/callback?token=${TOKEN}`,
		`/dashboard/reset?token=${TOKEN}#access_token=${TOKEN}`,
		`evil.example?token=${TOKEN}`,
	])("drops the query string and fragment of %s", (url) => {
		log("error", `Invalid callbackURL: ${url}`);

		const text = output();
		expect(text).not.toContain(TOKEN);
		expect(text).not.toContain("token=");
		expect(text).not.toContain("kowalski");
		expect(text).toContain("ERROR [Better Auth]: Invalid callbackURL:");
	});

	it("keeps the path of a relative URL for diagnostics", () => {
		expect(sanitizeAuthLogMessage(`Invalid callbackURL: /dashboard/reset?token=${TOKEN}`)).toBe(
			"Invalid callbackURL: /dashboard/reset?[query]",
		);
	});

	it("leaves ordinary prose with question marks and hashes alone", () => {
		expect(sanitizeAuthLogMessage("Is the provider configured? See step #3")).toBe(
			"Is the provider configured? See step #3",
		);
	});

	it("collapses line breaks so a URL cannot forge another log entry", () => {
		const text = sanitizeAuthLogMessage("Invalid origin: https://a.example\n2026-01-01 ERROR [Better Auth]: forged");
		expect(text).not.toContain("\n");
	});
});

describe("non-error arguments", () => {
	it("logs a request and plain objects by type only", () => {
		const request = new Request(`https://app.example/api/auth/reset-password?token=${TOKEN}`, {
			method: "POST",
			headers: { cookie: `session=${TOKEN}`, "x-user-email": EMAIL },
		});

		log("warn", "OAuth provider not found", request, { providerId: "google", email: EMAIL }, EMAIL, 42, [EMAIL]);

		const text = output();
		expectNoSecrets(text);
		expect(text).not.toContain("google");
		expect(text).not.toContain("Request");
		expect(text).toContain(
			'{"args":[{"type":"object"},{"type":"object"},{"type":"string"},{"type":"number"},{"type":"array"}]}',
		);
		expect(spies.warn).toHaveBeenCalledTimes(1);
	});

	it("never logs a constructor name, which parsed user input can forge", () => {
		log("error", "Failed", { constructor: { name: SHORT_TOKEN } }, JSON.parse(`{"constructor":{"name":"${TOKEN}"}}`));

		const text = output();
		expect(text).not.toContain(SHORT_TOKEN);
		expect(text).not.toContain(TOKEN);
		expect(text).toContain('{"args":[{"type":"object"},{"type":"object"}]}');
	});

	it("logs each primitive and function as a fixed type", () => {
		log("error", "Failed", EMAIL, 1, true, 10n, Symbol(EMAIL), undefined, null, () => EMAIL, [EMAIL]);

		const types = ["string", "number", "boolean", "bigint", "symbol", "undefined", "null", "function", "array"];
		expect(output()).toContain(JSON.stringify({ args: types.map((type) => ({ type })) }));
		expectNoSecrets(output());
	});
});

describe("message hardening", () => {
	it("decodes percent-encoded e-mails before scrubbing them", () => {
		const text = sanitizeAuthLogMessage(
			"Lookup failed for jan.kowalski%40example.com and jan%2Ekowalski%40example%2Ecom",
		);
		expect(text).toBe("Lookup failed for [EMAIL] and [EMAIL]");
	});

	it("masks the value of key=value pairs outside URLs", () => {
		expect(sanitizeAuthLogMessage("Cookie: session=abc.def.ghi; theme=light")).toBe(
			"Cookie: session=[value]; theme=[value]",
		);
		expect(sanitizeAuthLogMessage(`Invalid token=${SHORT_TOKEN} for email="${EMAIL}"`)).toBe(
			"Invalid token=[value] for email=[value]",
		);
		expect(sanitizeAuthLogMessage(`Key (email)=(${EMAIL}) already exists.`)).toBe(
			"Key (email)=[value] already exists.",
		);
	});

	it("masks opaque tokens from 16 characters", () => {
		expect(sanitizeAuthLogMessage("Reset token AbC123xyZ4567890 expired")).toBe("Reset token [TOKEN] expired");
		expect(sanitizeAuthLogMessage(`Reset token ${TOKEN} expired`)).toBe("Reset token [TOKEN] expired");
	});

	it("strips the whole query even when a line separator follows it", () => {
		for (const separator of [" ", " ", "\n", "\r\n"]) {
			const text = sanitizeAuthLogMessage(`Invalid callbackURL: /reset?token=abc${separator}secret`);
			expect(text).toBe("Invalid callbackURL: /reset?[query]");
		}
	});
});

// The exact logger calls Better Auth 1.7.3 makes on these paths for an unknown or existing e-mail
// (none passes the e-mail today); the e-mail is added to message and args to guard future versions.
describe("Better Auth account e-mail paths", () => {
	it("request-password-reset: warn 'Reset Password: User not found'", () => {
		const logger = createLogger(createSafeAuthLogger());

		logger.warn("Reset Password: User not found");
		logger.warn(`Reset Password: User not found (${EMAIL})`, { email: EMAIL }, EMAIL);

		expect(spies.warn).toHaveBeenCalledTimes(2);
		expect(String(spies.warn.mock.calls[0]?.[0])).toContain("WARN [Better Auth]: Reset Password: User not found");
		expect(String(spies.warn.mock.calls[1]?.[0])).toContain(
			'Reset Password: User not found ([EMAIL]) {"args":[{"type":"object"},{"type":"string"}]}',
		);
		expectNoSecrets(output());
	});

	it("change-email: info 'Change email attempt for existing email' stays below the warn threshold", () => {
		const logger = createLogger(createSafeAuthLogger());

		logger.info("Change email attempt for existing email", { email: EMAIL });
		logger.info(`Sign-up attempt for existing email: ${EMAIL}`);
		expect(output()).toBe("");

		// Same calls if a future configuration lowers the threshold.
		createSafeAuthLogger().log?.("info", `Change email attempt for existing email: ${EMAIL}`, { email: EMAIL });
		expect(String(spies.log.mock.calls[0]?.[0])).toContain(
			'INFO [Better Auth]: Change email attempt for existing email: [EMAIL] {"args":[{"type":"object"}]}',
		);
		expectNoSecrets(output());
	});

	it("send-verification-email / verify-email: unknown user errors reach the logger only as sanitized errors", () => {
		const logger = createLogger(createSafeAuthLogger());
		const error = Object.assign(new Error(`User not found: ${EMAIL}`), { name: "APIError", statusCode: 400 });

		logger.error("Verification email isn't enabled.");
		logger.error("BAD_REQUEST", error, { email: EMAIL });

		expect(spies.error).toHaveBeenCalledTimes(2);
		expect(String(spies.error.mock.calls[1]?.[0])).toContain('"name":"APIError"');
		expect(String(spies.error.mock.calls[1]?.[0])).toContain('"statusCode":400');
		expectNoSecrets(output());
	});
});

describe("levels", () => {
	it.each([
		["error", "error"],
		["warn", "warn"],
		["info", "log"],
		["debug", "log"],
	] as const)("routes %s to console.%s with its label", (level, method) => {
		log(level, "Something happened");

		expect(spies[method]).toHaveBeenCalledTimes(1);
		expect(String(spies[method].mock.calls[0]?.[0])).toContain(
			`${level.toUpperCase()} [Better Auth]: Something happened`,
		);
		for (const other of ["error", "warn", "log"] as const) {
			if (other !== method) expect(spies[other]).not.toHaveBeenCalled();
		}
	});

	it("routes an unknown level to console.error", () => {
		createSafeAuthLogger().log?.("trace" as "error", "Something happened");

		expect(spies.error).toHaveBeenCalledTimes(1);
		expect(String(spies.error.mock.calls[0]?.[0])).toContain("ERROR [Better Auth]: Something happened");
	});

	it("keeps Better Auth's default warn threshold", () => {
		const logger = createLogger(createSafeAuthLogger());

		logger.debug(`Sign-up attempt for existing email: ${EMAIL}`);
		logger.info(`Sign-up attempt for existing email: ${EMAIL}`);
		logger.success("Done");
		expect(output()).toBe("");

		logger.warn("Reset Password: User not found");
		logger.error(`Invalid callbackURL: https://evil.example/?token=${TOKEN}`, new Error(EMAIL));

		expect(logger.level).toBe("warn");
		expect(spies.warn).toHaveBeenCalledTimes(1);
		expect(spies.error).toHaveBeenCalledTimes(1);
		expectNoSecrets(output());
	});
});

describe("unusual arguments", () => {
	it("survives proxies, throwing getters, cycles, symbols and bigints", () => {
		const hostile = new Proxy(
			{},
			{
				get() {
					throw new Error(EMAIL);
				},
				getPrototypeOf() {
					throw new Error(EMAIL);
				},
			},
		);
		const cyclic: Record<string, unknown> = { email: EMAIL };
		cyclic.self = cyclic;
		const cyclicError = new Error(EMAIL) as Error & { cause?: unknown };
		cyclicError.cause = cyclicError;
		const getterError = new Error("boom");
		Object.defineProperty(getterError, "code", {
			get() {
				throw new Error(EMAIL);
			},
		});

		expect(() =>
			log("error", "Failed", hostile, cyclic, cyclicError, getterError, Symbol(EMAIL), 10n, undefined, null),
		).not.toThrow();

		const text = output();
		expectNoSecrets(text);
		expect(spies.error).toHaveBeenCalledTimes(1);
	});

	it("logs a non-string message by type only", () => {
		log("error", { email: EMAIL });
		expect(output()).toContain("[non-string message: object]");
		expectNoSecrets(output());
	});

	it("falls back to a fixed line when formatting fails and never throws", () => {
		const toISOString = vi.spyOn(Date.prototype, "toISOString").mockImplementation(() => {
			throw new Error(EMAIL);
		});

		expect(() => log("warn", `Invalid callbackURL: https://evil.example/?token=${TOKEN}`)).not.toThrow();
		expect(output()).toBe("WARN [Better Auth]: [log entry dropped]");

		toISOString.mockRestore();
		spies.error.mockImplementation(() => {
			throw new Error("console unavailable");
		});
		expect(() => log("error", "Failed")).not.toThrow();
	});
});
