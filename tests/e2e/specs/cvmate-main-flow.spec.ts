import { readFile } from "node:fs/promises";
import { provisionCvmateAiProvider, startCvmateAiStub } from "../fixtures/cvmate-ai";
import { expect, test } from "../fixtures/test";

const jobOffer = [
	"Example Consulting is hiring a Project Coordinator in Wroclaw.",
	"Required: experience coordinating project delivery and client communication.",
].join("\n");

const fact = "Coordinated project delivery and client communication.";
const summary = "Project coordinator with experience in project delivery and client communication.";

test("CVMate happy path builds a tailored CV from profile to PDF export", async ({ authPage: page }) => {
	test.setTimeout(120_000);

	const stub = await startCvmateAiStub();

	try {
		await provisionCvmateAiProvider(page.request, stub.baseURL);

		await page.goto("/dashboard/cvmate/profile");

		const firstName = page.locator("#cvmate-first-name");
		const lastName = page.locator("#cvmate-last-name");
		await expect(firstName).toBeVisible();
		await firstName.fill("E2E");
		await lastName.fill("Candidate");

		const profileForm = firstName.locator("xpath=ancestor::form");
		const profileSaved = page.waitForResponse((response) => {
			const postData = response.request().postData() ?? "";
			return response.request().method() === "POST" && response.ok() && postData.includes('"firstName":"E2E"');
		});
		await profileForm.locator('button[type="submit"]').click();
		await profileSaved;

		await page.getByPlaceholder("Company", { exact: true }).fill("Example Consulting");
		await page.getByPlaceholder("Job title", { exact: true }).fill("Project Coordinator");
		await page.getByRole("button", { name: "Add employment", exact: true }).click();
		await expect(page.getByText("Project Coordinator", { exact: true }).last()).toBeVisible();

		await page.getByPlaceholder("Responsibility or achievement", { exact: true }).fill(fact);
		await page.getByRole("button", { name: "Add fact", exact: true }).click();
		await expect(page.getByText(fact, { exact: true }).last()).toBeVisible();

		await page.goto("/dashboard/cvmate/create");

		const offerText = page.locator("#cvmate-job-offer-text");
		await expect(offerText).toBeVisible();
		await offerText.fill(jobOffer);
		await offerText.locator("xpath=ancestor::form").locator('button[type="submit"]').click();

		const analyzedHeading = page.getByRole("heading", { name: "Project Coordinator", exact: true });
		await expect(analyzedHeading).toBeVisible();

		const flow = analyzedHeading.locator("xpath=../../../..");
		await flow.locator('button[type="button"]').last().click();

		const factInSelection = flow.getByText(fact, { exact: true }).first();
		await expect(factInSelection).toBeVisible();

		const selectionSection = factInSelection.locator("xpath=ancestor::section[1]");
		const selectRecommended = selectionSection.locator('button[type="button"]').last();
		await expect(selectRecommended).toBeEnabled();
		await selectRecommended.click();

		const continueButton = flow.locator('button[type="button"]').last();
		await expect(continueButton).toBeEnabled();
		await continueButton.click();

		await expect
			.poll(async () =>
				flow
					.locator("textarea")
					.evaluateAll((elements) => elements.map((element) => (element as HTMLTextAreaElement).value)),
			)
			.toContain(summary);

		const openEditorButton = flow.locator('button[type="button"]').last();
		await expect(openEditorButton).toBeEnabled();
		await openEditorButton.click();
		await page.waitForURL(/\/builder\/.+/);

		expect(stub.stages).toEqual(expect.arrayContaining(["connection", "analysis", "recommendations", "tailored"]));

		const resumeHeading = page.getByRole("heading", {
			name: "Project Coordinator - Example Consulting",
			exact: true,
		});
		await expect(resumeHeading).toBeVisible();

		const headerTitleGroup = resumeHeading.locator("xpath=..");
		const headerActions = headerTitleGroup.locator("xpath=following-sibling::div[1]");
		const headerButtons = headerActions.locator("button");
		const downloadTrigger = headerButtons.first();

		await expect(downloadTrigger).toBeEnabled();
		await downloadTrigger.click();

		const pdfButton = page.getByRole("button", { name: "Download PDF", exact: true });

		try {
			await expect(pdfButton).toBeVisible({ timeout: 5_000 });
		} catch (error) {
			const diagnostics = await headerButtons.evaluateAll((buttons) =>
				buttons.map((button, index) => ({
					index,
					ariaLabel: button.getAttribute("aria-label"),
					ariaHaspopup: button.getAttribute("aria-haspopup"),
					disabled: (button as HTMLButtonElement).disabled,
					text: button.textContent?.trim() ?? "",
					outerHTML: button.outerHTML.slice(0, 600),
				})),
			);

			throw new Error(
				`CVMate export: first right-header button did not open the PDF dialog. Buttons=${JSON.stringify(diagnostics)}; original=${String(error)}`,
			);
		}
		await expect(pdfButton).toBeVisible();

		const pendingDownload = page.waitForEvent("download");
		await pdfButton.click();
		const download = await pendingDownload;

		expect(await download.failure()).toBeNull();
		const downloadPath = await download.path();
		if (!downloadPath) throw new Error("CVMate PDF download did not produce a file.");

		expect((await readFile(downloadPath)).subarray(0, 5).toString()).toBe("%PDF-");
	} finally {
		await stub.close();
	}
});

test("CVMate reports a missing AI provider without advancing the offer flow", async ({ authPage: page }) => {
	await page.goto("/dashboard/cvmate/create");

	const offerText = page.locator("#cvmate-job-offer-text");
	await expect(offerText).toBeVisible();
	await offerText.fill(jobOffer);

	const offerForm = offerText.locator("xpath=ancestor::form");
	await offerForm.locator('button[type="submit"]').click();

	await expect(page.getByText("No tested AI provider is available.", { exact: true })).toBeVisible();
	await expect(offerText).toBeVisible();
	await expect(page.getByRole("heading", { name: "Project Coordinator", exact: true })).toHaveCount(0);
	await expect(page).toHaveURL(/\/dashboard\/cvmate\/create$/);
});
