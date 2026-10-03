import { pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { env } from "@reactive-resume/env/server";
import { logSafeError } from "@reactive-resume/utils/error-log";
import { exitOnFatalError } from "./fatal-error";
import { runStartupChecks } from "./startup/checks";

export async function main() {
	await runStartupChecks();

	// OAuth resource seeding starts when auth is imported, so load the app only
	// after migrations have created the provider tables.
	const { createApp } = await import("./http/app");

	// Safety net: Node 24 crashes the whole process on an unhandled rejection. One request's
	// stray promise must not take the server down for everyone, so log and keep serving.
	// Registered after startup checks so a broken startup still fails loudly. (Left uncaught
	// exceptions crashing, since process state is unsafe after one — but through the log
	// sanitizer, so Node does not print the error with its user-data-carrying causes.)
	process.on("unhandledRejection", (reason) => {
		logSafeError("[unhandledRejection]", reason);
	});
	process.on("uncaughtException", (error) => {
		exitOnFatalError("[uncaughtException]", error);
	});

	const port =
		process.env.NODE_ENV === "production" ? Number.parseInt(process.env.PORT ?? "3000", 10) : env.SERVER_PORT;

	const app = createApp();

	serve(
		{
			fetch: app.fetch,
			port,
		},
		(info) => {
			console.info(`🚀 Up and running on http://localhost:${info.port}`);
		},
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		exitOnFatalError("[startup]", error);
	});
}
