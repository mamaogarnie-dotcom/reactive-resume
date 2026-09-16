// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (source: string, pattern: string) => source.split(pattern).length - 1;

const sidebar = read("./routes/dashboard/-components/sidebar.tsx");
const navigation = read("./features/command-palette/pages/navigation.tsx");
const resumes = read("./features/command-palette/pages/resumes.tsx");
const publicResume = read("./features/resume/public/public-resume.tsx");
const section = read("./libs/resume/section.tsx");

describe("BRAND-9 active legacy icon cleanup", () => {
it("removes ReadCvLogoIcon from active V1 surfaces", () => {
expect(count(sidebar, "ReadCvLogoIcon")).toBe(0);
expect(count(navigation, "ReadCvLogoIcon")).toBe(0);
expect(count(resumes, "ReadCvLogoIcon")).toBe(0);
expect(count(publicResume, "ReadCvLogoIcon")).toBe(0);
expect(count(section, "ReadCvLogoIcon")).toBe(0);
});

it("uses semantic neutral icons", () => {
expect(count(sidebar, "PlusIcon")).toBe(2);
expect(count(sidebar, "FileTextIcon")).toBe(2);
expect(count(navigation, "FileTextIcon")).toBe(2);
expect(count(resumes, "FileTextIcon")).toBe(3);
expect(count(publicResume, "FileTextIcon")).toBe(2);
expect(count(section, '.with("page", () => <FileTextIcon {...iconProps} />)')).toBe(1);
});

it("preserves navigation and CTA behavior", () => {
expect(count(sidebar, 'href: "/dashboard/cvmate/create"')).toBe(1);
expect(count(sidebar, 'href: "/dashboard/resumes"')).toBe(1);
expect(count(navigation, 'onNavigate("/dashboard/cvmate/create")')).toBe(1);
expect(count(navigation, 'onNavigate("/dashboard/resumes")')).toBe(1);
expect(count(resumes, 'pushPage("resumes")')).toBe(1);
expect(count(resumes, 'to: "/builder/$resumeId"')).toBe(1);
expect(count(publicResume, 'href={isRoot ? "/dashboard" : "/"}')).toBe(1);
expect(count(publicResume, "<Trans>Build your own resume</Trans>")).toBe(1);
});
});
