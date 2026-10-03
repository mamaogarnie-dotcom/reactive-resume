/**
 * Log-safe error serialization.
 *
 * Error objects routinely carry user data: oRPC's input `ValidationError` holds the raw request
 * input, AI SDK's `APICallError` holds the whole prompt and response body, Drizzle query errors
 * embed SQL parameters in their message, and Postgres `detail` echoes column values. Logging an
 * error as-is prints all of it, including every nested `cause`.
 *
 * `sanitizeErrorForLog` is fail-closed: it copies only allowlisted, structural fields (class
 * names, codes, statuses, schema identifiers, stack frames) and never a message unless the error
 * type is known to carry a developer-authored one — and even then the message is scrubbed, and
 * dropped entirely for errors marked with {@link markLogMessageUnsafe}.
 */

const MAX_CHAIN_DEPTH = 8;
const MAX_TOTAL_ENTRIES = 32;
const MAX_AGGREGATE_ERRORS = 5;
const MAX_ISSUES = 10;
const MAX_STACK_FRAMES = 10;
const MAX_FRAME_LENGTH = 300;
const MAX_MESSAGE_LENGTH = 200;

const SAFE_NAME = /^[\w$.:-]{1,80}$/;
// Stricter than SAFE_NAME: a name with ":" or a line break could forge or extend the stack header.
const STACK_NAME = /^[\w$.-]{1,80}$/;
const SAFE_CODE = /^[\w.:-]{1,64}$/;
const SAFE_IDENTIFIER = /^[A-Za-z_$][\w$-]{0,40}$/;
const SAFE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_PROCEDURE = /^[A-Za-z_$][\w$]{0,40}(?:\.[A-Za-z_$][\w$]{0,40}){0,10}$/;
const SAFE_ROUTE = /^\/[\w$/.-]{0,120}$/;
const SAFE_METHOD = /^[A-Z]{3,7}$/;
const SAFE_OPERATION = /^[\w.:-]{1,64}$/;

// V8 frames only: "at fn (file:1:2)", "at file:1:2", "at fn (native)", "at async Promise.all (index 0)".
const FRAME_FUNCTION = String.raw`(?:(?:new|async) )?[\w$.<>[\]]{1,120}(?: \[as [\w$]{1,60}\])?`;
const FRAME_LOCATION = String.raw`[^\s()]{1,250}:\d+:\d+`;
const STACK_FRAME = new RegExp(
	String.raw`^at (?:${FRAME_FUNCTION} \((?:${FRAME_LOCATION}|native|index \d+)\)|(?:async )?${FRAME_LOCATION})$`,
);

const FILE_EXTENSIONS = "pdf|docx?|odt|rtf|txt|png|jpe?g|webp|heic";
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s"'`<>]+/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const QUOTED_FILE_PATTERN = new RegExp(`(["'\`])[^"'\`\\n]*?\\.(?:${FILE_EXTENSIONS})\\1`, "gi");
const FILE_PATTERN = new RegExp(`[^\\s"'\`<>()]+\\.(?:${FILE_EXTENSIONS})\\b`, "gi");
const DIGIT_RUN_PATTERN = /\+?\d(?:[ .-]?\d){6,}/g;

const UNSAFE_MESSAGE = Symbol.for("@reactive-resume/utils/error-log.unsafe-message");

// Node module resolution errors name only the import specifier and server file paths, and without
// the message the log cannot say which module is missing.
const NODE_RESOLUTION_ERROR_CODES: ReadonlySet<unknown> = new Set([
	"ERR_MODULE_NOT_FOUND",
	"ERR_PACKAGE_PATH_NOT_EXPORTED",
]);

// Hosts of the providers' default base URLs; any other (user-configured) host is logged as "custom".
const KNOWN_AI_PROVIDER_HOSTS: ReadonlySet<string> = new Set([
	"api.openai.com",
	"api.anthropic.com",
	"generativelanguage.googleapis.com",
	"ai-gateway.vercel.sh",
	"openrouter.ai",
	"api.mistral.ai",
	"api.cohere.com",
	"api.cohere.ai",
	"api.x.ai",
	"api.groq.com",
	"api.deepseek.com",
	"api.together.xyz",
	"api.fireworks.ai",
	"api.cerebras.ai",
	"api.perplexity.ai",
	"ollama.com",
]);

const KNOWN_AI_PROVIDER_IDS: ReadonlySet<string> = new Set([
	"openai",
	"anthropic",
	"gemini",
	"vercel-ai-gateway",
	"openrouter",
	"mistral",
	"cohere",
	"xai",
	"groq",
	"deepseek",
	"togetherai",
	"fireworks",
	"cerebras",
	"perplexity",
	"ollama",
	"openai-compatible",
]);

