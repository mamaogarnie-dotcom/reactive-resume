import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type ResumePdfMetrics = {
	actualPageCount: number;
	lastPageTextUtilization: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const roundMetric = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * Measures the physical rendered PDF, not the authored layout definition.
 *
 * lastPageTextUtilization is the ratio from the top edge of the last
 * physical page to the lowest non-empty text baseline. It is intentionally
 * a deterministic text-layer proxy for how far resume content reaches down
 * the final page.
 */
export const measureResumePdfBytes = async (bytes: Uint8Array): Promise<ResumePdfMetrics> => {
	const loadingTask = getDocument({ data: bytes });

	try {
		const document = await loadingTask.promise;
		const actualPageCount = document.numPages;

		if (actualPageCount < 1) {
			throw new Error("Rendered resume PDF must contain at least one physical page.");
		}

		const lastPage = await document.getPage(actualPageCount);
		const pageHeight = lastPage.getViewport({ scale: 1 }).height;
		const content = await lastPage.getTextContent();

		let lowestTextBaselineFromTop = 0;

		for (const item of content.items) {
			if (!("str" in item) || item.str.trim().length === 0) continue;

			const baselineY = Number(item.transform[5]);

			if (!Number.isFinite(baselineY)) continue;

			lowestTextBaselineFromTop = Math.max(lowestTextBaselineFromTop, pageHeight - baselineY);
		}

		const lastPageTextUtilization = pageHeight > 0 ? roundMetric(clamp01(lowestTextBaselineFromTop / pageHeight)) : 0;

		return {
			actualPageCount,
			lastPageTextUtilization,
		};
	} finally {
		await loadingTask.destroy();
	}
};
