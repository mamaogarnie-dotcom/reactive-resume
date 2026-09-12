// @vitest-environment happy-dom

import type { SectionTitleResolver } from "@reactive-resume/pdf/section-title";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createResumePdfFile } from "@reactive-resume/pdf/server";
import { createCvmatePdfCorpus } from "./cvmate-fixture";
import { extractPdf } from "./extract";
import { evaluateExport, tokenize } from "./metrics";

const outputDirectory = resolve(process.cwd(), "ats-export-evaluation/test-results");

const pdfTitleResolver: SectionTitleResolver = ({ defaultEnglishTitle, sectionId }) => defaultEnglishTitle ?? sectionId;

function containsTokenSequence(observedValues: readonly string[], expectedValue: string): boolean {
	const observed = observedValues.flatMap(tokenize);
	const expected = tokenize(expectedValue);

	return observed.some((_, index) => expected.every((token, offset) => observed[index + offset] === token));
}

describe("CVMate PDF export contract", () => {
	it("exports adapter data to an ATS-readable PDF without selected-content loss", { timeout: 120_000 }, async () => {
		await mkdir(outputDirectory, { recursive: true });

		const corpus = createCvmatePdfCorpus();
		const before = JSON.stringify(corpus.data);
		const pdfFile = await createResumePdfFile({
			data: corpus.data,
			filename: `${corpus.name}.pdf`,
			template: corpus.data.metadata.template,
			resolveSectionTitle: pdfTitleResolver,
		});

		const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
		const pdf = await extractPdf(pdfBytes);
		const metrics = evaluateExport(corpus, {
			paragraphs: pdf.paragraphs,
			links: pdf.links,
		});

		await writeFile(join(outputDirectory, `${corpus.name}.pdf`), pdfBytes);

		expect(JSON.stringify(corpus.data)).toBe(before);
		expect(metrics.recall.denominator).toBeGreaterThan(20);
		expect(metrics.missingTokens).toEqual([]);
		expect(metrics.links.missing).toEqual([]);
		expect(metrics.links.unexpected).toEqual([]);
		expect(pdf.raw.pageCount).toBeGreaterThan(0);
		expect(pdf.raw.fonts.length).toBeGreaterThan(0);

		for (const hiddenToken of corpus.hiddenTokens) {
			expect(containsTokenSequence([...pdf.paragraphs, ...pdf.links], hiddenToken)).toBe(false);
		}
	});
});
