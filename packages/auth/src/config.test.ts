import { describe, expect, it, vi } from "vitest";
import { env } from "@reactive-resume/env/server";
import { auth } from "./config";

vi.mock("@better-auth/oauth-provider", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@better-auth/oauth-provider")>();

	return {
		...actual,
		oauthProvider: (...args: Parameters<typeof actual.oauthProvider>) => {
			const plugin = actual.oauthProvider(...args);
			return { ...plugin, init: undefined };
		},
	};
});

describe("social provider signup policy", () => {
	it.each(["google", "github", "linkedin"] as const)(
		"allows implicit signup through %s while honoring the global signup restriction",
		(provider) => {
			// Better Auth 1.7 allows a lazy `() => config` form; ours are always static objects.
			const config = auth.options.socialProviders?.[provider];
			if (typeof config === "function") throw new TypeError(`${provider} provider config should be a static object`);

			expect(config).not.toHaveProperty("disableImplicitSignUp");
			expect(config?.disableSignUp).toBe(env.FLAG_DISABLE_SIGNUPS);
		},
	);
});

describe("email verification policy", () => {
	it("uses the explicit environment flag for password signup verification and signup emails", () => {
		expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(env.FLAG_REQUIRE_EMAIL_VERIFICATION);
		expect(auth.options.emailVerification?.sendOnSignUp).toBe(env.FLAG_REQUIRE_EMAIL_VERIFICATION);
	});
});

describe("session freshness", () => {
	it("disables the freshness gate so provider unlinking works for week-old sessions", () => {
		expect(auth.options.session?.freshAge).toBe(0);
	});
});
