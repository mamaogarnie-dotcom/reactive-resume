// @vitest-environment happy-dom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
queryOptions: vi.fn(() => ({})),
mutationOptions: vi.fn((options?: unknown) => options ?? {}),
refetch: vi.fn(),
mutate: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
useQuery: vi.fn(),
useMutation: vi.fn(),
}));

vi.mock("@/libs/orpc/client", () => ({
orpc: {
cvmateProfile: {
getCurrent: {
queryOptions: mocks.queryOptions,
},
createExperienceFact: {
mutationOptions: mocks.mutationOptions,
},
updateExperienceFact: {
mutationOptions: mocks.mutationOptions,
},
deleteExperienceFact: {
mutationOptions: mocks.mutationOptions,
},
},
},
}));

const { AchievementsSection } = await import("./achievements");

const emptyProfile = {
experienceFacts: [],
};

beforeAll(() => {
i18n.loadAndActivate({ locale: "en", messages: {} });
});

beforeEach(() => {
vi.clearAllMocks();
mocks.refetch.mockResolvedValue(undefined);

vi.mocked(useQuery).mockReturnValue({
data: emptyProfile,
isLoading: false,
isError: false,
refetch: mocks.refetch,
} as unknown as ReturnType<typeof useQuery>);

vi.mocked(useMutation).mockReturnValue({
mutate: mocks.mutate,
isPending: false,
isError: false,
} as unknown as ReturnType<typeof useMutation>);
});

afterEach(cleanup);

const renderAchievements = () =>
render(
<I18nProvider i18n={i18n}>
<AchievementsSection />
</I18nProvider>,
);

describe("AchievementsSection", () => {
it("renders the dedicated Achievements section with an accessible heading", () => {
renderAchievements();

const heading = screen.getByRole("heading", { name: "Achievements" });
const section = heading.closest("section");

expect(section).not.toBeNull();
expect(section?.getAttribute("aria-labelledby")).toBe(heading.id);
});

it("renders only facts explicitly classified as achievements", () => {
vi.mocked(useQuery).mockReturnValue({
data: {
experienceFacts: [
{
id: "achievement-1",
text: "Reduced processing time by 30%",
kind: "achievement",
},
{
id: "responsibility-1",
text: "Managed daily administrative tasks",
kind: "responsibility",
},
{
id: "legacy-1",
text: "Legacy unclassified fact",
kind: "unspecified",
},
],
},
isLoading: false,
isError: false,
refetch: mocks.refetch,
} as unknown as ReturnType<typeof useQuery>);

renderAchievements();

expect(screen.getByText("Reduced processing time by 30%")).toBeInTheDocument();
expect(screen.queryByText("Managed daily administrative tasks")).toBeNull();
expect(screen.queryByText("Legacy unclassified fact")).toBeNull();
});

it("shows the Achievements empty state when no achievement facts exist", () => {
vi.mocked(useQuery).mockReturnValue({
data: {
experienceFacts: [
{
id: "responsibility-1",
text: "Managed daily administrative tasks",
kind: "responsibility",
},
{
id: "legacy-1",
text: "Legacy unclassified fact",
kind: "unspecified",
},
],
},
isLoading: false,
isError: false,
refetch: mocks.refetch,
} as unknown as ReturnType<typeof useQuery>);

renderAchievements();

expect(screen.getByText("No achievements added yet.")).toBeInTheDocument();
});

it("creates a new fact with explicit achievement kind", () => {
renderAchievements();

fireEvent.change(screen.getByRole("textbox", { name: "Achievement" }), {
target: { value: "  Increased annual contract value by 25%  " },
});

fireEvent.click(screen.getByRole("button", { name: "Add achievement" }));

expect(mocks.mutate).toHaveBeenCalledTimes(1);
expect(mocks.mutate).toHaveBeenCalledWith({
text: "Increased annual contract value by 25%",
kind: "achievement",
});
});
});
