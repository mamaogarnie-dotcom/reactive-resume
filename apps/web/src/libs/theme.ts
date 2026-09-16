import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import Cookies from "js-cookie";
import z from "zod";

const themeSchema = z.union([z.literal("light"), z.literal("dark")]);

export type Theme = z.infer<typeof themeSchema>;

const storageKey = "theme";
const defaultTheme: Theme = "light";

export const themeMap = {
light: msg`Light`,
dark: msg`Dark`,
} satisfies Record<Theme, MessageDescriptor>;

export function isTheme(theme: string): theme is Theme {
return themeSchema.safeParse(theme).success;
}

export const getTheme = () => {
const theme = Cookies.get(storageKey);

// 1story V1 exposes only the approved light theme.
// Dark-theme infrastructure remains available for a future branded dark theme.
if (!theme || !isTheme(theme) || theme === "dark") return defaultTheme;

return theme;
};

export const setThemeCookie = (theme: Theme) => {
Cookies.set(storageKey, theme);
};