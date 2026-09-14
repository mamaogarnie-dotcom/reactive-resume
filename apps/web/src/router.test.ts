import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	localeLoaded: false,
	routeTreeImportedBeforeLocale: false,
}));

const mocks = vi.hoisted(() => ({
	createRouter: vi.fn((options: unknown) => options),
}));

vi.mock("@tanstack/react-router", () => ({
	createRouter: mocks.createRouter,
}));

vi.mock("./components/layout/error-screen", () => ({
	ErrorScreen: () => null,
}));

vi.mock("./components/layout/loading-screen", () => ({
	LoadingScreen: () => null,
}));

vi.mock("./components/layout/not-found-screen", () => ({
	NotFoundScreen: () => null,
}));

vi.mock("./libs/auth/session", () => ({
	getSession: async () => null,
}));

vi.mock("./libs/locale", () => ({
	getLocale: () => "pl-PL",
	loadLocale: async () => {
		state.localeLoaded = true;
	},
}));

vi.mock("./libs/orpc/client", () => ({
	client: {
		flags: {
			get: async () => ({}),
		},
	},
	orpc: {},
}));

vi.mock("./libs/query/client", () => ({
	getQueryClient: () => ({}),
}));

vi.mock("./libs/theme", () => ({
	getTheme: () => "light",
}));

vi.mock("./routeTree.gen", () => {
	state.routeTreeImportedBeforeLocale = !state.localeLoaded;

	return {
		routeTree: {},
	};
});

import { getRouter } from "./router";

describe("router localization bootstrap", () => {
	beforeEach(() => {
		state.localeLoaded = false;
		state.routeTreeImportedBeforeLocale = false;
		mocks.createRouter.mockClear();
	});

	it("activates Lingui before importing route modules", async () => {
		await getRouter();

		expect(state.localeLoaded).toBe(true);
		expect(state.routeTreeImportedBeforeLocale).toBe(false);
		expect(mocks.createRouter).toHaveBeenCalledOnce();
	});
});
