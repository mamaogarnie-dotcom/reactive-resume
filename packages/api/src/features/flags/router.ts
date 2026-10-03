import z from "zod";
import { env } from "@reactive-resume/env/server";
import { publicProcedure } from "../../context";
import { isPlatformAiProviderAvailable } from "../cvmate-ai-provider/service";

export type FeatureFlags = {
	disableSignups: boolean;
	disableEmailAuth: boolean;
	requireEmailVerification: boolean;
	smtpEnabled: boolean;
	platformAiEnabled: boolean;
};

// Mirrors isSmtpEnabled() in packages/email/src/transport.ts (kept local to avoid an api -> email dependency).
const isSmtpEnabled = () => Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);

export const flagsRouter = {
	get: publicProcedure
		.route({
			method: "GET",
			path: "/flags",
			tags: ["Feature Flags"],
			operationId: "getFeatureFlags",
			summary: "Get feature flags",
			description:
				"Returns the current feature flags for this Reactive Resume instance. Feature flags control instance-wide settings such as whether new user signups or email-based authentication are disabled. No authentication required.",
			successDescription: "The current feature flags for this instance.",
		})
		.output(
			z.object({
				disableSignups: z.boolean().describe("Whether new user signups are disabled on this instance."),
				disableEmailAuth: z.boolean().describe("Whether email-based authentication is disabled on this instance."),
				requireEmailVerification: z
					.boolean()
					.describe("Whether new email/password accounts must verify their email address."),
				smtpEnabled: z.boolean().describe("Whether outbound email (SMTP) is configured on this instance."),
				platformAiEnabled: z
					.boolean()
					.describe("Whether the built-in AI provider is available to users without a provider of their own."),
			}),
		)
		.handler(
			(): FeatureFlags => ({
				disableSignups: env.FLAG_DISABLE_SIGNUPS,
				disableEmailAuth: env.FLAG_DISABLE_EMAIL_AUTH,
				requireEmailVerification: env.FLAG_REQUIRE_EMAIL_VERIFICATION,
				smtpEnabled: isSmtpEnabled(),
				platformAiEnabled: isPlatformAiProviderAvailable(),
			}),
		),
};
