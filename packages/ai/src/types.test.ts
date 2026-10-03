import { describe, expect, it } from "vitest";
import { isKnownAiProviderHost, isKnownAiProviderId } from "@reactive-resume/utils/error-log";
import { AI_PROVIDER_DEFAULT_BASE_URLS, aiProviderSchema } from "./types";

const popularProviderDefaults = {
	mistral: "https://api.mistral.ai/v1",
	cohere: "https://api.cohere.com/v2",
	xai: "https://api.x.ai/v1",
	groq: "https://api.groq.com/openai/v1",
	deepseek: "https://api.deepseek.com/v1",
	togetherai: "https://api.together.xyz/v1",
	fireworks: "https://api.fireworks.ai/inference/v1",
	cerebras: "https://api.cerebras.ai/v1",
	perplexity: "https://api.perplexity.ai",
} as const;

describe("AI provider types", () => {
	it("accepts popular AI SDK text providers with default base URLs", () => {
		for (const [provider, baseURL] of Object.entries(popularProviderDefaults)) {
			expect(aiProviderSchema.parse(provider)).toBe(provider);
			expect(AI_PROVIDER_DEFAULT_BASE_URLS[provider as keyof typeof AI_PROVIDER_DEFAULT_BASE_URLS]).toBe(baseURL);
		}
	});
});

// The error-log sanitizer keeps its own copy of these lists (utils cannot depend on ai): logs show
// a known provider/host verbatim and everything else as "custom", so the copies must stay in sync.
describe("error-log provider allowlists", () => {
	it("knows every supported provider id", () => {
		for (const provider of aiProviderSchema.options) {
			expect(isKnownAiProviderId(provider)).toBe(true);
		}
	});

	it("knows the host of every default provider base URL", () => {
		for (const baseURL of Object.values(AI_PROVIDER_DEFAULT_BASE_URLS)) {
			if (!baseURL) continue;
			expect(isKnownAiProviderHost(new URL(baseURL).host)).toBe(true);
		}
	});
});
