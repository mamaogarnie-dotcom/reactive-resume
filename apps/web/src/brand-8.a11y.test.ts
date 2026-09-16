// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (source: string, pattern: string) => source.split(pattern).length - 1;

const apiKeys = read("./features/settings/pages/api-keys.tsx");
const preferences = read("./features/settings/pages/preferences.tsx");
const createCv = read("./routes/dashboard/cvmate/create.tsx");
const myCvs = read("./routes/dashboard/resumes/index.tsx");
const login = read("./features/auth/pages/login.tsx");
const consent = read("./features/auth/pages/consent.tsx");
const root = read("./routes/__root.tsx");
const globals = read("../../../packages/ui/src/styles/globals.css");

describe("BRAND-8 accessibility contract", () => {
it("provides an accessible name for API key deletion", () => {
expect(count(apiKeys, 'aria-label="Delete API key"')).toBe(1);
});

it("programmatically labels the Create CV selection checkbox", () => {
expect(count(createCv, 'aria-labelledby={`cvmate-selection-label-${item.id}`}')).toBe(1);
expect(count(createCv, 'id={`cvmate-selection-label-${item.id}`}')).toBe(1);
expect(
count(
createCv,
"accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
),
).toBe(1);
});

it("associates the Preferences language label with its Combobox trigger", () => {
expect(count(preferences, 'htmlFor="settings-language"')).toBe(1);
expect(count(preferences, 'id="settings-language"')).toBe(1);
});

it("associates My CVs sort and filter labels with their Combobox triggers", () => {
expect(count(myCvs, 'htmlFor="my-cvs-sort"')).toBe(1);
expect(count(myCvs, 'id="my-cvs-sort"')).toBe(1);
expect(count(myCvs, 'htmlFor="my-cvs-filter"')).toBe(1);
expect(count(myCvs, 'id="my-cvs-filter"')).toBe(1);
});

it("keeps active authentication normal copy at 14px or above", () => {
expect(count(login, "text-xs")).toBe(0);
expect(count(consent, "text-xs")).toBe(0);
});

it("preserves the existing global reduced-motion contract", () => {
expect(count(root, 'reducedMotion="user"')).toBe(1);
expect(count(globals, "@media (prefers-reduced-motion: reduce)")).toBe(1);
});
});
