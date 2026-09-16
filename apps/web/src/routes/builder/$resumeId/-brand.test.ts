// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (source: string, pattern: string) => source.split(pattern).length - 1;

const downloadDialog = read("../../../features/resume/export/download-dialog.tsx");
const dock = read("./-components/dock.tsx");
const header = read("./-components/header.tsx");
const mobileShell = read("./-components/mobile-builder-shell.tsx");
const leftIndex = read("./-sidebar/left/index.tsx");
const custom = read("./-sidebar/left/sections/custom.tsx");
const customFields = read("./-sidebar/left/sections/custom-fields.tsx");
const picture = read("./-sidebar/left/sections/picture.tsx");
const sectionItem = read("./-sidebar/left/shared/section-item.tsx");
const ats = read("./-sidebar/right/sections/ats-check.tsx");
const exportSection = read("./-sidebar/right/sections/export.tsx");
const information = read("./-sidebar/right/sections/information.tsx");
const layoutPages = read("./-sidebar/right/sections/layout/pages.tsx");
const sharing = read("./-sidebar/right/sections/sharing.tsx");
const statistics = read("./-sidebar/right/sections/statistics.tsx");

const chromeSources = [
downloadDialog,
dock,
header,
mobileShell,
leftIndex,
custom,
customFields,
picture,
sectionItem,
ats,
exportSection,
information,
layoutPages,
sharing,
statistics,
];

describe("BRAND-7.4 builder chrome contract", () => {
it("does not use 12px normal application-chrome text", () => {
expect(chromeSources.reduce((total, source) => total + count(source, "text-xs"), 0)).toBe(0);
});

it("removes visible Reactive Resume support and donation branding", () => {
expect(count(information, "Reactive Resume")).toBe(0);
expect(count(information, "Donate to Reactive Resume")).toBe(0);
expect(count(information, "opencollective.com/reactive-resume")).toBe(0);
expect(count(information, "github.com/amruthpillai/reactive-resume")).toBe(0);
expect(count(information, "<Trans>About 1story</Trans>")).toBe(1);
});

it("uses 1story geometry for major export and builder panels", () => {
expect(count(downloadDialog, "rounded-xl border bg-card p-3")).toBe(2);
expect(count(leftIndex, "rounded-xl border border-amber-500/30 bg-amber-500/10 p-3")).toBe(1);
expect(count(custom, 'className="rounded-xl border bg-card"')).toBe(1);
expect(count(ats, "rounded-xl border bg-card p-3")).toBe(3);
expect(count(ats, "rounded-xl border border-dashed bg-card p-3")).toBe(1);
expect(count(layoutPages, "rounded-xl border border-dashed bg-card")).toBeGreaterThanOrEqual(2);
expect(count(sharing, "rounded-xl border bg-card p-4")).toBe(1);
});

it("keeps compact controls and previews compact", () => {
expect(count(picture, "rounded-md")).toBeGreaterThan(0);
expect(count(layoutPages, "rounded-md border border-border bg-background")).toBe(1);
});
});
