import { describe, expect, it } from "vitest";
import { normalizeFlexibleDate, withoutDay } from "./flexible-date";

describe("normalizeFlexibleDate", () => {
it("keeps year-only precision", () => {
expect(normalizeFlexibleDate("2024")).toBe("2024");
});

it.each([
["2024-03", "2024-03"],
["2024.3", "2024-03"],
["2024/03", "2024-03"],
["03.2024", "2024-03"],
["3/2024", "2024-03"],
])("normalizes month precision: %s", (input, expected) => {
expect(normalizeFlexibleDate(input)).toBe(expected);
});

it.each([
["2024-03-12", "2024-03-12"],
["2024.3.12", "2024-03-12"],
["2024/03/12", "2024-03-12"],
["12.03.2024", "2024-03-12"],
["12/3/2024", "2024-03-12"],
["12-03-2024", "2024-03-12"],
])("normalizes full date: %s", (input, expected) => {
expect(normalizeFlexibleDate(input)).toBe(expected);
});

it("rejects impossible dates and months", () => {
expect(normalizeFlexibleDate("31.02.2024")).toBeNull();
expect(normalizeFlexibleDate("2024/13")).toBeNull();
});

it("supports an empty value", () => {
expect(normalizeFlexibleDate("")).toBe("");
});
});

describe("withoutDay", () => {
it("removes the day from full date", () => {
expect(withoutDay("12.03.2024")).toBe("2024-03");
expect(withoutDay("2024-03-12")).toBe("2024-03");
});

it("keeps month and year precision", () => {
expect(withoutDay("03.2024")).toBe("2024-03");
expect(withoutDay("2024")).toBe("2024");
});
});