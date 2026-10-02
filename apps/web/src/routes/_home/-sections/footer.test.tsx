// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

vi.stubGlobal("__APP_VERSION__", "9.9.9");

i18n.loadAndActivate({ locale: "en", messages: {} });

const { Footer } = await import("./footer");

const renderFooter = () =>
	render(
		<I18nProvider i18n={i18n}>
			<Footer />
		</I18nProvider>,
	);

describe("Footer", () => {
	it("renders the 1story link group headings", () => {
		renderFooter();
		expect(screen.getByText("Informacje")).toBeInTheDocument();
		expect(screen.getByText("Narzędzia")).toBeInTheDocument();
	});

	it("renders the 1story links", () => {
		const { container } = renderFooter();
		const text = container.textContent ?? "";
		for (const label of ["Polityka prywatności", "Kontakt", "Sprawdzanie ATS"]) {
			expect(text, label).toContain(label);
		}
	});

	it("does not link to upstream community, social or donation channels", () => {
		const { container } = renderFooter();
		const hrefs = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).map((a) => a.href);
		for (const blocked of ["discord.gg", "reddit.com", "linkedin.com", "x.com", "opencollective.com", "rxresu.me"]) {
			expect(
				hrefs.some((h) => h.includes(blocked)),
				blocked,
			).toBe(false);
		}
	});

	it("keeps the MIT license notice", () => {
		renderFooter();
		expect(screen.getByText("MIT")).toBeInTheDocument();
	});

	it("includes version copy via Copyright", () => {
		renderFooter();
		expect(screen.getByText("9.9.9")).toBeInTheDocument();
	});
});
