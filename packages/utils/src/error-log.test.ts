import type { SafeLogContext } from "./error-log";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	formatSafeErrorLog,
	logSafeError,
	logSafeWarning,
	markLogMessageUnsafe,
	sanitizeErrorForLog,
	scrubLogMessage,
} from "./error-log";

// Fictional personal data; none of these strings may ever appear in a log line.
const CV_TEXT = "Jan Kowalski — Senior Fikcyjny Analityk w Firma Testowa Sp. z o.o. od 2019";
const EMAIL = "jan.kowalski@example.com";
const PHONE = "+48 601-234-567";
const PROMPT = "Przeanalizuj CV kandydata: Jan Kowalski, ul. Testowa 1, Warszawa";
const FILE_NAME = "CV_Jan_Kowalski.pdf";
const SECRETS = [CV_TEXT, EMAIL, PHONE, PROMPT, FILE_NAME, "Kowalski", "601-234-567", "Testowa"];

function expectNoSecrets(value: unknown) {
	const serialized = typeof value === "string" ? value : JSON.stringify(value);
	for (const secret of SECRETS) expect(serialized).not.toContain(secret);
}

class ORPCErrorLike extends Error {
	defined = false;
	constructor(
		readonly code: string,
		readonly status: number,
		message: string,
		options?: { cause?: unknown; data?: unknown },
	) {
		super(message, options?.cause === undefined ? undefined : { cause: options.cause });
		Object.assign(this, { data: options?.data });
	}
}

class ValidationError extends Error {
	constructor(
		readonly issues: unknown[],
		readonly data: unknown,
	) {
		super("Input validation failed");
	}
}

class APICallErrorLike extends Error {
	override name = "AI_APICallError";
	statusCode = 429;
	isRetryable = true;
	url = `https://api.example-ai.test/v1/chat?key=secret&user=${EMAIL}`;
	requestBodyValues = { messages: [{ role: "user", content: PROMPT }] };
	responseBody = `{"error":"rate limited for ${EMAIL}"}`;
	responseHeaders = { "x-user": EMAIL };
	constructor() {
		super(`Provider rejected: ${PROMPT}`);
	}
}

describe("scrubLogMessage", () => {
	it("masks file names, including the given CV file name", () => {
		expect(scrubLogMessage(`Attachment ${FILE_NAME} could not be read.`)).toBe("Attachment [FILE] could not be read.");
		expect(scrubLogMessage("Stored asset is unavailable: zdjecie.HEIC.")).toBe("Stored asset is unavailable: [FILE].");
		expect(scrubLogMessage('File "Moje CV 2026.docx" failed')).toBe("File [FILE] failed");
	});

	it("masks e-mail addresses", () => {
		expect(scrubLogMessage(`No account for ${EMAIL}.`)).toBe("No account for [EMAIL].");
	});

	it("masks phone numbers and other 7+ digit runs with separators", () => {
		expect(scrubLogMessage(`Call ${PHONE}`)).toBe("Call [NUM]");
		expect(scrubLogMessage("Call 601.234.567 or 601 234 567 or 601234567")).toBe("Call [NUM] or [NUM] or [NUM]");
	});

	it("masks URLs before other rules", () => {
		expect(scrubLogMessage(`See https://example.com/u?email=${EMAIL}&id=1234567 now`)).toBe("See [URL] now");
		expect(scrubLogMessage("Visit www.example.com/profile")).toBe("Visit [URL]");
	});

	it("keeps short numbers and plain developer messages", () => {
		expect(scrubLogMessage("Job offer text cannot exceed 20000 characters.")).toBe(
			"Job offer text cannot exceed 20000 characters.",
		);
		expect(scrubLogMessage("Could not reach the AI provider.")).toBe("Could not reach the AI provider.");
	});

	it("truncates to 200 characters", () => {
		const result = scrubLogMessage("a".repeat(500));
		expect(result).toHaveLength(200);
		expect(result.endsWith("…")).toBe(true);
	});
});

