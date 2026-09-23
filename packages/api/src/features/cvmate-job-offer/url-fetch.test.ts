import { describe, expect, it, vi } from "vitest";
import { __testables, fetchJobOfferTextFromUrl } from "./url-fetch";

type UrlFetchDependenciesForTest = NonNullable<Parameters<typeof fetchJobOfferTextFromUrl>[1]>;

const publicAddress = [{ address: "93.184.216.34", family: 4 as const }];

function htmlResponse(
	html: string,
	overrides?: {
		statusCode?: number;
		headers?: Record<string, string>;
	},
) {
	const body = new TextEncoder().encode(html);

	return {
		statusCode: overrides?.statusCode ?? 200,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"content-length": String(body.byteLength),
			...overrides?.headers,
		},
		body,
	};
}

function dependencies(
	requestPinned: UrlFetchDependenciesForTest["requestPinned"],
	resolveHostname: UrlFetchDependenciesForTest["resolveHostname"] = vi.fn(async () => publicAddress),
): UrlFetchDependenciesForTest {
	return {
		resolveHostname,
		requestPinned,
	};
}

describe("fetchJobOfferTextFromUrl", () => {
	it("removes NUL characters from normalized text", () => {
		expect(__testables.normalizeText("A\u0000B")).toBe("AB");
	});

	it("extracts readable text from a public HTML page", async () => {
		const requestPinned = vi.fn(async () =>
			htmlResponse(`
				<html>
					<head><style>.x { color: red; }</style></head>
					<body>
						<h1>Office Manager</h1>
						<p>Required: Excel and client communication.</p>
						<script>window.evil = true;</script>
					</body>
				</html>
			`),
		);

		const result = await fetchJobOfferTextFromUrl("https://jobs.example.com/offer", dependencies(requestPinned));

		expect(result).toContain("Office Manager");
		expect(result).toContain("Required: Excel and client communication.");
		expect(result).not.toContain("window.evil");
		expect(requestPinned).toHaveBeenCalledTimes(1);
	});

	it("rejects credentials in a URL before network access", async () => {
		const requestPinned = vi.fn();

		await expect(
			fetchJobOfferTextFromUrl("https://user:secret@jobs.example.com/offer", dependencies(requestPinned)),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(requestPinned).not.toHaveBeenCalled();
	});

	it("rejects literal localhost/private targets before DNS access", async () => {
		const requestPinned = vi.fn();
		const resolveHostname = vi.fn();

		await expect(
			fetchJobOfferTextFromUrl("http://127.0.0.1:3000/private", dependencies(requestPinned, resolveHostname)),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(resolveHostname).not.toHaveBeenCalled();
		expect(requestPinned).not.toHaveBeenCalled();
	});

	it("rejects a hostname that resolves to a private address", async () => {
		const requestPinned = vi.fn();
		const resolveHostname = vi.fn(async () => [{ address: "10.0.0.5", family: 4 as const }]);

		await expect(
			fetchJobOfferTextFromUrl("https://jobs.example.com/offer", dependencies(requestPinned, resolveHostname)),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(requestPinned).not.toHaveBeenCalled();
	});

	it("revalidates redirect targets and blocks a redirect to localhost", async () => {
		const requestPinned = vi.fn(async () => ({
			statusCode: 302,
			headers: {
				location: "http://127.0.0.1/admin",
			},
			body: new Uint8Array(),
		}));

		await expect(
			fetchJobOfferTextFromUrl("https://jobs.example.com/offer", dependencies(requestPinned)),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(requestPinned).toHaveBeenCalledTimes(1);
	});

	it("rejects redirect loops after the strict limit", async () => {
		const requestPinned = vi.fn(async (url: URL) => ({
			statusCode: 302,
			headers: {
				location: `https://jobs.example.com/offer?next=${Number(url.searchParams.get("next") ?? "0") + 1}`,
			},
			body: new Uint8Array(),
		}));

		await expect(
			fetchJobOfferTextFromUrl("https://jobs.example.com/offer?next=0", dependencies(requestPinned)),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(requestPinned).toHaveBeenCalledTimes(__testables.MAX_REDIRECTS + 1);
	});

	it("rejects unsupported content types", async () => {
		const requestPinned = vi.fn(async () => ({
			statusCode: 200,
			headers: {
				"content-type": "application/pdf",
			},
			body: new Uint8Array([1, 2, 3]),
		}));

		await expect(
			fetchJobOfferTextFromUrl("https://jobs.example.com/offer", dependencies(requestPinned)),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects an oversized response declared by Content-Length", async () => {
		const requestPinned = vi.fn(async () => ({
			statusCode: 200,
			headers: {
				"content-type": "text/plain",
				"content-length": String(__testables.MAX_RESPONSE_BYTES + 1),
			},
			body: new TextEncoder().encode("a".repeat(100)),
		}));

		await expect(
			fetchJobOfferTextFromUrl("https://jobs.example.com/offer", dependencies(requestPinned)),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects request timeouts", async () => {
		const requestPinned = vi.fn(() => Promise.reject(new Error("timeout")));

		await expect(
			fetchJobOfferTextFromUrl("https://jobs.example.com/offer", dependencies(requestPinned)),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
