// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

const state = vi.hoisted(() => ({
	usableProviders: [] as Array<{ id: string; label: string; provider: "openai"; model: string }>,
	platformAiEnabled: false,
	mutate: vi.fn(),
}));

vi.mock("@/features/settings/integrations/hooks/use-has-usable-ai-provider", () => ({
	useHasUsableAiProvider: () => ({
		usableProviders: state.usableProviders,
		hasUsableProvider: state.usableProviders.length > 0,
		isLoading: false,
		error: null,
	}),
}));
vi.mock("@tanstack/react-router", () => ({
	useRouteContext: () => ({ flags: { platformAiEnabled: state.platformAiEnabled } }),
	Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({ mutate: state.mutate, isPending: false }),
}));
vi.mock("@/libs/orpc/client", () => ({ orpc: { ai: { atsReview: { mutationOptions: () => ({}) } } } }));
vi.mock("@/features/settings/integrations/components/ai-provider-picker", () => ({
	AiProviderPicker: () => <div data-testid="provider-picker" />,
}));
vi.mock("@reactive-resume/ui/components/toast", () => ({ toast: { add: vi.fn() } }));
vi.mock("../messages", () => ({ getPdfFindingMessage: () => ({ title: "Finding" }) }));

const { AiReviewCard } = await import("./ai-review-card");

i18n.loadAndActivate({ locale: "en", messages: {} });

const report = { findings: [] } as never;

function renderCard() {
	return render(
		<I18nProvider i18n={i18n}>
			<AiReviewCard report={report} fullText="Specjalista ds. logistyki, 2019–2024." />
		</I18nProvider>,
	);
}

beforeEach(() => {
	state.usableProviders = [];
	state.platformAiEnabled = false;
	state.mutate.mockReset();
});

describe("AiReviewCard provider availability", () => {
	it("asks for a provider of the user's own when the platform provider is off", () => {
		renderCard();

		expect(screen.getByText(/Connect your own AI provider/)).toBeTruthy();
		expect(screen.queryByText("Run AI review")).toBeNull();
	});

	it("runs on the platform provider without a picker or provider id when the user has none", () => {
		state.platformAiEnabled = true;
		renderCard();

		expect(screen.queryByText(/Connect your own AI provider/)).toBeNull();
		expect(screen.queryByTestId("provider-picker")).toBeNull();
		expect(screen.getByText(/to the 1story AI provider/)).toBeTruthy();

		fireEvent.click(screen.getByText("Run AI review"));

		expect(state.mutate).toHaveBeenCalledOnce();
		expect(state.mutate.mock.calls[0]?.[0]).not.toHaveProperty("aiProviderId");
	});

	it("prefers the user's own provider even when the platform provider is on", () => {
		state.platformAiEnabled = true;
		state.usableProviders = [{ id: "provider-1", label: "Mine", provider: "openai", model: "gpt-4o-mini" }];
		renderCard();

		expect(screen.getByTestId("provider-picker")).toBeTruthy();
		expect(screen.queryByText(/to the 1story AI provider/)).toBeNull();

		fireEvent.click(screen.getByText("Run AI review"));

		expect(state.mutate.mock.calls[0]?.[0]).toMatchObject({ aiProviderId: "provider-1" });
	});
});
