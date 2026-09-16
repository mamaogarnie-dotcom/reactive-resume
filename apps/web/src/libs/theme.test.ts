import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.hoisted(() => vi.fn());

vi.mock("js-cookie", () => ({
default: {
get: cookieGet,
set: vi.fn(),
},
}));

const { getTheme, isTheme, themeMap } = await import("./theme");

beforeEach(() => {
cookieGet.mockReset();
});

describe("isTheme", () => {
it("returns true for 'light'", () => {
expect(isTheme("light")).toBe(true);
});

it("returns true for 'dark' because dark infrastructure is retained", () => {
expect(isTheme("dark")).toBe(true);
});

it("returns false for unknown theme", () => {
expect(isTheme("auto")).toBe(false);
expect(isTheme("system")).toBe(false);
});

it("returns false for empty string", () => {
expect(isTheme("")).toBe(false);
});

it("is case-sensitive", () => {
expect(isTheme("Light")).toBe(false);
expect(isTheme("DARK")).toBe(false);
});
});

describe("themeMap", () => {
it("retains descriptors for light and dark infrastructure", () => {
expect(themeMap.light).toBeDefined();
expect(themeMap.dark).toBeDefined();
});
});

describe("getTheme", () => {
it("defaults to light when no cookie exists", () => {
cookieGet.mockReturnValue(undefined);
expect(getTheme()).toBe("light");
});

it("returns light when the existing cookie is light", () => {
cookieGet.mockReturnValue("light");
expect(getTheme()).toBe("light");
});

it("normalizes a legacy dark cookie to light in 1story V1", () => {
cookieGet.mockReturnValue("dark");
expect(getTheme()).toBe("light");
});

it("defaults to light for an invalid cookie", () => {
cookieGet.mockReturnValue("system");
expect(getTheme()).toBe("light");
});
});