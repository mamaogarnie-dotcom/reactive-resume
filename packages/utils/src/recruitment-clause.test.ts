import { describe, expect, it } from "vitest";
import {
getDefaultRecruitmentClause,
resolveRecruitmentClauseContent,
resolveRecruitmentClauseLanguage,
} from "./recruitment-clause";

describe("recruitment clauses", () => {
it("contains the approved Polish and English defaults for both logical scopes", () => {
expect(getDefaultRecruitmentClause("current", "pl")).toContain("(RODO)");
expect(getDefaultRecruitmentClause("current", "en")).toContain("(GDPR)");
expect(getDefaultRecruitmentClause("current_and_future", "pl")).toContain(
"obecnego oraz przyszłych procesów rekrutacyjnych",
);
expect(getDefaultRecruitmentClause("current_and_future", "en")).toContain(
"current and future recruitment processes",
);
});

it("uses the 1story default only when there is no custom override", () => {
expect(resolveRecruitmentClauseContent("current", "pl", null)).toBe(
getDefaultRecruitmentClause("current", "pl"),
);
expect(resolveRecruitmentClauseContent("current", "en", "  Custom consent  ")).toBe(
"Custom consent",
);
});

it("maps Polish document targets to Polish and everything else to English", () => {
expect(resolveRecruitmentClauseLanguage("pl")).toBe("pl");
expect(resolveRecruitmentClauseLanguage("pl-PL")).toBe("pl");
expect(resolveRecruitmentClauseLanguage("en")).toBe("en");
expect(resolveRecruitmentClauseLanguage("en-US")).toBe("en");
expect(resolveRecruitmentClauseLanguage(null)).toBe("en");
});
});