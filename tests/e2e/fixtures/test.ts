import type { Page } from "@playwright/test";
import type { E2EUiLocale } from "./auth";
import type { E2EAccount } from "./data";
import { test as base, expect } from "@playwright/test";
import { applyE2EUiLocale, createAuthenticatedContext } from "./auth";
import { createAccount } from "./data";
import { deleteE2EUser } from "./db";

type Fixtures = {
	account: E2EAccount;
	authPage: Page;
	uiLocale: E2EUiLocale;
	_localeCookie: undefined;
};

export const test = base.extend<Fixtures>({
	uiLocale: ["en-US", { option: true }],
	_localeCookie: [
		async ({ context, baseURL, uiLocale }, use) => {
			await applyE2EUiLocale(context, String(baseURL ?? "http://localhost:3000"), uiLocale);

			await use();
		},
		{ auto: true },
	],
	account: async ({ baseURL: _baseURL }, use, testInfo) => {
		const account = createAccount(testInfo);

		try {
			await use(account);
		} finally {
			await deleteE2EUser(account);
		}
	},
	authPage: async ({ browser, request, account, uiLocale }, use, testInfo) => {
		const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
		const context = await createAuthenticatedContext(browser, request, account, baseURL, uiLocale);

		try {
			await use(await context.newPage());
		} finally {
			await context.close();
		}
	},
});

export { expect };
