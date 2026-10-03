import type { SendMailOptions, Transporter } from "nodemailer";
import type { ReactElement } from "react";
import nodemailer from "nodemailer";
import { render } from "react-email";
import { env } from "@reactive-resume/env/server";

// Logged instead of the message when SMTP is missing, so it must never carry user data.
export type EmailKind = "verification" | "password-reset" | "email-change";

type SendEmailOptions = {
	kind: EmailKind;
	to: string | string[];
	subject: string;
	text?: string;
	html?: string;
	react?: ReactElement;
	from?: string;
};

let cachedTransport: Transporter | undefined;

const SAFE_ERROR_TOKEN = /^[\w.:-]{1,64}$/;

function safeErrorToken(error: unknown, key: "name" | "code"): string | undefined {
	if (error === null || typeof error !== "object") return undefined;
	try {
		const value = (error as Record<string, unknown>)[key];
		return typeof value === "string" && SAFE_ERROR_TOKEN.test(value) ? value : undefined;
	} catch {
		return undefined;
	}
}

function mailErrorSummary(error: unknown) {
	return { name: safeErrorToken(error, "name"), code: safeErrorToken(error, "code") };
}

// Message previews contain the recipient and verification/reset links with live tokens.
// Fail-closed: only an explicit development runtime with the explicit flag prints them;
// a missing or any other NODE_ENV (including production) never does.
const isEmailPreviewLogEnabled = () => process.env.NODE_ENV === "development" && env.EMAIL_PREVIEW_LOG;

const getTransport = () => {
	const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASS: pass, SMTP_FROM: from } = env;
	if (!host || !user || !pass || !from) return;

	cachedTransport ??= nodemailer.createTransport({
		host,
		port: env.SMTP_PORT,
		secure: env.SMTP_SECURE,
		auth: { user, pass },
	});

	return cachedTransport;
};

export const sendEmail = async (options: SendEmailOptions) => {
	const transport = getTransport();
	const from = options.from ?? env.SMTP_FROM ?? "1story <noreply@localhost>";
	const payload: SendMailOptions = {
		to: options.to,
		from,
		subject: options.subject,
		...(options.text === undefined ? {} : { text: options.text }),
		...(options.html === undefined ? {} : { html: options.html }),
	};

	if (options.react) {
		payload.html = await render(options.react);
		payload.text = options.text ?? (await render(options.react, { plainText: true }));
	}

	if (!payload.text && !payload.html) return;

	if (!transport) {
		if (isEmailPreviewLogEnabled()) {
			console.info("[email preview] SMTP not configured; email not sent.", {
				kind: options.kind,
				to: payload.to,
				subject: payload.subject,
				text: payload.text,
				html: payload.html,
			});
			return;
		}

		console.warn("Email skipped: SMTP not configured.", { kind: options.kind });
		return;
	}

	try {
		await transport.sendMail(payload);
	} catch (error) {
		// Name and code only: mailer errors carry the envelope and recipient addresses.
		console.error("There was an error sending mail.", mailErrorSummary(error));
	}
};
