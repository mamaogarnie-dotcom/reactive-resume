import { constants, existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { env } from "@reactive-resume/env/server";
import { logSafeError } from "@reactive-resume/utils/error-log";
import { getLocalDataDirectory } from "@reactive-resume/utils/monorepo.node";

function resolveFromCurrentModule(relativePath: string) {
	return fileURLToPath(new URL(relativePath, import.meta.url));
}

function resolveWorkspaceFolder(folderName: string): string {
	let dir = resolveFromCurrentModule(".");

	while (dir !== path.dirname(dir)) {
		const candidate = path.join(dir, folderName);
		if (existsSync(candidate)) return candidate;
		dir = path.dirname(dir);
	}

	throw new Error(`Could not locate ${folderName} folder relative to ${resolveFromCurrentModule(".")}`);
}

async function runDatabaseMigrations() {
	console.info("Running database migrations...");

	const pool = new Pool({ connectionString: env.DATABASE_URL });
	const db = drizzle({ client: pool });

	try {
		await migrate(db, { migrationsFolder: resolveWorkspaceFolder("migrations") });
		console.info("Database migrations completed");
	} catch (error) {
		logSafeError("Database migrations failed", error);
		throw error;
	} finally {
		await pool.end();
	}
}

async function validateLocalStoragePath() {
	if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET) return;

	const dataDirectory = getLocalDataDirectory(env.LOCAL_STORAGE_PATH);
	console.info(`Validating local storage path: ${dataDirectory}`);

	try {
		await fs.mkdir(dataDirectory, { recursive: true });
		await fs.access(dataDirectory, constants.R_OK | constants.W_OK);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(
			`Local storage path is not writable: ${dataDirectory}\n` +
				`  ${message}\n` +
				"Set LOCAL_STORAGE_PATH to a writable directory or fix permissions on the existing path.",
		);
		throw error;
	}
}

// Mirrors the transport check in @reactive-resume/email: without all four, emails are skipped.
export function warnIfSmtpNotConfigured() {
	if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM) return;

	console.warn(
		"SMTP is not configured: verification, password reset and email change emails will not be sent. " +
			"Set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM.",
	);
}

const PLATFORM_AI_ISSUE_MESSAGES = {
	unsupported_provider: "ONE_STORY_AI_PROVIDER is not a supported platform provider (only groq is)",
	incomplete: "ONE_STORY_AI_PROVIDER, ONE_STORY_AI_MODEL and ONE_STORY_AI_API_KEY must all be set",
} as const;

// Names the problem only: a configured value (the API key above all) never reaches the log.
export async function warnIfPlatformAiMisconfigured() {
	const { getPlatformAiConfigIssue } = await import("@reactive-resume/api/features/cvmate-ai-provider");
	const issue = getPlatformAiConfigIssue();
	if (!issue) return;

	console.warn(
		`The 1story platform AI provider is unavailable: ${PLATFORM_AI_ISSUE_MESSAGES[issue]}. ` +
			"Users without a tested AI provider of their own cannot use AI features.",
	);
}

async function reapStaleAgentRuns() {
	try {
		const { reapStaleAgentRunsAtBoot } = await import("@reactive-resume/api/features/agent/runs");
		await reapStaleAgentRunsAtBoot();
	} catch (error) {
		// A reap failure must not block serving traffic; stuck runs also heal lazily on access.
		logSafeError("Failed to reap stale agent runs at boot", error);
	}
}

export async function runStartupChecks() {
	await runDatabaseMigrations();
	await validateLocalStoragePath();
	warnIfSmtpNotConfigured();
	await warnIfPlatformAiMisconfigured();
	await reapStaleAgentRuns();
}
