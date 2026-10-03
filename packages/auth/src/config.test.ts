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

// Pins the auth options as of 27834a0 so the log sanitizer cannot silently change sign-in behavior.
describe("auth options outside the logger", () => {
	it("has exactly the top-level options it had before the safe logger", () => {
		const keys = Object.keys(auth.options).filter((key) => key !== "logger");

		expect(keys.sort()).toEqual(
			[
				"account",
				"advanced",
				"appName",
				"baseURL",
				"database",
				"emailAndPassword",
				"emailVerification",
				"hooks",
				"onAPIError",
				"plugins",
				"rateLimit",
				"secret",
				"session",
				"socialProviders",
				"telemetry",
				"trustedOrigins",
				"user",
			].sort(),
		);
	});

	it("adds only a log sink to the logger, keeping Better Auth's default level and enablement", () => {
		expect(Object.keys(auth.options.logger ?? {})).toEqual(["log"]);
		expect(typeof auth.options.logger?.log).toBe("function");
	});

	it("keeps account linking unchanged", () => {
		expect(auth.options.account).toEqual({
			accountLinking: {
				enabled: true,
				requireLocalEmailVerified: false,
				trustedProviders: ["google", "github", "linkedin"],
			},
		});
	});

	it("keeps the social providers and their option keys unchanged", () => {
		const providers = auth.options.socialProviders ?? {};
		expect(Object.keys(providers).sort()).toEqual(["github", "google", "linkedin"]);

		const credentials = {
			google: [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET],
			github: [env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET],
			linkedin: [env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET],
		} as const;

		for (const provider of ["google", "github", "linkedin"] as const) {
			const config = providers[provider];
			if (typeof config !== "object" || config === null) throw new TypeError(`${provider} config should be an object`);

			const [clientId, clientSecret] = credentials[provider];
			expect(Object.keys(config).sort()).toEqual(
				["clientId", "clientSecret", "disableSignUp", "enabled", "mapProfileToUser"].sort(),
			);
			expect(config.enabled).toBe(!!clientId && !!clientSecret);
			expect(config.clientId).toBe(clientId ?? "");
			expect(config.clientSecret).toBe(clientSecret ?? "");
			expect(typeof config.mapProfileToUser).toBe("function");
		}
	});

	it("keeps the plugin list unchanged", () => {
		const expected = [
			"jwt",
			"admin",
			"passkey",
			"generic-oauth",
			"two-factor",
			"api-key",
			"oauth-provider",
			"username",
		];
		if (env.BETTER_AUTH_API_KEY) expected.push("dash");

		expect(auth.options.plugins?.map((plugin) => plugin.id)).toEqual(expected);
	});
});
