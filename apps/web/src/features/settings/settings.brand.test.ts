// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const preferences = readFileSync(new URL("./pages/preferences.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("./pages/profile.tsx", import.meta.url), "utf8");
const apiKeys = readFileSync(new URL("./pages/api-keys.tsx", import.meta.url), "utf8");
const passkeys = readFileSync(
new URL("./authentication/components/passkeys.tsx", import.meta.url),
"utf8",
);
const integrations = readFileSync(
new URL("./integrations/components/ai-section.tsx", import.meta.url),
"utf8",
);

function count(source: string, pattern: string) {
return source.split(pattern).length - 1;
}

describe("Settings BRAND-7.3 contract", () => {
it("keeps V1 Preferences language-only", () => {
expect(count(preferences, '<LocaleCombobox id="settings-language" />')).toBe(1);
expect(count(preferences, "<Trans>Language</Trans>")).toBe(1);
expect(count(preferences, "ThemeCombobox")).toBe(0);
expect(count(preferences, "<Trans>Theme</Trans>")).toBe(0);
expect(count(preferences, "setTheme")).toBe(0);
});

it("uses minimum 14px normal copy in Profile and API Keys", () => {
expect(count(profile, "text-xs")).toBe(0);
expect(count(apiKeys, "text-xs")).toBe(0);
});

it("uses 1story card geometry for passkeys", () => {
expect(count(passkeys, "rounded-xl border bg-muted/40 px-3 py-2")).toBe(1);
expect(count(passkeys, "rounded-md border bg-muted/40 px-3 py-2")).toBe(0);
});

it("uses 1story geometry on the major AI integration surfaces", () => {
expect(count(integrations, "rounded-xl border bg-card p-4")).toBe(2);
expect(count(integrations, "rounded-xl border p-3 text-sm")).toBe(1);
expect(count(integrations, "rounded-xl border p-4 text-sm")).toBe(1);
expect(
count(
integrations,
"rounded-xl border border-dashed bg-card p-6 text-center text-muted-foreground text-sm",
),
).toBe(1);
});

it("preserves compact inner integration geometry and dark-mode infrastructure", () => {
expect(count(integrations, "rounded-md bg-primary/10 text-primary")).toBe(1);
expect(count(integrations, "rounded-md border bg-background/50 px-3 py-2")).toBe(1);
expect(count(integrations, "dark:")).toBe(8);
});

it("preserves critical settings behavior signatures", () => {
expect(count(profile, "authClient.updateUser")).toBe(1);
expect(count(profile, "authClient.changeEmail")).toBe(1);
expect(count(profile, "authClient.sendVerificationEmail")).toBe(1);

expect(count(apiKeys, "authClient.apiKey.list")).toBe(1);
expect(count(apiKeys, "authClient.apiKey.delete")).toBe(1);

expect(count(passkeys, "authClient.passkey.listUserPasskeys")).toBe(1);
expect(count(passkeys, "authClient.passkey.addPasskey")).toBe(1);
expect(count(passkeys, "authClient.passkey.updatePasskey")).toBe(1);
expect(count(passkeys, "authClient.passkey.deletePasskey")).toBe(1);
});
});
