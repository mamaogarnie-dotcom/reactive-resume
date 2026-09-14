import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
	generateText: vi.fn(),
}));

vi.mock("ai", () => ({
	generateText: mocks.generateText,
}));

import { generateJson } from "./generate-json";

describe("generateJson usage capture", () => {
	beforeEach(() => {
		mocks.generateText.mockReset();
	});

	it("reports provider usage for a valid JSON response", async () => {
		const usage = {
			inputTokens: 120,
			outputTokens: 30,
			totalTokens: 150,
			inputTokenDetails: {
				cacheReadTokens: 20,
			},
		};

		mocks.generateText.mockResolvedValue({
			text: '{"value":"ok"}',
			usage,
		} as never);

		const onUsage = vi.fn();

		await expect(
			generateJson(
				{} as never,
				{ prompt: "test" },
				z.object({ value: z.string() }),
				{ onUsage },
			),
		).resolves.toEqual({ value: "ok" });

		expect(onUsage).toHaveBeenCalledOnce();
		expect(onUsage).toHaveBeenCalledWith(usage);
	});

	it("reports usage even when the provider response cannot be parsed", async () => {
		const usage = {
			inputTokens: 40,
			outputTokens: 10,
			totalTokens: 50,
		};

		mocks.generateText.mockResolvedValue({
			text: "not-json",
			usage,
		} as never);

		const onUsage = vi.fn();

		await expect(
			generateJson(
				{} as never,
				{ prompt: "test" },
				z.object({ value: z.string() }),
				{ onUsage },
			),
		).rejects.toThrow("The AI response could not be parsed.");

		expect(onUsage).toHaveBeenCalledOnce();
		expect(onUsage).toHaveBeenCalledWith(usage);
	});
});
