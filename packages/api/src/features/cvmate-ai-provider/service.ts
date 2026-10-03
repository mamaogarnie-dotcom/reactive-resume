import type { AIProvider } from "@reactive-resume/ai/types";
import { ORPCError } from "@orpc/client";
import { env } from "@reactive-resume/env/server";
import { aiProvidersService } from "../ai-providers/service";

export type CvmateRunnableProvider = {
	/** The user's saved provider id; `null` for the 1story platform provider. */
	id: string | null;
	provider: AIProvider;
	model: string;
	apiKey: string;
	baseURL: string | null;
};

/** Providers the platform may run on. The key is paid by 1story, so this list is deliberately narrow. */
const PLATFORM_PROVIDERS: ReadonlySet<AIProvider> = new Set<AIProvider>(["groq"]);

export const PLATFORM_AI_ENV_NAMES = [
	"ONE_STORY_AI_PROVIDER",
	"ONE_STORY_AI_MODEL",
	"ONE_STORY_AI_API_KEY",
	"ONE_STORY_AI_BASE_URL",
] as const;

/** Why a configured platform provider is unavailable. Never carries a configured value. */
export type PlatformAiConfigIssue = "unsupported_provider" | "incomplete";

function readPlatformConfig() {
	return {
		provider: env.ONE_STORY_AI_PROVIDER?.trim() ?? "",
		model: env.ONE_STORY_AI_MODEL?.trim() ?? "",
		apiKey: env.ONE_STORY_AI_API_KEY?.trim() ?? "",
		baseURL: env.ONE_STORY_AI_BASE_URL?.trim() ?? "",
	};
}

function isPlatformProvider(value: string): value is AIProvider {
	return PLATFORM_PROVIDERS.has(value as AIProvider);
}

/** `null` when the platform provider is either usable or not configured at all. */
export function getPlatformAiConfigIssue(): PlatformAiConfigIssue | null {
	const config = readPlatformConfig();

	if (!config.provider && !config.model && !config.apiKey && !config.baseURL) return null;
	if (config.provider && !isPlatformProvider(config.provider)) return "unsupported_provider";
	if (!config.provider || !config.model || !config.apiKey) return "incomplete";

	return null;
}

/** The 1story platform provider, available only when ONE_STORY_AI_* is set explicitly and completely. */
export function getPlatformCvmateProvider(): CvmateRunnableProvider | null {
	const config = readPlatformConfig();

	if (!isPlatformProvider(config.provider) || !config.model || !config.apiKey) return null;

	return {
		id: null,
		provider: config.provider,
		model: config.model,
		apiKey: config.apiKey,
		baseURL: config.baseURL || null,
	};
}

export function isPlatformAiProviderAvailable(): boolean {
	return getPlatformCvmateProvider() !== null;
}

/**
 * Picks the provider for a 1story AI feature: the provider the user chose (which must be enabled and
 * tested, with no fallback), then the user's default tested provider, then the platform provider.
 */
export async function resolveCvmateAiProvider(input: {
	userId: string;
	aiProviderId?: string;
}): Promise<CvmateRunnableProvider> {
	if (input.aiProviderId) {
		const chosen = await aiProvidersService.getRunnableById({ id: input.aiProviderId, userId: input.userId });
		return toRunnable(chosen);
	}

	const userDefault = await aiProvidersService.getDefaultRunnable({ userId: input.userId });
	if (userDefault) return toRunnable(userDefault);

	const platform = getPlatformCvmateProvider();
	if (platform) return platform;

	throw new ORPCError("BAD_REQUEST", { message: "No tested AI provider is available." });
}

function toRunnable(provider: {
	id: string;
	provider: AIProvider;
	model: string;
	apiKey: string;
	baseURL: string | null;
}): CvmateRunnableProvider {
	return {
		id: provider.id,
		provider: provider.provider,
		model: provider.model,
		apiKey: provider.apiKey,
		baseURL: provider.baseURL,
	};
}
