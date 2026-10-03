import { afterEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	SMTP_HOST: undefined as string | undefined,
	SMTP_PORT: 587,
	SMTP_USER: undefined as string | undefined,
	SMTP_PASS: undefined as string | undefined,
	SMTP_FROM: undefined as string | undefined,
	SMTP_SECURE: false,
	EMAIL_PREVIEW_LOG: false,
}));

const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail })));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));
vi.mock("nodemailer", () => ({
	default: { createTransport },
	createTransport,
}));
vi.mock("react-email", () => ({
	render: async (_node: unknown, opts?: { plainText?: boolean }) =>
		opts?.plainText ? "plain text body" : "<p>html body</p>",
}));

const { sendEmail } = await import("./transport");

const RESET_TOKEN = "rst_9f8e7d6c5b4a3210";
const fixture = {
	kind: "password-reset" as const,
	to: "jan.kowalski@example.com",
	subject: "Reset your password",
	text: `Open https://1story.pl/auth/reset-password?token=${RESET_TOKEN} to reset your password.`,
	html: `<a href="https://1story.pl/api/auth/reset-password/${RESET_TOKEN}">Reset your password</a>`,
};
const SECRETS = [fixture.to, fixture.subject, RESET_TOKEN, "reset-password", "1story.pl"];
const SKIPPED_MESSAGE = "Email skipped: SMTP not configured.";

const resetEnv = () => {
	envMock.SMTP_HOST = undefined;
	envMock.SMTP_USER = undefined;
	envMock.SMTP_PASS = undefined;
	envMock.SMTP_FROM = undefined;
	envMock.EMAIL_PREVIEW_LOG = false;
	createTransport.mockClear();
	sendMail.mockClear();
};

const spyOnConsole = () => ({
	log: vi.spyOn(console, "log").mockImplementation(() => {}),
	info: vi.spyOn(console, "info").mockImplementation(() => {}),
	warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
	error: vi.spyOn(console, "error").mockImplementation(() => {}),
	debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
	trace: vi.spyOn(console, "trace").mockImplementation(() => {}),
});

const loggedText = (spies: ReturnType<typeof spyOnConsole>) =>
	JSON.stringify(Object.values(spies).flatMap((spy) => spy.mock.calls));

const expectNoSecrets = (spies: ReturnType<typeof spyOnConsole>, secrets: string[]) => {
	const logged = loggedText(spies);
	for (const secret of secrets) expect(logged).not.toContain(secret);
};

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

