// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");

function count(pattern: string) {
	return source.split(pattern).length - 1;
}

describe("My CVs BRAND-7.2 contract", () => {
	it("uses neutral 1story CV iconography instead of the legacy Read.cv logo", () => {
		expect(count("ReadCvLogoIcon")).toBe(0);
		expect(count("FileTextIcon")).toBe(2);
		expect(count("icon={FileTextIcon}")).toBe(1);
	});

	it("uses branded card geometry and minimum 14px normal UI copy", () => {
		expect(count("rounded-xl border border-dashed bg-card p-8")).toBe(2);
		expect(count("rounded-xl border bg-card p-4")).toBe(2);
		expect(count("text-xs")).toBe(0);
	});

	it("keeps shared My CVs controls", () => {
		expect(count("<Tabs value={tab}>")).toBe(1);
		expect(count('<InputGroup className="w-full sm:ms-auto sm:w-64">')).toBe(1);
		expect(count("<Button")).toBe(7);
	});

	it("preserves the V1 My CVs status model", () => {
		expect(count('z.enum(["all", "ready", "draft", "favorites", "trash"])')).toBe(1);
		expect(count('document.status === "ready"')).toBe(5);
		expect(count('document.status === "draft"')).toBe(2);
		expect(count("document.isFavorite")).toBe(5);
		expect(count("document.trashedAt")).toBe(7);
	});

	it("preserves materialized CV behavior and adds resumable build drafts", () => {
		expect(count("orpc.resume.tags.list")).toBe(1);
		expect(count("orpc.resume.list")).toBe(1);
		expect(count("orpc.cvmateBuild.listDocuments")).toBe(2);
		expect(count("orpc.cvmateBuild.list.queryOptions()")).toBe(1);
		expect(count("orpc.cvmateBuild.updateDocument")).toBe(1);
		expect(count('to="/dashboard/cvmate/create"')).toBe(2);
		expect(count('search={{ buildId: build.id }}')).toBe(1);
		expect(count('to="/builder/$resumeId"')).toBe(2);
		expect(count("ResumeVersionHistory")).toBe(2);
	});
});