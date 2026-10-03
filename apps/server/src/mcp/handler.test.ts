import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ORPCError } from "@orpc/server";
import { APICallError } from "ai";
import { DrizzleQueryError } from "drizzle-orm";

const mocks = vi.hoisted(() => ({
	authenticateRequest: vi.fn(),
	createMcpServer: vi.fn(),
	getById: vi.fn(),
}));

vi.mock("@reactive-resume/env/server", () => ({ env: { APP_URL: "https://example.com" } }));
vi.mock("@reactive-resume/api/context", () => ({ resolveUserFromRequestHeaders: vi.fn() }));
vi.mock("@reactive-resume/api/features/resume/export", () => ({ createResumePdfDownloadUrl: vi.fn() }));
vi.mock("@reactive-resume/utils/error-log", () => ({ logSafeError: vi.fn() }));
vi.mock("./auth", () => ({
	AuthError: class AuthError extends Error {},
	authenticateRequest: mocks.authenticateRequest,
}));
vi.mock("./server", () => ({ createMcpServer: mocks.createMcpServer }));

const { MCP_TOOL_NAME, registerResources, registerTools } = await import("@reactive-resume/mcp");
const { AuthError } = await import("./auth");
const { handleMcp } = await import("./handler");

// Fictional data only.
const EMAIL = "jan.kowalski@example.com";
const SQL = 'select "data" from "resume" where "id" = $1 and "user_id" = $2';
const PROVIDER_BODY = "Incorrect API key provided: sk-proj-abc123. Prompt: Jan Kowalski, Senior Analyst";

const drizzleError = () => new DrizzleQueryError(SQL, ["resume-1", EMAIL], new Error("connection reset"));
const apiCallError = () =>
	new APICallError({
		message: PROVIDER_BODY,
		url: "https://api.openai.com/v1/chat/completions",
		requestBodyValues: { messages: [{ role: "user", content: "Jan Kowalski, Senior Analyst" }] },
		statusCode: 401,
		responseBody: JSON.stringify({ error: { message: PROVIDER_BODY } }),
	});

function realServer() {
	const server = new McpServer({ name: "test", version: "0.0.0" });
	const client = { resume: { getById: mocks.getById } };
	registerResources(server, client as never);
	registerTools(server, client as never, new Headers());
	return server;
}

function rpc(method: string, params: Record<string, unknown>) {
	return new Request("https://example.com/mcp", {
		method: "POST",
		headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
}

function expectNoLeak(body: string) {
	expect(body).not.toContain("select");
	expect(body).not.toContain(EMAIL);
	expect(body).not.toContain("sk-proj");
	expect(body).not.toContain("Jan Kowalski");
	expect(body).not.toContain("connection reset");
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.authenticateRequest.mockResolvedValue(undefined);
	mocks.createMcpServer.mockImplementation(realServer);
});

describe("handleMcp client-facing errors", () => {
	it.each([
		["a Drizzle query error", drizzleError],
		["an AI provider call error", apiCallError],
		["a plain Error with user data", () => new Error(`Cannot load resume of ${EMAIL}`)],
	])("returns a fixed message when request setup fails with %s", async (_name, makeError) => {
		mocks.createMcpServer.mockImplementation(() => {
			throw makeError();
		});

		const response = await handleMcp(rpc("tools/list", {}));
		const body = await response.text();

		expect(JSON.parse(body)).toEqual({
			id: null,
			jsonrpc: "2.0",
			error: { code: -32603, message: "Error handling request: INTERNAL_SERVER_ERROR: Internal server error" },
		});
		expectNoLeak(body);
	});

	it.each([
		["a Drizzle query error", drizzleError],
		["an AI provider call error", apiCallError],
	])("does not leak %s through a tool result", async (_name, makeError) => {
		mocks.getById.mockRejectedValueOnce(makeError());

		const response = await handleMcp(
			rpc("tools/call", { name: MCP_TOOL_NAME.getResume, arguments: { id: "resume-1" } }),
		);
		const body = await response.text();

		expect(JSON.parse(body).result).toEqual({
			isError: true,
			content: [{ type: "text", text: "Error getting resume: INTERNAL_SERVER_ERROR: Internal server error" }],
		});
		expectNoLeak(body);
	});

	it("does not leak a Drizzle query error through resources/read", async () => {
		mocks.getById.mockRejectedValueOnce(drizzleError());

		const response = await handleMcp(rpc("resources/read", { uri: "resume://resume-1" }));
		const body = await response.text();

		expect(JSON.parse(body).error).toMatchObject({
			code: -32603,
			message: "INTERNAL_SERVER_ERROR: Internal server error",
		});
		expectNoLeak(body);
	});

	it("keeps an ORPCError's code and message in a tool result", async () => {
		mocks.getById.mockRejectedValueOnce(new ORPCError("RESUME_LOCKED"));

		const response = await handleMcp(
			rpc("tools/call", { name: MCP_TOOL_NAME.getResume, arguments: { id: "resume-1" } }),
		);
		const { result } = await response.json();

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/^Error getting resume: RESUME_LOCKED\n\nHint: This resume is locked\./);
	});

	it("still answers an authentication failure with 401", async () => {
		mocks.authenticateRequest.mockRejectedValueOnce(new AuthError());

		const response = await handleMcp(rpc("tools/list", {}));

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ error: { code: -32603, message: "Unauthorized" } });
	});
});
