import { describe, expect, it } from "vitest";
import { createNoindexFollowMeta, createResumeSocialMeta, getCanonicalRootUrl } from "./seo";

describe("getCanonicalRootUrl", () => {
	it("normalizes an explicit app origin to the root URL", () => {
		expect(getCanonicalRootUrl("http://localhost:3000")).toBe("http://localhost:3000/");
		expect(getCanonicalRootUrl("https://app.example.com/path?query=1#hash")).toBe("https://app.example.com/");
	});
});

describe("createNoindexFollowMeta", () => {
	it("returns the robots noindex metadata used by private app surfaces", () => {
		expect(createNoindexFollowMeta()).toEqual({ name: "robots", content: "noindex, follow" });
	});
});

describe("createResumeSocialMeta", () => {
	it("builds social metadata from explicit URLs", () => {
		const meta = createResumeSocialMeta({
			canonicalUrl: "https://app.example.com/jane/resume",
			title: "Jane Doe — Staff Engineer",
			description: "Builds resilient distributed systems.",
			imageUrl: "https://app.example.com/opengraph/banner.jpg",
		});

		expect(meta).toContainEqual({
			property: "og:url",
			content: "https://app.example.com/jane/resume",
		});
		expect(meta).toContainEqual({
			name: "twitter:image",
			content: "https://app.example.com/opengraph/banner.jpg",
		});
	});
});
