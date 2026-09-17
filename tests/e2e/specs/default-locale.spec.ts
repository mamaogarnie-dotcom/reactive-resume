import { expect, test } from "../fixtures/test";

test.use({ uiLocale: null });

test("uses Polish as the default application locale when no locale cookie is present", async ({ page }) => {
	await page.goto("/auth/login");

	await expect(page.locator("html")).toHaveAttribute("lang", "pl-PL");

	const localeCookie = (await page.context().cookies()).find((cookie) => cookie.name === "locale");

	expect(localeCookie).toBeUndefined();
});
