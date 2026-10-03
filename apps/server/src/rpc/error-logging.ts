import { logSafeError } from "@reactive-resume/utils/error-log";

/** Per-request flag, carried in the oRPC context so it survives oRPC replacing the error object. */
const LOG_STATE = Symbol("orpc-error-log-state");

type LogState = { logged: boolean };
type ContextWithLogState = { [LOG_STATE]?: LogState };

type ClientInterceptorOptions = { path: readonly string[]; context: unknown; next: () => Promise<unknown> };
type HandlerInterceptorOptions<TOptions, T> = TOptions & {
	request: { url: URL };
	prefix?: string;
	context: object;
	next: (options?: TOptions) => Promise<T>;
};

type OrpcErrorLoggingOptions = {
	/**
	 * Adds the request pathname (minus prefix) for errors raised before a procedure runs. Safe for
	 * RPC, whose paths are procedure names; not for OpenAPI, whose paths can carry usernames/slugs.
	 */
	logRoute: boolean;
};

function logStateOf(context: unknown): LogState | undefined {
	return context !== null && typeof context === "object" ? (context as ContextWithLogState)[LOG_STATE] : undefined;
}

/**
 * Error logging for oRPC handlers and router clients. Errors are logged through `logSafeError`,
 * never verbatim: oRPC's input `ValidationError` carries the raw input and AI provider errors
 * carry the prompt, and both arrive here as `cause`.
 *
 * One line per failed call. The client interceptor logs with the procedure path and flags the
 * request; the handler interceptor logs only unflagged failures (body decoding). The flag lives in
 * a fresh per-request context — not on the error — because oRPC replaces declared errors with a
 * new object and primitives cannot be tagged. Batch sub-requests each get their own flag.
 */
export function createOrpcErrorLogging(label: string, options: OrpcErrorLoggingOptions) {
	const clientInterceptor = async ({ path, context, next }: ClientInterceptorOptions) => {
		try {
			return await next();
		} catch (error) {
			logSafeError(label, error, { procedure: path.join(".") });
			const state = logStateOf(context);
			if (state) state.logged = true;
			throw error;
		}
	};

	const handlerInterceptor = async <TOptions, T>(
		interceptorOptions: HandlerInterceptorOptions<TOptions, T>,
	): Promise<T> => {
		const { request, prefix, context, next, ...rest } = interceptorOptions;
		const state: LogState = { logged: false };

		try {
			return await next({
				...rest,
				request,
				prefix,
				context: { ...context, [LOG_STATE]: state },
			} as unknown as TOptions);
		} catch (error) {
			if (!state.logged) {
				const route = prefix ? request.url.pathname.replace(prefix, "") : request.url.pathname;
				logSafeError(label, error, options.logRoute ? { route } : undefined);
			}
			throw error;
		}
	};

	return { clientInterceptor, handlerInterceptor };
}
