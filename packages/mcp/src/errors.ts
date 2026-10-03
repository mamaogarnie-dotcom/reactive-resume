import { ORPCError } from "@orpc/server";

export type McpClientError = { code: string; message: string };

const INTERNAL_ERROR: McpClientError = { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" };

/**
 * Maps any thrown value to what an MCP client may see, mirroring oRPC's `toORPCError`.
 *
 * The router client used by MCP rethrows procedure errors as-is, so a Drizzle query error (SQL and
 * params), an AI SDK `APICallError` (provider response body) or any other internal error would
 * otherwise reach the client verbatim. Only `ORPCError`s carry a developer-authored message meant
 * for the caller; everything else collapses to a fixed internal error.
 */
export function toMcpClientError(error: unknown): McpClientError {
	if (error instanceof ORPCError) return { code: error.code, message: error.message };
	return INTERNAL_ERROR;
}

/** `CODE: message`, or just `CODE` when the error was thrown without a message of its own. */
export function formatMcpClientError(error: unknown): string {
	const { code, message } = toMcpClientError(error);
	return message && message !== code ? `${code}: ${message}` : code;
}
