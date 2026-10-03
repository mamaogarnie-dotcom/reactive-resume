import { formatSafeErrorLog } from "@reactive-resume/utils/error-log";

const EXIT_FALLBACK_MS = 1000;

let exiting = false;

/**
 * Logs a fatal error through the log sanitizer and exits with code 1.
 *
 * Exits only once stderr has flushed the line: when stderr is a pipe (e.g. Docker on some
 * platforms) writes are asynchronous, and `process.exit()` right after `console.error` can drop
 * the last line. A timer guarantees the exit if the write callback never fires; it is deliberately
 * not `unref`'d, so it keeps the process alive until it fires instead of letting it end with code 0.
 */
export function exitOnFatalError(label: string, error: unknown): void {
	if (exiting) {
		// A second failure while already exiting: record it, but do not schedule another exit.
		try {
			process.stderr.write(`${formatSafeErrorLog(label, error)}\n`);
		} catch {
			// stderr is unusable; the pending exit still runs.
		}
		return;
	}

	exiting = true;
	const fallback = setTimeout(() => process.exit(1), EXIT_FALLBACK_MS);

	try {
		// A failed write (`writeError`) exits the same way: the log line is lost, the exit code is not.
		process.stderr.write(`${formatSafeErrorLog(label, error)}\n`, (_writeError?: Error | null) => {
			clearTimeout(fallback);
			process.exit(1);
		});
	} catch {
		clearTimeout(fallback);
		process.exit(1);
	}
}

/** Test-only: resets the once-only exit guard. */
export function resetFatalErrorStateForTests(): void {
	exiting = false;
}
