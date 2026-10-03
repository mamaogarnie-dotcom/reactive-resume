import type { RouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin } from "@orpc/client/plugins";
import { ORPCError, os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { APICallError } from "ai";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { z } from "zod";
import { markLogMessageUnsafe } from "@reactive-resume/utils/error-log";
import { createOrpcErrorLogging } from "./error-logging";

// Fictional personal data; none of these strings may appear in a log line.
const CV_TEXT = "Jan Kowalski — Senior Fikcyjny Analityk w Firma Testowa Sp. z o.o. od 2019";
const EMAIL = "jan.kowalski@example.com";
const PHONE = "+48 601-234-567";
const PROMPT = "Przeanalizuj CV kandydata: Jan Kowalski, ul. Testowa 1, Warszawa";
const FILE_NAME = "Jan Kowalski CV.pdf";
const SECRETS = [CV_TEXT, EMAIL, PHONE, PROMPT, FILE_NAME, "Kowalski", "601-234-567", "Testowa", "sk-test-secret"];

const attachmentMessage = `Attachment ${FILE_NAME} could not be read.`;

const router = {
	cvmate: {
		review: os.input(z.object({ extractedText: z.string().max(5), email: z.email() })).handler(() => ({ ok: true })),
		recommend: os.handler(() => {
			throw new ORPCError("BAD_GATEWAY", {
				message: "Could not reach the AI provider.",
				cause: new APICallError({
					message: `Rate limited while processing: ${PROMPT}`,
					url: "https://api.openai.com/v1/chat/completions?key=sk-test-secret",
					requestBodyValues: { messages: [{ role: "user", content: `${PROMPT}\n${CV_TEXT}` }] },
					statusCode: 429,
					responseHeaders: { "x-request-for": EMAIL },
					responseBody: `{"error":{"message":"quota exceeded for ${EMAIL}"}}`,
					isRetryable: true,
				}),
			});
		}),
		save: os.handler(() => {
			const pgError = Object.assign(new Error("duplicate key value violates unique constraint"), {
				code: "23505",
				table: "resume",
				constraint: "resume_slug_user_id_unique",
				detail: `Key (email)=(${EMAIL}) already exists.`,
			});
			// A parameter disguised as a stack frame, embedded by Drizzle into its message.
			const params = [`CV text\n    at Jan Kowalski ${EMAIL}`, "x\n    at Jan_Kowalski (/a:1:1)", PHONE];
			const queryError = new DrizzleQueryError('insert into "resume" values ($1, $2, $3)', params, pgError);
			throw new Error(`Failed to save resume for ${EMAIL}`, { cause: queryError });
		}),
		declared: os.errors({ CONFLICT: { message: "Conflict", status: 409 } }).handler(() => {
			throw new ORPCError("CONFLICT", { message: "Conflict" });
		}),
		primitive: os.handler(() => {
			throw CV_TEXT;
		}),
		attachment: os.handler(() => {
			throw markLogMessageUnsafe(new ORPCError("BAD_REQUEST", { message: attachmentMessage }));
		}),
		attachmentUnmarked: os.handler(() => {
			throw new ORPCError("BAD_REQUEST", { message: attachmentMessage });
		}),
	},
};

function createHandler(withLogging: boolean) {
	const logging = createOrpcErrorLogging("[oRPC Server]", { logRoute: true });
	return new RPCHandler(router, {
		plugins: [new BatchHandlerPlugin()],
		...(withLogging
			? { interceptors: [logging.handlerInterceptor], clientInterceptors: [logging.clientInterceptor] }
			: {}),
	});
}

async function call(handler: RPCHandler<Record<never, never>>, path: string, body: string) {
	const request = new Request(`http://localhost/api/rpc/${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
	});
	const { response } = await handler.handle(request, { prefix: "/api/rpc", context: {} });
	if (!response) throw new Error("No response");
	return { status: response.status, body: await response.text() };
}

describe("oRPC error logging", () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => vi.restoreAllMocks());

	function loggedText() {
		return [...errorSpy.mock.calls, ...warnSpy.mock.calls]
			.flat()
			.map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
			.join("\n");
	}

	function expectNoSecrets(text: string) {
		for (const secret of SECRETS) expect(text).not.toContain(secret);
	}

	it("logs input validation failures without the raw input", async () => {
		await call(
			createHandler(true),
			"cvmate/review",
			JSON.stringify({ json: { extractedText: CV_TEXT, email: PHONE } }),
		);

		const logged = loggedText();
		expectNoSecrets(logged);
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(logged).toContain('"procedure":"cvmate.review"');
		expect(logged).toContain('"code":"BAD_REQUEST"');
		expect(logged).toContain('"name":"ValidationError"');
		expect(logged).toContain('"path":"extractedText"');
	});

	it("logs AI provider errors without the prompt, response body or URL query", async () => {
		await call(createHandler(true), "cvmate/recommend", JSON.stringify({ json: {} }));

		const logged = loggedText();
		expectNoSecrets(logged);
		for (const forbidden of ["requestBodyValues", "responseBody", "responseHeaders", "Rate limited"]) {
			expect(logged).not.toContain(forbidden);
		}
		expect(logged).toContain('"procedure":"cvmate.recommend"');
		expect(logged).toContain('"code":"BAD_GATEWAY"');
		expect(logged).toContain('"name":"AI_APICallError"');
		expect(logged).toContain('"statusCode":429');
		expect(logged).toContain('"providerHost":"api.openai.com"');
	});

	it("logs a real DrizzleQueryError chain by class names and codes, even with frame-like parameters", async () => {
		await call(createHandler(true), "cvmate/save", JSON.stringify({ json: {} }));

		const logged = loggedText();
		expectNoSecrets(logged);
		expect(logged).not.toContain("/a:1:1");
		expect(logged).toContain('"procedure":"cvmate.save"');
		expect(logged).toContain('"name":"DrizzleQueryError"');
		expect(logged).toContain('"code":"23505"');
		expect(logged).toContain('"constraint":"resume_slug_user_id_unique"');
	});

	it("logs failures outside a procedure once, with the route", async () => {
		await call(createHandler(true), "cvmate/review", `{"json": "${CV_TEXT}`);

		const logged = loggedText();
		expectNoSecrets(logged);
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(logged).toContain('"route":"/cvmate/review"');
	});

	it("logs a declared error once", async () => {
		await call(createHandler(true), "cvmate/declared", JSON.stringify({ json: {} }));

		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(loggedText()).toContain('"code":"CONFLICT"');
	});

	it("logs a thrown non-Error value once, without its value", async () => {
		await call(createHandler(true), "cvmate/primitive", JSON.stringify({ json: {} }));

		expectNoSecrets(loggedText());
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(loggedText()).toContain('"procedure":"cvmate.primitive"');
		expect(loggedText()).toContain('"valueType":"string"');
	});

	it("logs one line per failed call in a batch", async () => {
		const handler = createHandler(true);
		const fetchSpy = vi.fn(async (request: Request) => {
			const { response } = await handler.handle(request, { prefix: "/api/rpc", context: {} });
			if (!response) throw new Error("No response");
			return response;
		});
		const client = createORPCClient<RouterClient<typeof router>>(
			new RPCLink({
				url: "http://localhost/api/rpc",
				fetch: fetchSpy,
				plugins: [new BatchLinkPlugin({ mode: "buffered", groups: [{ condition: () => true, context: {} }] })],
			}),
		);

		const results = await Promise.allSettled([
			client.cvmate.declared(),
			client.cvmate.primitive(),
			client.cvmate.recommend(),
		]);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(results.every((result) => result.status === "rejected")).toBe(true);
		expect(errorSpy).toHaveBeenCalledTimes(3);
		const logged = loggedText();
		expectNoSecrets(logged);
		for (const procedure of ["cvmate.declared", "cvmate.primitive", "cvmate.recommend"]) {
			expect(logged).toContain(`"procedure":"${procedure}"`);
		}
	});

	it("omits the message of an error marked unsafe, without changing its response", async () => {
		const marked = await call(createHandler(true), "cvmate/attachment", JSON.stringify({ json: {} }));
		const unmarked = await call(createHandler(false), "cvmate/attachmentUnmarked", JSON.stringify({ json: {} }));

		const logged = loggedText();
		expectNoSecrets(logged);
		expect(logged).toContain('"code":"BAD_REQUEST"');
		expect(marked).toEqual(unmarked);
		expect(marked.body).toContain(attachmentMessage);
	});

	it("keeps the unsafe marker out of ORPCError.toJSON", () => {
		const error = markLogMessageUnsafe(new ORPCError("BAD_REQUEST", { message: attachmentMessage }));

		expect(error.toJSON()).toEqual(new ORPCError("BAD_REQUEST", { message: attachmentMessage }).toJSON());
		expect(JSON.stringify(error.toJSON())).not.toContain("unsafe");
	});

	it("does not change the HTTP response", async () => {
		const cases: [string, string][] = [
			["cvmate/review", JSON.stringify({ json: { extractedText: CV_TEXT, email: PHONE } })],
			["cvmate/recommend", JSON.stringify({ json: {} })],
			["cvmate/save", JSON.stringify({ json: {} })],
			["cvmate/declared", JSON.stringify({ json: {} })],
			["cvmate/primitive", JSON.stringify({ json: {} })],
			["cvmate/attachment", JSON.stringify({ json: {} })],
			["cvmate/review", `{"json": "${CV_TEXT}`],
		];

		for (const [path, body] of cases) {
			expect(await call(createHandler(true), path, body)).toEqual(await call(createHandler(false), path, body));
		}
	});
});