// Model families from the providers' public catalogs, optionally vendor-prefixed ("openai/gpt-4o").
// Lowercase identifier characters only, so an e-mail address or free text never matches.
const KNOWN_MODEL =
	/^(?:[a-z0-9-]{1,40}\/)?(?:gpt-|o[1-9]|chatgpt-|claude-|gemini-|gemma-|mistral-|mixtral-|ministral-|codestral-|pixtral-|magistral-|devstral-|open-mistral|open-mixtral|command|grok-|deepseek-|llama|meta-llama|qwen|qwq-|kimi-|sonar|accounts\/fireworks\/models\/)[a-z0-9._:/-]{0,80}$/;

export type SafeErrorEntry = {
	name: string;
	valueType?: string;
	message?: string;
	code?: string | number;
	status?: number;
	statusCode?: number;
	isRetryable?: boolean;
	syscall?: string;
	errno?: number;
	severity?: string;
	schema?: string;
	table?: string;
	column?: string;
	constraint?: string;
	routine?: string;
	providerHost?: string;
	issues?: { code?: string; path: string; pathDepth: number }[];
	issueCount?: number;
	errors?: SafeErrorLog[];
	stack?: string[];
};

export type SafeErrorLog = {
	chain: SafeErrorEntry[];
	truncated?: true;
};

type SafeLogContextKey =
	| "procedure"
	| "route"
	| "method"
	| "operation"
	| "provider"
	| "model"
	| "userId"
	| "resumeId"
	| "threadId"
	| "runId";

/** Log context: allowlisted keys only, and each value is validated against its key's format. */
export type SafeLogContext = Partial<Record<SafeLogContextKey, string | null | undefined>>;

const CONTEXT_RULES: Record<SafeLogContextKey, (value: string) => string> = {
	procedure: (value) => (SAFE_PROCEDURE.test(value) ? value : "[redacted]"),
	route: (value) => (SAFE_ROUTE.test(value) ? value : "[redacted]"),
	method: (value) => (SAFE_METHOD.test(value) ? value : "[redacted]"),
	operation: (value) => (SAFE_OPERATION.test(value) ? value : "[redacted]"),
	provider: (value) => (KNOWN_AI_PROVIDER_IDS.has(value) ? value : "custom"),
	model: (value) => (KNOWN_MODEL.test(value) ? value : "custom"),
	userId: (value) => (SAFE_ID.test(value) ? value : "[redacted]"),
	resumeId: (value) => (SAFE_ID.test(value) ? value : "[redacted]"),
	threadId: (value) => (SAFE_ID.test(value) ? value : "[redacted]"),
	runId: (value) => (SAFE_ID.test(value) ? value : "[redacted]"),
};

/**
 * Masks values that look like personal data in a message that is otherwise safe to log:
 * URLs, e-mail addresses, file names and long digit runs (phone numbers, IDs). Truncates to 200 chars.
 */
