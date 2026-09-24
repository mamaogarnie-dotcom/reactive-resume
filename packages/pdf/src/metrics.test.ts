import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfJsMock = vi.hoisted(() => ({
	getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
	getDocument: pdfJsMock.getDocument,
}));

const { measureResumePdfBytes } = await import("./metrics");

type MockTextItem = {
	str: string;
	transform: number[];
};

function mockPdfDocument(options: { numPages: number; pageHeight: number; items: MockTextItem[] }) {
	const destroy = vi.fn(() => Promise.resolve());
	const getPage = vi.fn((pageNumber: number) => {
		expect(pageNumber).toBe(options.numPages);

		return Promise.resolve({
			getViewport: () => ({
				height: options.pageHeight,
			}),
			getTextContent: () =>
				Promise.resolve({
					items: options.items,
				}),
		});
	});

	pdfJsMock.getDocument.mockReturnValue({
		promise: Promise.resolve({
			numPages: options.numPages,
			getPage,
		}),
		destroy,
	});

	return {
		destroy,
		getPage,
	};
}

describe("rendered resume PDF metrics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("measures actual page count and last-page text utilization", async () => {
		const { destroy, getPage } = mockPdfDocument({
			numPages: 2,
			pageHeight: 1000,
			items: [
				{ str: "Top content", transform: [1, 0, 0, 1, 40, 800] },
				{ str: "Lowest content", transform: [1, 0, 0, 1, 40, 250] },
				{ str: "   ", transform: [1, 0, 0, 1, 40, 50] },
			],
		});

		const result = await measureResumePdfBytes(new Uint8Array([37, 80, 68, 70]));

		expect(result).toEqual({
			actualPageCount: 2,
			lastPageTextUtilization: 0.75,
		});
		expect(getPage).toHaveBeenCalledTimes(1);
		expect(destroy).toHaveBeenCalledTimes(1);
	});

	it("returns zero utilization when the last physical page has no text", async () => {
		mockPdfDocument({
			numPages: 1,
			pageHeight: 842,
			items: [],
		});

		await expect(measureResumePdfBytes(new Uint8Array([37, 80, 68, 70]))).resolves.toEqual({
			actualPageCount: 1,
			lastPageTextUtilization: 0,
		});
	});
});
