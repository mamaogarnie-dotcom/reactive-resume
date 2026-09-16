// @vitest-environment happy-dom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
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
				call: vi.fn(),
			},
			createListItem: { mutationOptions: mocks.mutationOptions },
			updateListItem: { mutationOptions: mocks.mutationOptions },
			deleteListItem: { mutationOptions: mocks.mutationOptions },
			upsertClause: { call: vi.fn() },
		},
	},
}));

const { ProfileDetailsSection } = await import("./profile-details");

const emptyProfile = {
	projects: [],
	education: [],
	courses: [],
	certifications: [],
	volunteer: [],
	languages: [],
	awards: [],
	references: [],
	licenses: [],
	listItems: [],
	clauses: [],
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

const renderProfileDetails = () =>
	render(
		<I18nProvider i18n={i18n}>
			<ProfileDetailsSection />
		</I18nProvider>,
	);

describe("ProfileDetailsSection", () => {
	it("renders the stable Master Profile section headings", () => {
		renderProfileDetails();

		for (const name of [
			"Skills",
			"Software",
			"Tools",
			"Interests",
			"Projects",
			"Education",
			"Recruitment clauses",
		])
			expect(screen.getByRole("heading", { name })).toBeInTheDocument();
	});

	it("keeps representative sections labelled by their visible headings", () => {
		renderProfileDetails();

		for (const name of ["Skills", "Projects", "Recruitment clauses"]) {
			const heading = screen.getByRole("heading", { name });
			const section = heading.closest("section");

			expect(section).not.toBeNull();
			expect(section?.getAttribute("aria-labelledby")).toBe(heading.id);
		}
	});

	it("renders the three recruitment-clause choices as one radio group", () => {
		renderProfileDetails();

		const radios = screen.getAllByRole("radio");

		expect(radios).toHaveLength(3);
		expect(
			screen.getByRole("radio", { name: "Do not add a recruitment clause" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("radio", { name: "Current recruitment only" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("radio", {
				name: "Current and future recruitment processes",
			}),
		).toBeInTheDocument();
		expect(
			new Set(radios.map((radio) => radio.getAttribute("name"))),
		).toEqual(new Set(["recruitment-clause-scope"]));
	});

	it("gives both language editors an accessible name in each clause scope", () => {
		renderProfileDetails();

		expect(
			screen.getAllByRole("textbox", { name: "Polish version" }),
		).toHaveLength(2);
		expect(
			screen.getAllByRole("textbox", { name: "English version" }),
		).toHaveLength(2);
	});
});
