// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Command } from "@reactive-resume/ui/components/command";
import { useCommandPaletteStore } from "../../store";

const { PreferencesCommandGroup } = await import("./index");

beforeAll(() => {
i18n.loadAndActivate({ locale: "en", messages: {} });
});

afterEach(() => {
useCommandPaletteStore.setState({ open: false, search: "", pages: [] });
});

const renderGroup = () =>
render(
<I18nProvider i18n={i18n}>
<Command>
<PreferencesCommandGroup />
</Command>
</I18nProvider>,
);

describe("PreferencesCommandGroup", () => {
it("exposes language but not theme preferences in 1story V1", () => {
renderGroup();

expect(screen.getByText("Change language to…")).toBeInTheDocument();
expect(screen.queryByText("Change theme to…")).toBeNull();
});

it("pushes language onto the page stack", () => {
renderGroup();

fireEvent.click(screen.getByText("Change language to…"));

expect(useCommandPaletteStore.getState().pages).toContain("language");
expect(useCommandPaletteStore.getState().pages).not.toContain("theme");
});
});