describe("sanitizeErrorForLog", () => {
	it("drops oRPC validation input while keeping code, status and issue paths", () => {
		const issues = [
			{ code: "too_big", path: ["extractedText"], message: `Too long: ${CV_TEXT}`, input: CV_TEXT },
			{ code: "invalid_type", path: ["contact", { key: EMAIL }, 0], message: "bad" },
		];
		const error = new ORPCErrorLike("BAD_REQUEST", 400, "Input validation failed", {
			data: { issues },
			cause: new ValidationError(issues, { extractedText: CV_TEXT, email: EMAIL, phone: PHONE }),
		});

		const result = sanitizeErrorForLog(error);

		expectNoSecrets(result);
		expect(result.chain[0]).toMatchObject({ code: "BAD_REQUEST", status: 400, message: "Input validation failed" });
		expect(result.chain[1]).toMatchObject({
			name: "ValidationError",
			message: "Input validation failed",
			issueCount: 2,
			issues: [
				{ code: "too_big", path: "extractedText", pathDepth: 1 },
				{ code: "invalid_type", path: "contact", pathDepth: 3 },
			],
		});
	});

	it("keeps only status, retryability and a custom-host marker of an AI provider call error", () => {
		const result = sanitizeErrorForLog(
			new ORPCErrorLike("BAD_GATEWAY", 502, "Could not reach the AI provider.", { cause: new APICallErrorLike() }),
		);

		expectNoSecrets(result);
		const serialized = JSON.stringify(result);
		for (const forbidden of ["requestBodyValues", "responseBody", "responseHeaders", "secret", "Provider rejected"]) {
			expect(serialized).not.toContain(forbidden);
		}
		expect(result.chain[1]).toMatchObject({
			name: "AI_APICallError",
			statusCode: 429,
			isRetryable: true,
			providerHost: "custom",
		});
		expect(JSON.stringify(result)).not.toContain("example-ai");
		expect(result.chain[1]?.message).toBeUndefined();
	});

	it("logs the host of a known AI provider and 'custom' for user-configured hosts", () => {
		const known = Object.assign(new APICallErrorLike(), { url: "https://api.openai.com/v1/chat/completions?key=x" });
		const custom = Object.assign(new APICallErrorLike(), { url: "https://jan-kowalski.customer-ai.example/v1" });

		expect(sanitizeErrorForLog(known).chain[0]?.providerHost).toBe("api.openai.com");
		expect(sanitizeErrorForLog(custom).chain[0]?.providerHost).toBe("custom");
		expect(JSON.stringify(sanitizeErrorForLog(custom))).not.toContain("kowalski");
	});

	it("keeps the scrubbed message of a Node module resolution error, which names the missing module", async () => {
		const error = await import(/* @vite-ignore */ ["1story-missing-package", "for-error-log-test"].join("-")).catch(
			(caught: unknown) => caught,
		);

		const entry = sanitizeErrorForLog(error).chain[0];

		expect(entry).toMatchObject({ code: "ERR_MODULE_NOT_FOUND" });
		expect(entry?.message).toContain("1story-missing-package-for-error-log-test");
	});

	it("keeps the message of ERR_PACKAGE_PATH_NOT_EXPORTED and still scrubs it", () => {
		const error = Object.assign(
			new Error(
				`Package subpath './missing' is not defined by "exports" in /app/node_modules/pkg/package.json imported from /app/apps/server/dist/index.mjs ${EMAIL}`,
			),
			{ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" },
		);

		const entry = sanitizeErrorForLog(error).chain[0];

		expectNoSecrets(entry);
		expect(entry?.message).toContain("Package subpath './missing' is not defined by \"exports\"");
		expect(entry?.message).toContain("[EMAIL]");
	});

	it("drops the message of a module resolution error marked unsafe, and of other Node error codes", () => {
		const marked = markLogMessageUnsafe(
			Object.assign(new Error(`Cannot find module '${FILE_NAME}'`), { code: "ERR_MODULE_NOT_FOUND" }),
		);
		const enoent = Object.assign(new Error(`ENOENT: no such file or directory, open '/data/${FILE_NAME}'`), {
			code: "ENOENT",
		});

		expect(sanitizeErrorForLog(marked).chain[0]).toMatchObject({ code: "ERR_MODULE_NOT_FOUND" });
		expect(sanitizeErrorForLog(marked).chain[0]?.message).toBeUndefined();
		expect(sanitizeErrorForLog(enoent).chain[0]).toMatchObject({ code: "ENOENT" });
		expect(sanitizeErrorForLog(enoent).chain[0]?.message).toBeUndefined();
	});

	it("follows a nested cause chain without leaking query params or Postgres detail", () => {
		const pgError = Object.assign(new Error("duplicate key value violates unique constraint"), {
			name: "error",
			code: "23505",
			severity: "ERROR",
			table: "user",
			constraint: "user_email_unique",
			detail: `Key (email)=(${EMAIL}) already exists.`,
			where: CV_TEXT,
		});
		const drizzleError = Object.assign(
			new Error(`Failed query: insert into "user" values ($1, $2)\nparams: ${EMAIL},${CV_TEXT}`, { cause: pgError }),
			{ name: "DrizzleQueryError", query: 'insert into "user"', params: [EMAIL, CV_TEXT] },
		);
		const outer = new Error(`Failed to create resume for ${EMAIL}`, { cause: drizzleError });

		const result = sanitizeErrorForLog(outer);

		expectNoSecrets(result);
		expect(result.chain.map((entry) => entry.name)).toEqual(["Error", "DrizzleQueryError", "error"]);
		expect(result.chain[2]).toMatchObject({
			code: "23505",
			severity: "ERROR",
			table: "user",
			constraint: "user_email_unique",
		});
		expect(result.chain.every((entry) => entry.message === undefined)).toBe(true);
		expect(result.chain[0]?.stack?.every((frame) => frame.startsWith("at "))).toBe(true);
	});

	it("excludes the path of Node system errors", () => {
		const error = Object.assign(new Error(`ENOENT: no such file or directory, open '/data/uploads/${FILE_NAME}'`), {
			code: "ENOENT",
			errno: -2,
			syscall: "open",
			path: `/data/uploads/${FILE_NAME}`,
			dest: `/tmp/${FILE_NAME}`,
		});

		const result = sanitizeErrorForLog(error);

		expectNoSecrets(result);
		expect(JSON.stringify(result)).not.toContain("/data/uploads");
		expect(result.chain[0]).toEqual(expect.objectContaining({ code: "ENOENT", errno: -2, syscall: "open" }));
		expect(result.chain[0]).not.toHaveProperty("path");
	});

	it("scrubs ORPCError messages", () => {
		const result = sanitizeErrorForLog(
			new ORPCErrorLike("BAD_REQUEST", 400, `Stored job-offer asset is unavailable: ${FILE_NAME}.`),
		);
		expectNoSecrets(result);
		expect(result.chain[0]?.message).toBe("Stored job-offer asset is unavailable: [FILE].");
	});

	it("survives circular causes", () => {
		const a = new Error(CV_TEXT);
		const b = new Error(EMAIL, { cause: a });
		Object.assign(a, { cause: b });

		const result = sanitizeErrorForLog(a);

		expectNoSecrets(result);
		expect(result.chain.map((entry) => entry.name)).toEqual(["Error", "Error", "[Circular]"]);
	});

	it("caps very deep cause chains", () => {
		let error: unknown = new Error(CV_TEXT);
		for (let i = 0; i < 50; i++) error = new Error(EMAIL, { cause: error });

		const result = sanitizeErrorForLog(error);

		expectNoSecrets(result);
		expect(result.chain).toHaveLength(8);
		expect(result.truncated).toBe(true);
	});

	it("describes AggregateError members", () => {
		const error = new AggregateError(
			[new APICallErrorLike(), new Error(CV_TEXT), PHONE, { email: EMAIL }],
			`All failed for ${EMAIL}`,
		);

		const result = sanitizeErrorForLog(error);

		expectNoSecrets(result);
		expect(result.chain[0]?.name).toBe("AggregateError");
		expect(result.chain[0]?.errors?.map((nested) => nested.chain[0]?.name)).toEqual([
			"AI_APICallError",
			"Error",
			"NonError",
			"NonError",
		]);
	});

	it("never logs the value of non-Error throwables", () => {
		expect(sanitizeErrorForLog(CV_TEXT)).toEqual({ chain: [{ name: "NonError", valueType: "string" }] });
		expect(sanitizeErrorForLog(null)).toEqual({ chain: [{ name: "NonError", valueType: "null" }] });
		expect(sanitizeErrorForLog(undefined)).toEqual({ chain: [{ name: "NonError", valueType: "undefined" }] });

		const result = sanitizeErrorForLog({ message: CV_TEXT, email: EMAIL, code: "E_CUSTOM", status: 500 });
		expectNoSecrets(result);
		expect(result.chain[0]).toEqual({ name: "NonError", valueType: "Object", code: "E_CUSTOM", status: 500 });
	});

	it("does not throw on hostile getters", () => {
		const hostile = new Error(EMAIL);
		Object.defineProperty(hostile, "code", {
			get() {
				throw new Error(CV_TEXT);
			},
		});
		const proxy = new Proxy(
			{},
			{
				get() {
					throw new Error(CV_TEXT);
				},
			},
		);

		expectNoSecrets(sanitizeErrorForLog(hostile));
		expectNoSecrets(sanitizeErrorForLog(proxy));
		expect(sanitizeErrorForLog(hostile).chain[0]?.name).toBe("Error");
	});

	it("logs only the first path segment and depth of issues, so z.record keys never appear", () => {
		const parsed = z.object({ skills: z.record(z.string(), z.number()) }).safeParse({ skills: { Jan_Kowalski: "x" } });
		expect(parsed.success).toBe(false);

		const result = sanitizeErrorForLog(
			new ValidationError(parsed.error?.issues ?? [], { skills: { Jan_Kowalski: "x" } }),
		);

		expect(JSON.stringify(result)).not.toContain("Jan_Kowalski");
		expect(result.chain[0]?.issues).toEqual([{ code: "invalid_type", path: "skills", pathDepth: 2 }]);
	});
});

// Mirrors drizzle-orm's DrizzleQueryError: the SQL parameters are part of the message, and the name
// is set before the stack is captured, so the V8 stack header repeats the parameters.
class DrizzleQueryErrorLike extends Error {
	constructor(
		readonly query: string,
		readonly params: unknown[],
	) {
		super(`Failed query: ${query}\nparams: ${params.join(",")}`);
		this.name = "DrizzleQueryError";
		Error.captureStackTrace(this, DrizzleQueryErrorLike);
	}
}

describe("stack sanitization", () => {
	const FAKE_FRAME_PARAM = `CV text\n    at Jan Kowalski ${EMAIL}`;
	const FAKE_LOCATION_PARAM = `CV text\n    at Jan_Kowalski (/a:1:1)\n    at ${EMAIL}:1:1`;

	it("does not let a parameter disguised as a stack frame through", () => {
		const result = sanitizeErrorForLog(new DrizzleQueryErrorLike('insert into "resume"', [FAKE_FRAME_PARAM, PHONE]));

		expectNoSecrets(result);
		expect(result.chain[0]?.name).toBe("DrizzleQueryError");
		expect(result.chain[0]?.stack?.length).toBeGreaterThan(0);
	});

	it("does not let a fake frame with a location through", () => {
		const result = sanitizeErrorForLog(new DrizzleQueryErrorLike('insert into "resume"', [FAKE_LOCATION_PARAM]));

		expectNoSecrets(result);
		expect(JSON.stringify(result)).not.toContain("/a:1:1");
		expect(result.chain[0]?.stack?.every((frame) => !frame.includes("Kowalski"))).toBe(true);
	});

	it("drops the stack when the name could forge the header (Codex reproduction)", () => {
		const error = new Error("boom");
		error.name = `Error: boom\n    at ${EMAIL}:1:1\nOther`;
		// V8 builds the header from the forged name, so both "Error: boom" and the full header match.
		expect(error.stack?.startsWith(`Error: boom\n    at ${EMAIL}:1:1\nOther: boom\n`)).toBe(true);

		const result = sanitizeErrorForLog(error);

		expectNoSecrets(result);
		expect(result.chain[0]?.stack).toBeUndefined();
	});

	it("drops the stack when the name contains a colon", () => {
		const error = new Error("boom");
		error.name = "Error: x";
		error.stack = `Error: x: boom\n    at ${EMAIL}:1:1\n    at fn (/srv/app.js:1:1)`;

		const result = sanitizeErrorForLog(error);

		expectNoSecrets(result);
		expect(result.chain[0]?.stack).toBeUndefined();
	});

	it("drops a stack that does not start with the expected header", () => {
		const error = new Error("short");
		error.stack = `Error: something else ${EMAIL}\n    at fn (/srv/app.js:1:1)`;

		const result = sanitizeErrorForLog(error);

		expectNoSecrets(result);
		expect(result.chain[0]?.stack).toBeUndefined();
	});

	it("keeps only strictly formatted frames", () => {
		const error = new Error("boom");
		error.stack = [
			"Error: boom",
			"    at Object.<anonymous> (/srv/app.js:10:5)",
			"    at /srv/app.js:11:3",
			"    at Array.map (native)",
			"    at async Promise.all (index 0)",
			`    at ${EMAIL} said hello`,
			"    at eval (eval at <anonymous> (/srv/app.js:1:1), <anonymous>:1:1)",
		].join("\n");

		expect(sanitizeErrorForLog(error).chain[0]?.stack).toEqual([
			"at Object.<anonymous> (/srv/app.js:10:5)",
			"at /srv/app.js:11:3",
			"at Array.map (native)",
			"at async Promise.all (index 0)",
		]);
	});
});

describe("markLogMessageUnsafe", () => {
	it("drops the message of a marked error but keeps name, code and status", () => {
		const error = markLogMessageUnsafe(
			new ORPCErrorLike("BAD_REQUEST", 400, "Attachment Jan Kowalski CV.pdf could not be read."),
		);

		const result = sanitizeErrorForLog(error);

		expectNoSecrets(result);
		expect(result.chain[0]).toMatchObject({ name: "ORPCErrorLike", code: "BAD_REQUEST", status: 400 });
		expect(result.chain[0]?.message).toBeUndefined();
		expect(result.chain[0]?.stack?.length).toBeGreaterThan(0);
	});

	it("is invisible to serialization and returns the same error", () => {
		const error = new ORPCErrorLike("BAD_REQUEST", 400, "x");
		const marked = markLogMessageUnsafe(error);

		expect(marked).toBe(error);
		expect(Object.keys(marked)).not.toContain("unsafe-message");
		expect(JSON.stringify(marked)).toBe(JSON.stringify(new ORPCErrorLike("BAD_REQUEST", 400, "x")));
		expect(markLogMessageUnsafe("plain")).toBe("plain");
	});
});

describe("log context allowlist", () => {
	const UUID = "01928c5e-7a3b-7c4d-8e9f-0a1b2c3d4e5f";

	it("keeps valid values of allowlisted keys", () => {
		const line = formatSafeErrorLog("[x]", null, {
			procedure: "cvmate.build.recommendations",
			route: "/cvmate/review",
			method: "POST",
			operation: "tailored-content",
			provider: "openai",
			model: "gpt-4o-mini",
			userId: UUID,
			resumeId: UUID,
			threadId: UUID,
			runId: UUID,
		});

		expect(JSON.parse(line.slice(4))).toMatchObject({
			procedure: "cvmate.build.recommendations",
			route: "/cvmate/review",
			method: "POST",
			operation: "tailored-content",
			provider: "openai",
			model: "gpt-4o-mini",
			userId: UUID,
			resumeId: UUID,
			threadId: UUID,
			runId: UUID,
		});
	});

	it("replaces custom providers and models, redacts malformed ids and drops unknown keys", () => {
		const context = {
			provider: "my-provider",
			model: EMAIL,
			userId: EMAIL,
			threadId: "Jan Kowalski",
			procedure: `cvmate ${CV_TEXT}`,
			email: EMAIL,
		} as unknown as SafeLogContext;

		const parsed = JSON.parse(formatSafeErrorLog("[x]", null, context).slice(4));

		expectNoSecrets(parsed);
		expect(parsed).toMatchObject({
			provider: "custom",
			model: "custom",
			userId: "[redacted]",
			threadId: "[redacted]",
			procedure: "[redacted]",
		});
		expect(parsed).not.toHaveProperty("email");
	});

	it("recognizes known model families and rejects free text", () => {
		for (const model of ["claude-sonnet-4-5", "gemini-2.5-pro", "openai/gpt-4o", "mistral-large-latest", "o3-mini"]) {
			expect(JSON.parse(formatSafeErrorLog("[x]", null, { model }).slice(4)).model).toBe(model);
		}
		for (const model of ["Jan Kowalski", "my-finetune", "gpt-4o@example.com"]) {
			expect(JSON.parse(formatSafeErrorLog("[x]", null, { model }).slice(4)).model).toBe("custom");
		}
	});
});

describe("logSafeError", () => {
	afterEach(() => vi.restoreAllMocks());

	it("writes one line with label, context and the sanitized error", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		logSafeError("[oRPC Server]", new ORPCErrorLike("BAD_GATEWAY", 502, "x", { cause: new APICallErrorLike() }), {
			procedure: "cvmate.build.recommendations",
		});
		logSafeWarning("[warn]", new Error(CV_TEXT));

		const logged = [...errorSpy.mock.calls, ...warnSpy.mock.calls].flat().join("\n");
		expectNoSecrets(logged);
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(errorSpy.mock.calls[0]).toHaveLength(1);
		expect(logged).toContain('"procedure":"cvmate.build.recommendations"');
		expect(logged).toContain('"code":"BAD_GATEWAY"');
		expect(formatSafeErrorLog("[x]", PHONE)).toBe('[x] {"error":{"chain":[{"name":"NonError","valueType":"string"}]}}');
	});
});
