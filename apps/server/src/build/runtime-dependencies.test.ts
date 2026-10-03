import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findUndeclaredExternals, packageNameFromSpecifier } from "./runtime-dependencies";

type PackageJson = { dependencies?: Record<string, string> };

const readPackageJson = (path: string) =>
	JSON.parse(readFileSync(new URL(path, import.meta.url), "utf-8")) as PackageJson;

describe("packageNameFromSpecifier", () => {
	it("returns the package name of bare and scoped subpath specifiers", () => {
		expect(packageNameFromSpecifier("pdfjs-dist/legacy/build/pdf.mjs")).toBe("pdfjs-dist");
		expect(packageNameFromSpecifier("hono")).toBe("hono");
		expect(packageNameFromSpecifier("@hono/node-server/conninfo")).toBe("@hono/node-server");
		expect(packageNameFromSpecifier("@react-pdf/renderer")).toBe("@react-pdf/renderer");
	});
});

describe("findUndeclaredExternals", () => {
	it("reports a package imported by the bundle but missing from the server dependencies", () => {
		// The production regression: `@reactive-resume/pdf/server` imports pdfjs-dist, which only
		// `packages/pdf` and the root devDependencies declared.
		expect(findUndeclaredExternals(["pdfjs-dist/legacy/build/pdf.mjs", "hono"], ["hono"])).toEqual(["pdfjs-dist"]);
	});

	it("matches scoped packages by scope and name", () => {
		expect(findUndeclaredExternals(["@hono/node-server/conninfo"], ["@hono/node-server"])).toEqual([]);
		expect(findUndeclaredExternals(["@react-pdf/layout"], ["@react-pdf/renderer"])).toEqual(["@react-pdf/layout"]);
	});

	it("ignores builtins, subpath imports and file paths", () => {
		const specifiers = [
			"node:fs",
			"fs",
			"fs/promises",
			"#react-pdf-renderer",
			"./chunk-abc.mjs",
			"../shared.mjs",
			"/app/apps/server/dist/index.mjs",
			"E:\\AGA\\reactive-resume\\packages\\env\\src\\server.ts",
			"E:/AGA/reactive-resume/packages/env/src/server.ts",
			"\0rolldown/runtime.js",
		];

		expect(findUndeclaredExternals(specifiers, [])).toEqual([]);
	});

	it("reports each missing package once, sorted", () => {
		expect(findUndeclaredExternals(["zod", "b-pkg/x", "a-pkg", "b-pkg/y"], ["zod"])).toEqual(["a-pkg", "b-pkg"]);
	});
});

describe("server runtime dependencies", () => {
	it("declares every third-party dependency of @reactive-resume/pdf, which the server renders with", () => {
		// The server reaches `@reactive-resume/pdf/server` (resume export, public PDF, CV build preview).
		// Its imports stay external in the bundle and must resolve from the production install.
		const server = readPackageJson("../../package.json");
		const pdf = readPackageJson("../../../../packages/pdf/package.json");
		const pdfThirdParty = Object.entries(pdf.dependencies ?? {})
			.filter(([, version]) => !version.startsWith("workspace:"))
			.map(([name]) => name);

		expect(findUndeclaredExternals(pdfThirdParty, Object.keys(server.dependencies ?? {}))).toEqual([]);
	});
});