describe("sendEmail", () => {
	it("does nothing when neither text nor html is provided", async () => {
		resetEnv();
		await sendEmail({ kind: "verification", to: "a@b.com", subject: "hi" });
		expect(sendMail).not.toHaveBeenCalled();
	});

	describe("without SMTP in production", () => {
		it("logs only the skipped event and the message kind", async () => {
			resetEnv();
			vi.stubEnv("NODE_ENV", "production");
			const spies = spyOnConsole();

			await sendEmail(fixture);

			expect(spies.warn).toHaveBeenCalledExactlyOnceWith(SKIPPED_MESSAGE, { kind: "password-reset" });
			expect(spies.info).not.toHaveBeenCalled();
			expect(sendMail).not.toHaveBeenCalled();
			expectNoSecrets(spies, SECRETS);
		});

		it("ignores EMAIL_PREVIEW_LOG", async () => {
			resetEnv();
			vi.stubEnv("NODE_ENV", "production");
			envMock.EMAIL_PREVIEW_LOG = true;
			const spies = spyOnConsole();

			await sendEmail(fixture);

			expect(spies.warn).toHaveBeenCalledExactlyOnceWith(SKIPPED_MESSAGE, { kind: "password-reset" });
			expectNoSecrets(spies, SECRETS);
		});

		it("does not leak rendered react content", async () => {
			resetEnv();
			vi.stubEnv("NODE_ENV", "production");
			const spies = spyOnConsole();

			const fakeReact = { $$typeof: Symbol.for("react.element") } as unknown as React.ReactElement;
			await sendEmail({ kind: "verification", to: fixture.to, subject: "Verify your email", react: fakeReact });

			expect(spies.warn).toHaveBeenCalledExactlyOnceWith(SKIPPED_MESSAGE, { kind: "verification" });
			expectNoSecrets(spies, [fixture.to, "Verify your email", "html body", "plain text body"]);
		});
	});

	describe("without SMTP and without NODE_ENV", () => {
		it("does not preview the message even when EMAIL_PREVIEW_LOG is enabled", async () => {
			resetEnv();
			vi.stubEnv("NODE_ENV", undefined);
			envMock.EMAIL_PREVIEW_LOG = true;
			const spies = spyOnConsole();

			await sendEmail(fixture);

			expect(spies.warn).toHaveBeenCalledExactlyOnceWith(SKIPPED_MESSAGE, { kind: "password-reset" });
			expect(spies.info).not.toHaveBeenCalled();
			expectNoSecrets(spies, SECRETS);
		});

		it.each(["test", "staging", "Development", ""])(
			"does not preview the message for NODE_ENV=%j even when EMAIL_PREVIEW_LOG is enabled",
			async (nodeEnv) => {
				resetEnv();
				vi.stubEnv("NODE_ENV", nodeEnv);
				envMock.EMAIL_PREVIEW_LOG = true;
				const spies = spyOnConsole();

				await sendEmail(fixture);

				expect(spies.info).not.toHaveBeenCalled();
				expectNoSecrets(spies, SECRETS);
			},
		);
	});

	describe("without SMTP in development", () => {
		it("does not preview the message unless EMAIL_PREVIEW_LOG is enabled", async () => {
			resetEnv();
			vi.stubEnv("NODE_ENV", "development");
			const spies = spyOnConsole();

			await sendEmail(fixture);

			expect(spies.warn).toHaveBeenCalledExactlyOnceWith(SKIPPED_MESSAGE, { kind: "password-reset" });
			expectNoSecrets(spies, SECRETS);
		});

		it("previews the full message when EMAIL_PREVIEW_LOG is enabled", async () => {
			resetEnv();
			vi.stubEnv("NODE_ENV", "development");
			envMock.EMAIL_PREVIEW_LOG = true;
			const spies = spyOnConsole();

			await sendEmail(fixture);

			expect(spies.info).toHaveBeenCalledExactlyOnceWith("[email preview] SMTP not configured; email not sent.", {
				kind: "password-reset",
				to: fixture.to,
				subject: fixture.subject,
				text: fixture.text,
				html: fixture.html,
			});
			expect(spies.warn).not.toHaveBeenCalled();
			expect(sendMail).not.toHaveBeenCalled();
		});
	});

	it("sends via nodemailer when SMTP is fully configured", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";

		await sendEmail({ kind: "verification", to: "a@b.com", subject: "hi", text: "body" });

		expect(createTransport).toHaveBeenCalledWith(
			expect.objectContaining({
				host: "smtp.example.com",
				port: 587,
				secure: false,
				auth: { user: "user", pass: "pass" },
			}),
		);
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "a@b.com",
				from: "noreply@example.com",
				subject: "hi",
				text: "body",
			}),
		);
	});

	it("does not send when SMTP_FROM is unset, even with an explicit from", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		spyOnConsole();

		await sendEmail({ kind: "verification", to: "a@b.com", from: "explicit@x.com", subject: "hi", text: "body" });
		expect(sendMail).not.toHaveBeenCalled();
	});

	it("renders react element into both html and plain-text bodies", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";

		const fakeReact = { $$typeof: Symbol.for("react.element") } as unknown as React.ReactElement;
		await sendEmail({ kind: "verification", to: "a@b.com", subject: "hi", react: fakeReact });

		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				html: "<p>html body</p>",
				text: "plain text body",
			}),
		);
	});

	it("does not throw if the SMTP transport itself errors", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";
		sendMail.mockRejectedValueOnce(new Error("boom"));

		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(
			sendEmail({ kind: "verification", to: "a@b.com", subject: "hi", text: "body" }),
		).resolves.toBeUndefined();
		expect(errorSpy).toHaveBeenCalled();
	});
});
