// @vitest-environment happy-dom

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDocx } from "@reactive-resume/docx";
import { getResumeSectionTitle } from "@reactive-resume/pdf/section-title";
import { createCvmatePdfCorpus } from "./cvmate-fixture";
import { extractDocx } from "./extract";
import { evaluateExport, tokenize } from "./metrics";

const outputDirectory = resolve(process.cwd(), "ats-export-evaluation/test-results");

function containsTokenSequence(observedValues: readonly string[], expectedValue: string): boolean {
	const observed = observedValues.flatMap(tokenize);
	const expected = tokenize(expectedValue);

	return observed.some((_, index) => expected.every((token, offset) => observed[index + offset] === token));
}

describe("CVMate DOCX export contract", () => {
	it("exports adapter data as editable DOCX with Polish section titles and no selected-content loss", async () => {
		await mkdir(outputDirectory, { recursive: true });

		const corpus = createCvmatePdfCorpus();
		const before = JSON.stringify(corpus.data);
		const resolveTitle = (sectionId: string) => getResumeSectionTitle(corpus.data, sectionId);

		expect(corpus.data.metadata.page.locale).toBe("pl-PL");

		const blob = await buildDocx(corpus.data, resolveTitle);
		const bytes = new Uint8Array(await blob.arrayBuffer());
		const archive = await JSZip.loadAsync(bytes);
		const documentXml = await archive.file("word/document.xml")?.async("string");

		expect(documentXml).toBeDefined();
		expect(documentXml).toContain("<w:t");
		expect(documentXml).toContain("Bioarbor");

		const docx = await extractDocx(bytes);
		const paragraphTexts = docx.paragraphs.map((paragraph) => paragraph.text);
		const metrics = evaluateExport(corpus, {
			paragraphs: paragraphTexts,
			links: docx.links,
		});

		await writeFile(join(outputDirectory, "cvmate-docx-contract.docx"), bytes);

		expect(JSON.stringify(corpus.data)).toBe(before);
		expect(metrics.recall.denominator).toBeGreaterThan(20);
		expect(metrics.missingTokens).toEqual([]);
		expect(metrics.links.missing).toEqual(["tel:+48 500 600 700"]);
		expect(metrics.links.unexpected).toEqual([]);
		expect(docx.paragraphs.length).toBeGreaterThan(0);

		for (const heading of ["Doświadczenie", "Wykształcenie", "Projekty", "Umiejętności", "Języki"]) {
			expect(paragraphTexts).toContain(heading);
		}

		for (const heading of ["Experience", "Education", "Projects", "Skills", "Languages"]) {
			expect(paragraphTexts).not.toContain(heading);
		}

		for (const hiddenToken of corpus.hiddenTokens) {
			expect(containsTokenSequence([...paragraphTexts, ...docx.links], hiddenToken)).toBe(false);
		}
	});
});
