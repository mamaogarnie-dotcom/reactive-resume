// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

type SectionBaseProps = {
children: React.ReactNode;
};

vi.mock("../shared/section-base", () => ({
SectionBase: ({ children }: SectionBaseProps) => <div>{children}</div>,
}));

const { InformationSectionBuilder } = await import("./information");

beforeAll(() => {
i18n.loadAndActivate({ locale: "en", messages: {} });
});

const renderInfo = () =>
render(
<I18nProvider i18n={i18n}>
<InformationSectionBuilder />
</I18nProvider>,
);

describe("InformationSectionBuilder", () => {
it("renders the 1story information heading", () => {
renderInfo();

expect(screen.getByText("About 1story")).toBeInTheDocument();
});

it("explains the tailored CV workflow", () => {
renderInfo();

expect(
screen.getByText(
"1story helps you turn your career history into tailored CVs while keeping you in control of the final content.",
),
).toBeInTheDocument();

expect(
screen.getByText(
"Use the builder to review, refine, preview, and export the CV created from your Master Profile.",
),
).toBeInTheDocument();
});

it("does not render legacy Reactive Resume support or donation copy", () => {
renderInfo();

expect(screen.queryByText("Support the app by doing what you can!")).not.toBeInTheDocument();
expect(screen.queryByText("Donate to Reactive Resume")).not.toBeInTheDocument();
expect(screen.queryByText("Documentation")).not.toBeInTheDocument();
expect(screen.queryByText("Source Code")).not.toBeInTheDocument();
expect(screen.queryByText("Report a Bug")).not.toBeInTheDocument();
expect(screen.queryByText("Translations")).not.toBeInTheDocument();
expect(screen.queryByText("Sponsors")).not.toBeInTheDocument();
});

it("does not expose legacy external support links", () => {
renderInfo();

expect(screen.queryAllByRole("link")).toHaveLength(0);
});
});
