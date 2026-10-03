import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exitOnFatalError, resetFatalErrorStateForTests } from "./fatal-error";

const CV_TEXT = "Jan Kowalski — Senior Fikcyjny Analityk w Firma Testowa";
const EMAIL = "jan.kowalski@example.com";

function fatalError() {
	return Object.assign(new Error(`Crashed for ${EMAIL}`, { cause: new Error(CV_TEXT) }), {
		code: "E_FATAL",
		data: CV_TEXT,
	});
}

describe("exitOnFatalError", () => {
	let writeCallbacks: ((error?: Error | null) => void)[];
	let written: string[];
	let exitSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.useFakeTimers();
		resetFatalErrorStateForTests();
		writeCallbacks = [];
		written = [];
		vi.spyOn(process.stderr, "write").mockImplementation(((
			chunk: string,
			callback?: (error?: Error | null) => void,
		) => {
			written.push(chunk);
			if (callback) writeCallbacks.push(callback);
			return true;
		}) as typeof process.stderr.write);
		exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as typeof process.exit);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("exits with code 1 only after stderr has flushed the sanitized line", () => {
		exitOnFatalError("[uncaughtException]", fatalError());

		expect(exitSpy).not.toHaveBeenCalled();
		expect(written).toHaveLength(1);
		expect(written[0]).toContain("[uncaughtException]");
		expect(written[0]).toContain('"code":"E_FATAL"');
		expect(written[0]).not.toContain(EMAIL);
		expect(written[0]).not.toContain("Kowalski");

		writeCallbacks[0]?.();
		expect(exitSpy).toHaveBeenCalledExactlyOnceWith(1);
	});

	it("falls back to a timed exit when the write callback never fires", () => {
		exitOnFatalError("[uncaughtException]", fatalError());

		vi.advanceTimersByTime(999);
		expect(exitSpy).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(exitSpy).toHaveBeenCalledExactlyOnceWith(1);
	});

	it("logs but does not schedule another exit for a second fatal error", () => {
		exitOnFatalError("[uncaughtException]", fatalError());
		exitOnFatalError("[uncaughtException]", new Error(EMAIL));

		expect(written).toHaveLength(2);
		expect(written[1]).not.toContain(EMAIL);
		expect(writeCallbacks).toHaveLength(1);

		writeCallbacks[0]?.();
		vi.runAllTimers();
		expect(exitSpy).toHaveBeenCalledTimes(1);
	});

	it("exits with code 1 when the write callback reports an error", () => {
		exitOnFatalError("[uncaughtException]", fatalError());

		writeCallbacks[0]?.(new Error("EPIPE"));
		expect(exitSpy).toHaveBeenCalledExactlyOnceWith(1);
		vi.runAllTimers();
		expect(exitSpy).toHaveBeenCalledTimes(1);
	});

	it("keeps the fallback timer referenced so the process cannot end with code 0", () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

		exitOnFatalError("[uncaughtException]", fatalError());

		const timer = setTimeoutSpy.mock.results[0]?.value as NodeJS.Timeout;
		expect(timer.hasRef()).toBe(true);
	});

	it("exits immediately when stderr throws", () => {
		vi.mocked(process.stderr.write).mockImplementation(() => {
			throw new Error("EPIPE");
		});

		exitOnFatalError("[uncaughtException]", fatalError());

		expect(exitSpy).toHaveBeenCalledExactlyOnceWith(1);
	});
});
