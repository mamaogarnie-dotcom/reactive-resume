import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { createResumeName } from "./data";

export async function createSampleResumeFromDashboard(page: Page, testInfo: TestInfo) {
	const resumeName = createResumeName(testInfo);
	const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
	const slug = resumeName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

	const response = await page.context().request.post(`${baseURL}/api/openapi/resumes`, {
		data: {
			name: resumeName,
			slug,
			tags: [],
			withSampleData: true,
		},
	});

	if (!response.ok()) {
		throw new Error(`Could not create E2E sample resume: ${response.status()} ${await response.text()}`);
	}

	const resumeId = (await response.json()) as string;

	if (typeof resumeId !== "string" || resumeId.length === 0) {
		throw new Error("Create resume API did not return a resume ID.");
	}

	await page.goto(`/builder/${resumeId}`);
	await page.waitForURL(/\/builder\/.+/);

	return resumeName;
}

export async function openSidebarSection(page: Page, title: string) {
	// Rail nav buttons are labelled with the section title (aria-label); clicking scrolls to the section.
	await page.getByRole("button", { name: title, exact: true }).first().click();
	// The visible section heading is exactly the title. Filter to visible because the screen-reader-only
	// resume mirror in the preview also renders <h2> section headings with the same name.
	await expect(page.getByRole("heading", { name: title, exact: true }).filter({ visible: true }).first()).toBeVisible();
}

export async function openResumeCardMenu(page: Page, resumeName: string, { reload = true } = {}) {
	if (reload) await page.goto("/dashboard/resumes");
	const resumeLink = page.getByRole("link", { name: new RegExp(resumeName) });
	await expect(resumeLink).toBeVisible();
	await resumeLink.click({ button: "right" });
	await expect(page.getByRole("menuitem", { name: "Open" })).toBeVisible();
}
