// @vitest-environment happy-dom

import { i18n } from "@lingui/core";
import { beforeAll, describe, expect, it } from "vitest";
import { appLocaleMap, cvLocaleMap, localeMap } from "@/libs/locale";
import {
	getAppLocaleOptions,
	getCvLocaleOptions,
	getLocaleOptions,
} from "./locale-options";

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

describe("getLocaleOptions", () => {
	it("retains the full technical locale catalogue", () => {
		expect(getLocaleOptions()).toHaveLength(Object.keys(localeMap).length);
		expect(getLocaleOptions().map((option) => option.value)).toContain("de-DE");
	});
});

describe("getAppLocaleOptions", () => {
	it("exposes only Polish and English for the 1story interface", () => {
		const values = getAppLocaleOptions().map((option) => option.value);

		expect(values).toEqual(Object.keys(appLocaleMap));
		expect(values).toEqual(["pl-PL", "en-US"]);
		expect(values).not.toContain("de-DE");
	});
});

describe("getCvLocaleOptions", () => {
	it("exposes only Polish and English for final CV documents", () => {
		const values = getCvLocaleOptions().map((option) => option.value);

		expect(values).toEqual(Object.keys(cvLocaleMap));
		expect(values).toEqual(["pl-PL", "en-US"]);
		expect(values).not.toContain("de-DE");
		expect(values).not.toContain("ja-JP");
	});
});
