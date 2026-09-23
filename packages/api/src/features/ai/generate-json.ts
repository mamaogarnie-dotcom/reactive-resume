import { ORPCError } from "@orpc/client";
import type { LanguageModel, LanguageModelUsage } from "ai";
import { generateText } from "ai";
import type { z } from "zod";

export type AiTokenUsage = LanguageModelUsage;

export type GenerateJsonPrompt = {
	system?: string;
	prompt: string;
};

export type GenerateJsonOptions = {
	maxOutputTokens?: number;
	providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
	onUsage?: (usage: AiTokenUsage) => void | Promise<void>;
};

/**
 * `generateText` plus tolerant JSON extraction and Zod validation.
 *
 * The SDK's `generateObject` is not wired for every provider this app supports, and several
 * providers wrap JSON in prose or a code fence whatever the prompt says, so the response is parsed
 * defensively: strip a fence if there is one, take the outermost braces, then validate.
 *
 * Usage is emitted immediately after the provider responds, before JSON parsing/validation,
 * because malformed provider output still incurred AI cost.
 */
export async function generateJson<T>(
	model: LanguageModel,
	{ system, prompt }: GenerateJsonPrompt,
	schema: z.ZodType<T>,
	options: GenerateJsonOptions = {},
): Promise<T> {
	const result = await generateText({
		model,
		...(system ? { system } : {}),
		...(options.maxOutputTokens !== undefined ? { maxOutputTokens: options.maxOutputTokens } : {}),
		...(options.providerOptions !== undefined ? { providerOptions: options.providerOptions } : {}),
		messages: [{ role: "user", content: prompt }],
	});

	await options.onUsage?.(result.usage);

	const { text } = result;
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	const candidate = fenced?.[1] ?? text;

	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");

	if (start === -1 || end === -1 || end < start) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "The AI response could not be parsed.",
		});
	}

	return schema.parse(JSON.parse(candidate.slice(start, end + 1)));
}
