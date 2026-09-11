// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandList } from "@reactive-resume/ui/components/command";
import { useCommandPaletteStore } from "../store";

const mocks = vi.hoisted(() => ({
	pathname: "/",
	resumeQueryOptions: vi.fn((options?: unknown) => ({
		entity: "resumes",
		...(options ?? {}),
	})),
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-hotkeys", () => ({
	useHotkeys: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
	useRouteContext: () => ({ session: { user: { id: "user-1" } } }),
	useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
		select({ location: { pathname: mocks.pathname } }),
}));

vi.mock("@/features/theme/provider", () => ({
	useTheme: () => ({
		setTheme: vi.fn(),
		theme: "light",
		toggleTheme: vi.fn(),
	}),
}));

vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		resume: {
			list: {
				queryOptions: mocks.resumeQueryOptions,
			},
		},
	},
}));

const { CommandPalette } = await import("../index");
const { NavigationCommandGroup } = await import("./navigation");
const { ResumesCommandGroup } = await import("./resumes");

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

afterEach(() => {
	vi.clearAllMocks();
	mocks.pathname = "/";
	useCommandPaletteStore.setState({
		open: false,
		search: "",
		pages: [],
	});
});

const mockResumeQuery = (resumes: Array<{ id: string; name: string; slug: string }> = []) => {
	vi.mocked(useQuery).mockImplementation((() => {
		return {
			data: resumes,
			isLoading: false,
		} as ReturnType<typeof useQuery>;
	}) as typeof useQuery);
};

const renderGroup = () =>
	render(
		<I18nProvider i18n={i18n}>
			<Command>
				<CommandList>
					<ResumesCommandGroup />
				</CommandList>
			</Command>
		</I18nProvider>,
	);

function TestCommandPalette() {
	return (
		<I18nProvider i18n={i18n}>
			<CommandPalette />
		</I18nProvider>
	);
}

describe("ResumesCommandGroup", () => {
	it("opens the My CV command page from the root palette with Enter", async () => {
		mockResumeQuery([
			{
				id: "resume-1",
				name: "Product Resume",
				slug: "product-resume",
			},
		]);

		useCommandPaletteStore.setState({ open: true });
		render(<TestCommandPalette />);

		await userEvent.click(screen.getByRole("combobox"));
		await userEvent.keyboard("{Enter}");

		expect(useCommandPaletteStore.getState().pages).toEqual(["resumes"]);
		expect(await screen.findByText("Create CV")).toBeInTheDocument();
	});

	it("loads resumes with the existing Reactive Resume list contract", () => {
		useCommandPaletteStore.setState({ pages: ["resumes"] });
		mockResumeQuery([
			{
				id: "resume-1",
				name: "Product Resume",
				slug: "product-resume",
			},
		]);

		renderGroup();

		expect(mocks.resumeQueryOptions).toHaveBeenCalledWith({
			enabled: true,
			input: { sort: "lastUpdatedAt", tags: [] },
		});
		expect(screen.getByText("Product Resume")).toBeInTheDocument();
	});

	it("filters resume results from the command palette search", () => {
		useCommandPaletteStore.setState({
			pages: ["resumes"],
			search: "product",
		});
		mockResumeQuery([
			{
				id: "resume-1",
				name: "Product Resume",
				slug: "product-resume",
			},
			{
				id: "resume-2",
				name: "Finance Resume",
				slug: "finance-resume",
			},
		]);

		renderGroup();

		expect(screen.getByText("Product Resume")).toBeInTheDocument();
		expect(screen.queryByText("Finance Resume")).not.toBeInTheDocument();
	});

	it("routes CV creation through the CVMate flow", () => {
		useCommandPaletteStore.setState({ pages: ["resumes"] });
		mockResumeQuery();

		renderGroup();
		fireEvent.click(screen.getByText("Create CV"));

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/dashboard/cvmate/create",
		});
	});

	it("opens an existing resume in the mature Reactive Resume builder", () => {
		useCommandPaletteStore.setState({ pages: ["resumes"] });
		mockResumeQuery([
			{
				id: "resume-1",
				name: "Product Resume",
				slug: "product-resume",
			},
		]);

		renderGroup();
		fireEvent.click(screen.getByText("Product Resume"));

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/builder/$resumeId",
			params: { resumeId: "resume-1" },
		});
	});
});

describe("NavigationCommandGroup", () => {
	const renderNavigation = () =>
		render(
			<I18nProvider i18n={i18n}>
				<Command>
					<CommandList>
						<NavigationCommandGroup />
					</CommandList>
				</Command>
			</I18nProvider>,
		);

	it("shows the V1 CVMate navigation surface", () => {
		renderNavigation();

		expect(screen.getByText("Master Profile")).toBeInTheDocument();
		expect(screen.getByText("Create CV")).toBeInTheDocument();
		expect(screen.getByText("My CV")).toBeInTheDocument();
		expect(screen.getByText("ATS Checker")).toBeInTheDocument();

		expect(screen.queryByText("Applications")).not.toBeInTheDocument();
		expect(screen.queryByText("New Application")).not.toBeInTheDocument();
		expect(screen.queryByText("Threads")).not.toBeInTheDocument();
		expect(screen.queryByText("New Thread")).not.toBeInTheDocument();
	});

	it("navigates through the CVMate creation and ATS entry points", () => {
		renderNavigation();

		fireEvent.click(screen.getByText("Create CV"));
		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/dashboard/cvmate/create",
		});

		fireEvent.click(screen.getByText("ATS Checker"));
		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/ats-checker",
		});
	});
});
