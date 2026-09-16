// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./create.tsx", import.meta.url), "utf8");

function count(pattern: string) {
return source.split(pattern).length - 1;
}

describe("Create CV BRAND-7.1 contract", () => {
it("uses shared 1story form primitives instead of local textarea replicas", () => {
expect(count('import { Input } from "@reactive-resume/ui/components/input";')).toBe(1);
expect(count('import { Textarea } from "@reactive-resume/ui/components/textarea";')).toBe(1);

expect(count("<Textarea")).toBe(2);
expect(count("<textarea")).toBe(0);

expect(count('className="min-h-56 resize-y"')).toBe(1);
expect(count('className="min-h-28 resize-y"')).toBe(1);

expect(count("textareaClassName")).toBe(0);
expect(count("generatedTextareaClassName")).toBe(0);
expect(count("fileClassName")).toBe(0);
});

it("keeps the job-offer upload on the shared Input primitive", () => {
expect(count('id="cvmate-job-offer-file"')).toBe(1);
expect(count('<Input\n')).toBeGreaterThanOrEqual(1);
});

it("uses branded workflow surfaces and no 12px normal UI text", () => {
expect(count("rounded-xl border bg-card p-5")).toBe(8);
expect(count("rounded-lg border bg-card p-3")).toBe(1);
expect(count("text-xs")).toBe(0);
});

it("preserves the native content-selection checkbox intentionally", () => {
expect(count('type="checkbox"')).toBe(1);
});

it("preserves the audited Create CV behavior signatures", () => {
expect(count("cvmateJobOffer.create.call")).toBe(1);
expect(count("cvmateJobOffer.uploadAsset.call")).toBe(1);
expect(count("cvmateJobOffer.analyze.call")).toBe(1);
expect(count("cvmateBuild.create.call")).toBe(1);
expect(count("cvmateBuild.updateSelectionItem.call")).toBe(4);
expect(count("cvmateBuild.updateGeneratedContentFinalText.call")).toBe(1);
expect(count("window.location.assign")).toBe(1);

expect(count("const analyzeOffer = useMutation")).toBe(1);
expect(count("const recommendContent = useMutation")).toBe(1);
expect(count("const updateSelection = useMutation")).toBe(1);
expect(count("const selectRecommended = useMutation")).toBe(1);
expect(count("const dismissGap = useMutation")).toBe(1);
expect(count("const generateTailoredContent = useMutation")).toBe(1);
expect(count("const saveGeneratedContent = useMutation")).toBe(1);
expect(count("const materializeCv = useMutation")).toBe(1);
});
});
