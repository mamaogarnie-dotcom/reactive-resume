import type { AIProvider } from "@reactive-resume/ai/types";
import { db } from "@reactive-resume/db/client";
import type { CvmateAiOperation } from "@reactive-resume/db/schema";
import * as schema from "@reactive-resume/db/schema";
import type { AiTokenUsage } from "../ai/generate-json";

type RecordCvmateAiUsageInput = {
	userId: string;
	cvBuildId?: string | null;
	jobOfferId?: string | null;
	aiProviderId?: string | null;
	operation: CvmateAiOperation;
	provider: AIProvider;
	model: string;
	usage: AiTokenUsage;
};

function normalizeTokenCount(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		return null;
	}

	return Math.trunc(value);
}

function usageSnapshot(usage: AiTokenUsage): Record<string, unknown> {
	return JSON.parse(JSON.stringify(usage)) as Record<string, unknown>;
}

export const cvmateAiUsageService = {
	record: async (input: RecordCvmateAiUsageInput): Promise<void> => {
		try {
			await db.insert(schema.cvmateAiUsage).values({
				userId: input.userId,
				cvBuildId: input.cvBuildId ?? null,
				jobOfferId: input.jobOfferId ?? null,
				aiProviderId: input.aiProviderId ?? null,
				operation: input.operation,
				provider: input.provider,
				model: input.model,
				inputTokens: normalizeTokenCount(input.usage.inputTokens),
				outputTokens: normalizeTokenCount(input.usage.outputTokens),
				cachedInputTokens: normalizeTokenCount(
					input.usage.inputTokenDetails?.cacheReadTokens,
				),
				totalTokens: normalizeTokenCount(input.usage.totalTokens),
				usageSnapshot: usageSnapshot(input.usage),
			});
		} catch (error) {
			// The provider call has already incurred cost. Failing the user's operation here
			// would encourage a retry and could spend tokens twice, so telemetry persistence
			// is best-effort until pre-call budgets are introduced in AI-COST 2.
			console.error("Failed to persist 1story AI usage.", {
				operation: input.operation,
				provider: input.provider,
				model: input.model,
				error,
			});
		}
	},
};
