import { describe, expect, it } from "vitest";
import {
	cvLanguageToLocale,
	defaultLocale,
	isLocale,
	isRTL,
	resolveCvLanguage,
	resolveCvLocale,
} from "./locale";

describe("defaultLocale", () => {
	it("is en-US", () => {
		expect(defaultLocale).toBe("en-US");
	});
});

describe("CV language V1", () => {
	it("supports Polish and English only", () => {
		expect(resolveCvLanguage("pl")).toBe("pl");
		expect(resolveCvLanguage("pl-PL")).toBe("pl");
		expect(resolveCvLanguage("en")).toBe("en");
		expect(resolveCvLanguage("en-US")).toBe("en");
	});

	it("maps every non-Polish language to English in V1", () => {
		expect(resolveCvLanguage("de-DE")).toBe("en");
		expect(resolveCvLanguage("fr")).toBe("en");
		expect(resolveCvLanguage("ja-JP")).toBe("en");
		expect(resolveCvLanguage("unsupported")).toBe("en");
		expect(resolveCvLanguage(null)).toBe("en");
	});

	it("maps CV languages to the only supported document locales", () => {
		expect(cvLanguageToLocale("pl")).toBe("pl-PL");
		expect(cvLanguageToLocale("en")).toBe("en-US");
		expect(resolveCvLocale("de-DE")).toBe("en-US");
	});
});
describe("isLocale", () => {
	it("returns true for non-empty string", () => {
		expect(isLocale("en-US")).toBe(true);
	});

	it("returns false for unsupported locale string", () => {
		expect(isLocale("xyz")).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isLocale("")).toBe(false);
	});

	it("returns false for number", () => {
		expect(isLocale(42)).toBe(false);
	});

	it("returns false for null", () => {
		expect(isLocale(null)).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isLocale(undefined)).toBe(false);
	});

	it("returns false for object", () => {
		expect(isLocale({})).toBe(false);
	});

	it("returns false for array", () => {
		expect(isLocale([])).toBe(false);
	});
});

describe("isRTL", () => {
	it.each([
		["ar-SA", true],
		["he-IL", true],
		["fa-IR", true],
		["ur-PK", true],
		["en-US", false],
		["en-GB", false],
		["fr-FR", false],
		["de-DE", false],
		["zh-CN", false],
		["xyz-XX", false],
		["AR-SA", true],
		["ar", true],
		["en", false],
	])("returns %s → %s", (locale, expected) => {
		expect(isRTL(locale)).toBe(expected);
	});
});
