import type { Logger } from "better-auth";
import { sanitizeErrorForLog, scrubLogMessage } from "@reactive-resume/utils/error-log";

/**
 * Log sink for Better Auth.
 *
 * Better Auth's default logger prints the formatted message plus every extra argument verbatim:
 * rejected callback URLs (with their query string), Drizzle errors whose message embeds SQL
 * parameters (e-mail addresses, reset tokens), and raw error objects with their `cause` chain.
 *
 * This sink is fail-closed: messages are scrubbed, errors are reduced to the allowlisted shape of
 * `sanitizeErrorForLog`, and every other argument is logged by type only. It sets no `level`, so
 * Better Auth keeps its default threshold ("warn") and filters lower levels before calling `log`.
 */

type AuthLogLevel = Parameters<NonNullable<Logger["log"]>>[0];

const LEVEL_LABELS: Record<AuthLogLevel, string> = {
	error: "ERROR",
	warn: "WARN",
	info: "INFO",
	debug: "DEBUG",
};

// Drizzle appends the bound values of a failed query as "params: a,b,c" (e-mails, tokens).
const QUERY_PARAMS_PATTERN = /\bparams:[\s\S]*$/i;
// Runs of percent-encoded bytes ("%40", "%2E"), decoded so encoded e-mails and URLs are caught below.
const PERCENT_ENCODED_PATTERN = /(?:%[0-9A-Fa-f]{2})+/g;
// A query string or fragment on any URL-like token: absolute, protocol-relative, a path, or a bare "?a=b".
// The tail ends only at a space or tab, so a line break or U+2028 cannot cut it short and leave its rest visible.
const URL_QUERY_PATTERN = /([^\s?#"'`<>]*)[?#][^ \t"'`<>]*/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Strips control characters to keep one entry per line.
const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;
// "key=value" outside URLs ("session=\u2026", "token=\u2026", Postgres "Key (email)=(\u2026)"): the key stays, the value goes.
const KEY_VALUE_PATTERN = /(\(?[A-Za-z][\w.-]{0,40}\)?)=(?:\([^)]*\)|"[^"]*"|'[^']*'|[^\s&;,"'`<>]+)/g;
// Opaque tokens (reset/verification tokens, session ids, UUIDs): runs of 16+ characters mixing letters and digits.
const OPAQUE_TOKEN_PATTERN = /(?<![\w-])(?=[\w-]*[A-Za-z])(?=[\w-]*\d)[\w-]{16,}(?![\w-]*@)/g;

function decodePercentRun(run: string): string {
	try {
		return decodeURIComponent(run);
	} catch {
		return run;
	}
}

function stripQuery(match: string, prefix: string): string {
	// Keeps prose like "Why?" or "#3" intact: only tokens that look like a URL, path or key=value lose their tail.
	const looksLikeUrl = prefix.includes("/") || prefix.includes(".") || match.includes("=");
	return looksLikeUrl ? `${prefix}?[query]` : match;
}

/** Scrubs a Better Auth log message: SQL params, URL queries, control characters, key=value pairs, tokens and PII. */
export function sanitizeAuthLogMessage(message: unknown): string {
	if (typeof message !== "string") return `[non-string message: ${typeof message}]`;

	const stripped = message
		.replace(QUERY_PARAMS_PATTERN, "params: [redacted]")
		.replace(PERCENT_ENCODED_PATTERN, decodePercentRun)
		.replace(URL_QUERY_PATTERN, stripQuery)
		.replace(CONTROL_CHARACTERS_PATTERN, " ")
		.replace(KEY_VALUE_PATTERN, "$1=[value]")
		.replace(OPAQUE_TOKEN_PATTERN, "[TOKEN]");

	return scrubLogMessage(stripped);
}

function isErrorLike(value: object): boolean {
	try {
		return value instanceof Error || Object.prototype.toString.call(value) === "[object Error]";
	} catch {
		return false;
	}
}

function isArray(value: object): boolean {
	try {
		return Array.isArray(value);
	} catch {
		return false;
	}
}

/**
 * Describes one extra log argument: a sanitized error, or only a fixed type name for anything else
 * (never a constructor name, which an object parsed from user input can forge).
 */
export function describeAuthLogArg(value: unknown): unknown {
	if (value === null) return { type: "null" };
	if (typeof value !== "object") return { type: typeof value };
	if (isErrorLike(value)) return sanitizeErrorForLog(value);
	return { type: isArray(value) ? "array" : "object" };
}

function consoleMethod(level: AuthLogLevel): (...data: unknown[]) => void {
	if (level === "error") return console.error;
	if (level === "warn") return console.warn;
	return console.log;
}

function resolveLevel(level: unknown): AuthLogLevel {
	return typeof level === "string" && Object.hasOwn(LEVEL_LABELS, level) ? (level as AuthLogLevel) : "error";
}

/** Formats a Better Auth log entry as a single, sanitized line. */
export function formatAuthLogEntry(level: AuthLogLevel, message: unknown, args: unknown[]): string {
	const line = `${new Date().toISOString()} ${LEVEL_LABELS[level]} [Better Auth]: ${sanitizeAuthLogMessage(message)}`;
	if (args.length === 0) return line;
	return `${line} ${JSON.stringify({ args: args.map(describeAuthLogArg) })}`;
}

/** Better Auth `logger` option that never prints raw messages, URLs or error objects. */
export function createSafeAuthLogger(): Logger {
	return {
		log(level, message, ...args) {
			const safeLevel = resolveLevel(level);
			try {
				consoleMethod(safeLevel)(formatAuthLogEntry(safeLevel, message, args));
			} catch {
				try {
					consoleMethod(safeLevel)(`${LEVEL_LABELS[safeLevel]} [Better Auth]: [log entry dropped]`);
				} catch {
					// Logging must never break an auth request.
				}
			}
		},
	};
}
