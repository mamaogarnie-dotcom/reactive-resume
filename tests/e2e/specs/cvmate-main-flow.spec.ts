import { readFile } from "node:fs/promises";
import { provisionCvmateAiProvider, startCvmateAiStub } from "../fixtures/cvmate-ai";
import { expect, test } from "../fixtures/test";

const jobOffer = [
	"Example Consulting is hiring a Project Coordinator in Wroclaw.",
	"Required: experience coordinating project delivery and client communication.",
	"Required: experience using Jira for project tracking.",
].join("\n");

const fact = "Coordinated project delivery and client communication.";
const summary = "Project coordinator with experience in project delivery and client communication.";
const gapText = "Experience using Jira for project tracking.";
const gapEvidence = "Jira";

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

		await page.goto("/dashboard/cvmate/create");

		const offerText = page.locator("#cvmate-job-offer-text");
		await expect(offerText).toBeVisible();
		await offerText.fill(jobOffer);
		await offerText.locator("xpath=ancestor::form").locator('button[type="submit"]').click();

		const analyzedHeading = page.getByRole("heading", { name: "Project Coordinator", exact: true });
		await expect(analyzedHeading).toBeVisible();

		const flow = analyzedHeading.locator("xpath=../../../..");
		await flow.locator('button[type="button"]').last().click();

		const selectionSection = flow
			.getByRole("heading", { name: "Choose CV content", exact: true })
			.locator("xpath=ancestor::section[1]");

		await expect(selectionSection).toBeVisible();

		const quickAddInput = selectionSection.getByPlaceholder("Responsibility", {
			exact: true,
		});

		await expect(quickAddInput).toBeVisible();
		await quickAddInput.fill(fact);

		const quickAddForm = quickAddInput.locator("xpath=ancestor::form");

		await quickAddForm.getByRole("button", { name: "Add responsibility", exact: true }).click();

		const factInSelection = selectionSection.getByText(fact, {
			exact: true,
		});

		await expect(factInSelection).toBeVisible();

		const retryRecommendations = selectionSection.getByRole("button", {
			name: "Retry AI recommendations",
			exact: true,
		});

		await expect(retryRecommendations).toBeEnabled();
		await retryRecommendations.click();

		await expect(
			factInSelection.locator("xpath=..").getByText("Recommended", {
				exact: true,
			}),
		).toBeVisible();
		const gapsSection = flow.getByRole("heading", { name: "Gaps", exact: true }).locator("xpath=ancestor::section[1]");

		const gapTextItem = gapsSection.getByText(gapText, {
			exact: true,
		});

		await expect(gapTextItem).toBeVisible();

		const gapCard = gapTextItem.locator("xpath=ancestor::div[.//form][1]");
		const gapForm = gapCard.locator("form");

		await gapForm.getByLabel("Type", { exact: true }).selectOption("tool");
		await gapForm.getByPlaceholder("Profile information", { exact: true }).fill(gapEvidence);

		await gapForm.getByRole("button", { name: "Add", exact: true }).click();

		await expect(gapsSection.getByText(gapText, { exact: true })).toHaveCount(0);
		await expect(gapsSection.getByText("No open gaps detected.", { exact: true })).toBeVisible();

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

		await page.goto("/dashboard/cvmate/profile");
		await expect(page.getByText(fact, { exact: true }).last()).toBeVisible();
		await expect(page.getByText(gapEvidence, { exact: true }).last()).toBeVisible();
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

	await expect(page.getByText("The job offer could not be analyzed.", { exact: true })).toBeVisible();
	await expect(offerText).toBeVisible();
	await expect(page.getByRole("heading", { name: "Project Coordinator", exact: true })).toHaveCount(0);
	await expect(page).toHaveURL(/\/dashboard\/cvmate\/create$/);
});
