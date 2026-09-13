// @vitest-environment happy-dom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Command } from "@reactive-resume/ui/components/command";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { appLocaleMap } from "@/libs/locale";
import { useCommandPaletteStore } from "../../store";
import { LanguageCommandPage } from "./language";

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

afterEach(() => {
	useCommandPaletteStore.setState({ open: false, search: "", pages: [] });
});

const renderPage = () =>
	render(
		<I18nProvider i18n={i18n}>
			<Command>
				<LanguageCommandPage />
			</Command>
		</I18nProvider>,
	);

describe("LanguageCommandPage", () => {
	it("does NOT render when the page stack does not have 'language' on top", () => {
		renderPage();

		expect(screen.queryByText("en-US")).toBeNull();
		expect(screen.queryByText("pl-PL")).toBeNull();
	});

	it("renders exactly the supported 1story interface locales when active", () => {
		useCommandPaletteStore.setState({ pages: ["language"] });
		renderPage();

		expect(Object.keys(appLocaleMap)).toEqual(["pl-PL", "en-US"]);

		for (const code of Object.keys(appLocaleMap)) {
			expect(screen.getByText(code)).toBeInTheDocument();
		}
	});

	it("does not render document-only locales", () => {
		useCommandPaletteStore.setState({ pages: ["language"] });
		renderPage();

		expect(screen.getByText("pl-PL")).toBeInTheDocument();
		expect(screen.getByText("en-US")).toBeInTheDocument();
		expect(screen.queryByText("de-DE")).toBeNull();
		expect(screen.queryByText("ja-JP")).toBeNull();
		expect(screen.queryByText("lv-LV")).toBeNull();
	});
});
