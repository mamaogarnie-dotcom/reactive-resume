import { describe, expect, it } from "vitest";
import { ORPCError } from "@orpc/server";
import { formatMcpClientError, toMcpClientError } from "./errors";

// Fictional data only.
const EMAIL = "jan.kowalski@example.com";
const SQL = 'insert into "resume" ("id", "user_id", "data") values ($1, $2, $3)';
const PROVIDER_BODY = "Incorrect API key provided: sk-proj-abc123. Prompt: Jan Kowalski, Senior Analyst";

class DrizzleQueryErrorLike extends Error {
	override name = "DrizzleQueryError";
	query = SQL;
	params = ["resume-1", "user-1", EMAIL];

	constructor() {
		super(`Failed query: ${SQL}\nparams: resume-1,user-1,${EMAIL}`);
	}
}

class APICallErrorLike extends Error {
	override name = "AI_APICallError";
	statusCode = 401;
	responseBody = JSON.stringify({ error: { message: PROVIDER_BODY } });

	constructor() {
		super(PROVIDER_BODY);
	}
}

const INTERNAL = { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" };

describe("toMcpClientError", () => {
	it.each([
		["a Drizzle query error", new DrizzleQueryErrorLike()],
		["an AI provider call error", new APICallErrorLike()],
		["a plain Error with user data", new Error(`Cannot read resume of ${EMAIL}`)],
		["an error with code and status fields", Object.assign(new Error(SQL), { code: "NOT_FOUND", status: 404 })],
		["a thrown string", `${SQL} ${EMAIL}`],
		["a thrown object", { message: PROVIDER_BODY }],
		["undefined", undefined],
	])("collapses %s to a fixed internal error", (_name, error) => {
		const result = toMcpClientError(error);
		const serialized = JSON.stringify(result);

		expect(result).toEqual(INTERNAL);
		expect(serialized).not.toContain("insert into");
		expect(serialized).not.toContain(EMAIL);
		expect(serialized).not.toContain("sk-proj");
		expect(serialized).not.toContain("Jan Kowalski");
	});

	it("keeps an ORPCError's code and message", () => {
		const error = new ORPCError("BAD_REQUEST", { message: "Provide at least one of: name, slug, tags, isPublic." });

		expect(toMcpClientError(error)).toEqual({
			code: "BAD_REQUEST",
			message: "Provide at least one of: name, slug, tags, isPublic.",
		});
	});

	it("never exposes an ORPCError's cause", () => {
		const error = new ORPCError("BAD_GATEWAY", {
			message: "Could not reach the AI provider.",
			cause: new APICallErrorLike(),
		});

		expect(JSON.stringify(toMcpClientError(error))).not.toContain("sk-proj");
	});

	it("keeps the message of an ORPCError marked log-unsafe (the caller's own data)", () => {
		const error = new ORPCError("BAD_REQUEST", { message: "Attachment oferta.pdf could not be read." });
		Object.defineProperty(error, Symbol.for("@reactive-resume/utils/error-log.unsafe-message"), { value: true });

		expect(toMcpClientError(error)).toEqual({
			code: "BAD_REQUEST",
			message: "Attachment oferta.pdf could not be read.",
		});
	});
});

describe("formatMcpClientError", () => {
	it("formats code and message", () => {
		expect(formatMcpClientError(new ORPCError("NOT_FOUND"))).toBe("NOT_FOUND: Not Found");
	});

	it("omits a message that only repeats the code", () => {
		expect(formatMcpClientError(new ORPCError("RESUME_LOCKED"))).toBe("RESUME_LOCKED");
	});

	it("formats a non-ORPC error as the fixed internal error", () => {
		expect(formatMcpClientError(new DrizzleQueryErrorLike())).toBe("INTERNAL_SERVER_ERROR: Internal server error");
	});
});
