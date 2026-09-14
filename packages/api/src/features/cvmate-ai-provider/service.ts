import {
aiProviderSchema,
type AIProvider,
} from "@reactive-resume/ai/types";

export type CvmateRunnableProvider = {
id: string | null;
provider: AIProvider;
model: string;
apiKey: string;
baseURL: string | null;
};

function resolveExplicitPlatformProvider(): CvmateRunnableProvider | null {
const provider = process.env.ONE_STORY_AI_PROVIDER?.trim();
const model = process.env.ONE_STORY_AI_MODEL?.trim();
const apiKey = process.env.ONE_STORY_AI_API_KEY?.trim();
const baseURL = process.env.ONE_STORY_AI_BASE_URL?.trim() || null;

const anyExplicit = Boolean(provider || model || apiKey || baseURL);

if (!anyExplicit) return null;

if (!provider || !model || !apiKey) {
throw new Error("ONE_STORY_PLATFORM_AI_CONFIGURATION_INVALID");
}

const parsed = aiProviderSchema.safeParse(provider);

if (!parsed.success) {
throw new Error("ONE_STORY_PLATFORM_AI_CONFIGURATION_INVALID");
}

return {
id: null,
provider: parsed.data,
model,
apiKey,
baseURL,
};
}

function resolveGoogleBootstrap(): CvmateRunnableProvider | null {
const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();

if (!apiKey) return null;

return {
id: null,
provider: "gemini",
model: "gemini-2.5-flash",
apiKey,
baseURL: null,
};
}

export function getPlatformCvmateProvider(): CvmateRunnableProvider | null {
return resolveExplicitPlatformProvider() ?? resolveGoogleBootstrap();
}