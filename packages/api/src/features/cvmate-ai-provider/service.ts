import { aiProviderSchema, type AIProvider } from "@reactive-resume/ai/types";
import { env } from "@reactive-resume/env/server";

export type PlatformCvmateProvider = {
id: null;
provider: AIProvider;
model: string;
apiKey: string;
baseURL: string | null;
};

function invalidConfiguration(): never {
throw new Error("ONE_STORY_PLATFORM_AI_CONFIGURATION_INVALID");
}

export function getPlatformCvmateProvider(): PlatformCvmateProvider | null {
const explicitProvider = env.ONE_STORY_AI_PROVIDER?.trim();
const explicitModel = env.ONE_STORY_AI_MODEL?.trim();
const explicitApiKey = env.ONE_STORY_AI_API_KEY?.trim();
const explicitBaseURL = env.ONE_STORY_AI_BASE_URL?.trim();

const hasExplicitConfiguration = Boolean(
explicitProvider || explicitModel || explicitApiKey || explicitBaseURL,
);

if (hasExplicitConfiguration) {
if (!explicitProvider || !explicitModel || !explicitApiKey) {
return invalidConfiguration();
}

const parsedProvider = aiProviderSchema.safeParse(explicitProvider);

if (!parsedProvider.success) {
return invalidConfiguration();
}

return {
id: null,
provider: parsedProvider.data,
model: explicitModel,
apiKey: explicitApiKey,
baseURL: explicitBaseURL || null,
};
}

const bootstrapGoogleKey =
process.env.NODE_ENV === "production"
? env.GOOGLE_CLOUD_API_KEY?.trim()
: undefined;

if (!bootstrapGoogleKey) return null;

return {
id: null,
provider: "gemini",
model: "",
apiKey: bootstrapGoogleKey,
baseURL: null,
};
}