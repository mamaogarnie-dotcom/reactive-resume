import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { APIRequestContext } from "@playwright/test";
import { createServer } from "node:http";

type CvmateAiStage = "connection" | "analysis" | "recommendations" | "tailored";

type CandidateSelectionItem = {
	id: string;
	sourceType: string;
};

type OpenAiRequest = {
	messages?: Array<{ content?: unknown }>;
};

export type CvmateAiStub = {
	baseURL: string;
	stages: CvmateAiStage[];
	close: () => Promise<void>;
};

function messageContentText(content: unknown): string {
	if (typeof content === "string") return content;

	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === "string") return part;
				if (!part || typeof part !== "object") return "";
				const text = "text" in part ? part.text : undefined;
				return typeof text === "string" ? text : "";
			})
			.join("\n");
	}

	return "";
}

function requestText(body: OpenAiRequest): string {
	return (body.messages ?? []).map((message) => messageContentText(message.content)).join("\n");
}

function taggedJson<T>(text: string, tag: string): T {
	const open = `<${tag}>`;
	const close = `</${tag}>`;
	const start = text.indexOf(open);
	const end = text.indexOf(close, start + open.length);

	if (start < 0 || end < 0) {
		throw new Error(`CVMATE_E2E_STUB_MISSING_TAG:${tag}`);
	}

	return JSON.parse(text.slice(start + open.length, end).trim()) as T;
}

function chatCompletion(content: string) {
	return {
		id: "chatcmpl-cvmate-e2e",
		object: "chat.completion",
		created: 1,
		model: "gpt-4.1",
		choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
		usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
	};
}

function responseFor(text: string): { stage: CvmateAiStage; content: string } {
	if (text.includes("You analyze job advertisements for a CV tailoring application.")) {
		return {
			stage: "analysis",
			content: JSON.stringify({
				roleTitle: "Project Coordinator",
				companyName: "Example Consulting",
				location: "Wroclaw",
				language: "en",
				requirements: [
					{
						category: "required",
						priority: "critical",
						sourceText: "Experience coordinating project delivery and client communication.",
						text: "Experience coordinating project delivery and client communication.",
					},
					{
						category: "required",
						priority: "important",
						sourceText: "Experience using Jira for project tracking.",
						text: "Experience using Jira for project tracking.",
					},
				],
			}),
		};
	}

	if (text.includes("You recommend content for a CV using only facts already stored")) {
		const items = taggedJson<CandidateSelectionItem[]>(text, "CANDIDATE_SELECTION_ITEMS");
		const fact = items.find((item) => item.sourceType === "experience_fact");
		const gapEligibleRequirementIds = taggedJson<string[]>(text, "GAP_ELIGIBLE_REQUIREMENT_IDS");
		const gapRequirementId = gapEligibleRequirementIds[1];

		if (!gapRequirementId) {
			throw new Error("CVMATE_E2E_STUB_MISSING_GAP_REQUIREMENT");
		}

		if (!fact) throw new Error("CVMATE_E2E_STUB_MISSING_EXPERIENCE_FACT");

		return {
			stage: "recommendations",
			content: JSON.stringify({
				recommendations: [
					{
						selectionItemId: fact.id,
						reason: "Direct evidence from the stored responsibility.",
					},
				],
				gapRequirementIds: [gapRequirementId],
				gapSuggestions: [
					{
						requirementId: gapRequirementId,
						kind: "tool",
						text: "Jira",
					},
				],
			}),
		};
	}

	if (text.includes("You create tailored CV wording using only facts explicitly contained")) {
		const ids = taggedJson<string[]>(text, "REWRITE_ELIGIBLE_SELECTION_IDS");

		return {
			stage: "tailored",
			content: JSON.stringify({
				professionalSummary: "Project coordinator with experience in project delivery and client communication.",
				experienceFacts: ids.map((selectionItemId) => ({
					selectionItemId,
					text: "Coordinated project delivery and client communication.",
				})),
			}),
		};
	}

	return { stage: "connection", content: "1" };
}

async function listen(server: Server): Promise<number> {
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject);
			resolve();
		});
	});

	const address = server.address();
	if (!address || typeof address === "string") throw new Error("CVMATE_E2E_STUB_NO_ADDRESS");

	return (address as AddressInfo).port;
}

export async function startCvmateAiStub(): Promise<CvmateAiStub> {
	const stages: CvmateAiStage[] = [];

	const server = createServer(async (request, response) => {
		if (request.method !== "POST") {
			response.writeHead(404).end();
			return;
		}

		try {
			const chunks: Buffer[] = [];
			for await (const chunk of request) {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			}

			const raw = Buffer.concat(chunks).toString("utf8");
			const body = JSON.parse(raw) as OpenAiRequest;
			const result = responseFor(requestText(body));
			stages.push(result.stage);

			response.writeHead(200, { "Content-Type": "application/json" });
			response.end(JSON.stringify(chatCompletion(result.content)));
		} catch (error) {
			response.writeHead(500, { "Content-Type": "application/json" });
			response.end(
				JSON.stringify({
					error: {
						message: error instanceof Error ? error.message : "CVMATE_E2E_STUB_ERROR",
					},
				}),
			);
		}
	});

	const port = await listen(server);

	return {
		baseURL: `http://127.0.0.1:${port}/v1`,
		stages,
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				});
			}),
	};
}

async function requireOk(response: Awaited<ReturnType<APIRequestContext["post"]>>, label: string) {
	if (response.ok()) return;

	throw new Error(`${label}:${response.status()}:${await response.text()}`);
}

export async function provisionCvmateAiProvider(request: APIRequestContext, baseURL: string) {
	const created = await request.post("/api/openapi/ai-providers", {
		data: {
			label: "CVMate E2E Stub",
			provider: "openai",
			model: "gpt-4.1",
			baseURL,
			apiKey: "sk-cvmate-e2e-stub",
		},
	});

	await requireOk(created, "CVMATE_E2E_PROVIDER_CREATE_FAILED");

	const provider = (await created.json()) as { id?: string };
	if (!provider.id) throw new Error("CVMATE_E2E_PROVIDER_CREATE_MISSING_ID");

	const testedResponse = await request.post(`/api/openapi/ai-providers/${encodeURIComponent(provider.id)}/test`);
	await requireOk(testedResponse, "CVMATE_E2E_PROVIDER_TEST_FAILED");

	const tested = (await testedResponse.json()) as {
		enabled?: boolean;
		testStatus?: string;
		testError?: string | null;
	};

	if (!tested.enabled || tested.testStatus !== "success") {
		throw new Error(`CVMATE_E2E_PROVIDER_NOT_RUNNABLE:${tested.testError ?? tested.testStatus ?? "unknown"}`);
	}

	return tested;
}