export function scrubLogMessage(message: string): string {
	const scrubbed = message
		.replace(URL_PATTERN, "[URL]")
		.replace(EMAIL_PATTERN, "[EMAIL]")
		.replace(QUOTED_FILE_PATTERN, "[FILE]")
		.replace(FILE_PATTERN, "[FILE]")
		.replace(DIGIT_RUN_PATTERN, "[NUM]");

	return scrubbed.length > MAX_MESSAGE_LENGTH ? `${scrubbed.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : scrubbed;
}

/** Whether a host is the default endpoint of a supported AI provider (otherwise logged as "custom"). */
export function isKnownAiProviderHost(host: string): boolean {
	return KNOWN_AI_PROVIDER_HOSTS.has(host);
}

/** Whether a provider id is one of the supported AI providers (otherwise logged as "custom"). */
export function isKnownAiProviderId(provider: string): boolean {
	return KNOWN_AI_PROVIDER_IDS.has(provider);
}

/**
 * Marks an error whose message embeds user data (a file name, a client-declared type): the log
 * keeps its name, code and status but never its message. Returns the same error, for `throw`.
 * The marker is a non-enumerable symbol, so client serialization (e.g. `ORPCError.toJSON`) is unchanged.
 */
export function markLogMessageUnsafe<T>(error: T): T {
	if (error !== null && typeof error === "object") {
		try {
			Object.defineProperty(error, UNSAFE_MESSAGE, { value: true, enumerable: false, configurable: true });
		} catch {
			// A frozen or exotic object cannot be marked; its message is still scrubbed.
		}
	}
	return error;
}

/** Reads a property without letting a throwing getter or proxy trap escape. */
function read(value: object, key: string | symbol): unknown {
	try {
		return (value as Record<string | symbol, unknown>)[key];
	} catch {
		return undefined;
	}
}

function isErrorLike(value: object): boolean {
	try {
		return value instanceof Error || Object.prototype.toString.call(value) === "[object Error]";
	} catch {
		return false;
	}
}

function safeString(value: unknown, pattern: RegExp): string | undefined {
	return typeof value === "string" && pattern.test(value) ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function rawConstructorName(value: object): unknown {
	try {
		return (value as { constructor?: { name?: unknown } }).constructor?.name;
	} catch {
		return undefined;
	}
}

function constructorName(value: object): string | undefined {
	return safeString(rawConstructorName(value), SAFE_NAME);
}

function errorName(value: object): string {
	const own = safeString(read(value, "name"), SAFE_NAME);
	if (own && own !== "Error") return own;
	return constructorName(value) ?? own ?? "Error";
}

/** oRPC's `ORPCError`, recognized by shape so this module stays dependency-free. */
function isOrpcError(value: object): boolean {
	return (
		typeof read(value, "code") === "string" &&
		typeof read(value, "status") === "number" &&
		typeof read(value, "defined") === "boolean"
	);
}

function hasSafeMessage(value: object, name: string): boolean {
	if (read(value, UNSAFE_MESSAGE) === true) return false;
	if (isOrpcError(value)) return true;
	if (NODE_RESOLUTION_ERROR_CODES.has(read(value, "code"))) return true;
	if (name === "ValidationError" && Array.isArray(read(value, "issues"))) return true;
	return name === "AbortError" || name === "TimeoutError";
}

function safePathSegment(segment: unknown): string {
	if (typeof segment === "number" && Number.isInteger(segment)) return String(segment);
	if (typeof segment === "string" && SAFE_IDENTIFIER.test(segment)) return segment;
	if (segment !== null && typeof segment === "object") return safePathSegment(read(segment, "key"));
	return "[key]";
}

function safeIssues(issues: unknown[]): Pick<SafeErrorEntry, "issues" | "issueCount"> {
	// First segment and depth only: deeper segments can be keys chosen by the user (`z.record`).
	const safe = issues.slice(0, MAX_ISSUES).map((issue) => {
		if (issue === null || typeof issue !== "object") return { path: "", pathDepth: 0 };
		const path = read(issue, "path");
		const segments: unknown[] = Array.isArray(path) ? path : [];
		const code = safeString(read(issue, "code"), SAFE_CODE);
		return {
			...(code ? { code } : {}),
			path: segments.length > 0 ? safePathSegment(segments[0]) : "",
			pathDepth: segments.length,
		};
	});

	return { issues: safe, issueCount: issues.length };
}

/** V8 stack headers ("Name: message", "Name" or "message") for every name the error may carry. */
function stackHeaders(value: object): string[] | undefined {
	// An own name that is not a plain identifier (e.g. with ":" or a line break) makes the header
	// ambiguous, so there is no trustworthy cut: the caller drops the stack.
	const ownName = read(value, "name");
	if (typeof ownName !== "string" || !STACK_NAME.test(ownName)) return undefined;

	const rawMessage = read(value, "message");
	const message = typeof rawMessage === "string" ? rawMessage : "";
	const names = new Set<string>(["Error", ownName]);
	const ctorName = rawConstructorName(value);
	if (typeof ctorName === "string" && STACK_NAME.test(ctorName)) names.add(ctorName);

	return [...names].map((name) => (message ? `${name}: ${message}` : name));
}

function safeStack(value: object): string[] | undefined {
	const stack = read(value, "stack");
	if (typeof stack !== "string") return undefined;

	// The header repeats the message, which may span lines and even contain frame-like text. Cut
	// exactly the known header; a stack that does not start with exactly one candidate header is
	// dropped entirely. Known limitation: a `stack` overwritten by code is trusted after its header —
	// only frame syntax is checked, so code must never assign user data to `error.stack`.
	const headers = stackHeaders(value);
	if (!headers) return undefined;
	const matches = headers.filter((candidate) => stack === candidate || stack.startsWith(`${candidate}\n`));
	if (matches.length !== 1) return undefined;
	const header = matches[0] as string;

	const frames = stack
		.slice(header.length)
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length <= MAX_FRAME_LENGTH && STACK_FRAME.test(line))
		.slice(0, MAX_STACK_FRAMES);
	return frames.length > 0 ? frames : undefined;
}

function safeProviderHost(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	try {
		const host = new URL(value).host;
		if (!host) return undefined;
		return KNOWN_AI_PROVIDER_HOSTS.has(host) ? host : "custom";
	} catch {
		return undefined;
	}
}

function sanitizeContext(context: SafeLogContext | undefined): Record<string, string> {
	const safe: Record<string, string> = {};
	if (!context) return safe;

	for (const key of Object.keys(CONTEXT_RULES) as SafeLogContextKey[]) {
		const value = read(context, key);
		if (typeof value === "string") safe[key] = CONTEXT_RULES[key](value);
	}

	return safe;
}

type Budget = { entries: number; seen: Set<object> };

function describeValue(value: unknown, budget: Budget): SafeErrorEntry {
	if (value === null || typeof value !== "object") {
		return { name: "NonError", valueType: value === null ? "null" : typeof value };
	}

	const errorLike = isErrorLike(value);
	const name = errorLike ? errorName(value) : "NonError";
	const entry: SafeErrorEntry = { name };

	if (!errorLike) {
		entry.valueType = constructorName(value) ?? "object";
	}

	if (errorLike && hasSafeMessage(value, name)) {
		const message = read(value, "message");
		if (typeof message === "string" && message.length > 0) entry.message = scrubLogMessage(message);
	}

	const code = read(value, "code");
	if (typeof code === "number" && Number.isFinite(code)) entry.code = code;
	else if (safeString(code, SAFE_CODE)) entry.code = code as string;

	const status = safeNumber(read(value, "status"));
	if (status !== undefined) entry.status = status;

	const statusCode = safeNumber(read(value, "statusCode"));
	if (statusCode !== undefined) entry.statusCode = statusCode;

	const isRetryable = read(value, "isRetryable");
	if (typeof isRetryable === "boolean") entry.isRetryable = isRetryable;

	// Node system errors: `path`, `dest`, `hostname`, `address` and `info` are deliberately not
	// copied — they can name an uploaded file or a user-supplied base URL.
	const syscall = safeString(read(value, "syscall"), SAFE_IDENTIFIER);
	if (syscall) entry.syscall = syscall;
	const errno = safeNumber(read(value, "errno"));
	if (errno !== undefined) entry.errno = errno;

	// Postgres (`pg` DatabaseError): schema identifiers only; never `detail`, `where`, `hint`.
	for (const key of ["severity", "schema", "table", "column", "constraint", "routine"] as const) {
		const identifier = safeString(read(value, key), SAFE_IDENTIFIER);
		if (identifier) entry[key] = identifier;
	}

	// AI SDK `APICallError`: a known provider host is useful; a custom host is user configuration.
	if (name.startsWith("AI_")) {
		const providerHost = safeProviderHost(read(value, "url"));
		if (providerHost) entry.providerHost = providerHost;
	}

	const issues = read(value, "issues");
	if (Array.isArray(issues)) Object.assign(entry, safeIssues(issues));

	const errors = read(value, "errors");
	if (Array.isArray(errors) && errors.length > 0) {
		entry.errors = errors.slice(0, MAX_AGGREGATE_ERRORS).map((nested) => sanitizeChain(nested, budget));
	}

	if (errorLike) {
		const stack = safeStack(value);
		if (stack) entry.stack = stack;
	}

	return entry;
}

function sanitizeChain(error: unknown, budget: Budget): SafeErrorLog {
	const chain: SafeErrorEntry[] = [];
	let current: unknown = error;

	for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
		if (budget.entries >= MAX_TOTAL_ENTRIES) return { chain, truncated: true };

		if (current !== null && typeof current === "object") {
			if (budget.seen.has(current)) {
				chain.push({ name: "[Circular]" });
				return { chain };
			}
			budget.seen.add(current);
		}

		budget.entries++;
		chain.push(describeValue(current, budget));

		if (current === null || typeof current !== "object") return { chain };
		const cause = read(current, "cause");
		if (cause === undefined) return { chain };
		current = cause;
	}

	return { chain, truncated: true };
}

/** Builds a log-safe, allowlisted description of any thrown value and its `cause` chain. */
export function sanitizeErrorForLog(error: unknown): SafeErrorLog {
	try {
		return sanitizeChain(error, { entries: 0, seen: new Set() });
	} catch {
		return { chain: [{ name: "[Unserializable]" }] };
	}
}

/** Formats a single log line: the label followed by a JSON payload with context and the safe error. */
export function formatSafeErrorLog(label: string, error: unknown, context?: SafeLogContext): string {
	return `${label} ${JSON.stringify({ ...sanitizeContext(context), error: sanitizeErrorForLog(error) })}`;
}

/** `console.error` replacement for thrown values: never prints messages, data or causes verbatim. */
export function logSafeError(label: string, error: unknown, context?: SafeLogContext): void {
	console.error(formatSafeErrorLog(label, error, context));
}

/** `console.warn` counterpart of {@link logSafeError}. */
export function logSafeWarning(label: string, error: unknown, context?: SafeLogContext): void {
	console.warn(formatSafeErrorLog(label, error, context));
}
