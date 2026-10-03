import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORPCError } from "@orpc/client";

const whereMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => {
	const chain = {
		from: () => chain,
		innerJoin: () => chain,
		where: (...args: unknown[]) => whereMock(...args),
	};
	return { select: vi.fn(() => chain) };
});
const getResumeByIdMock = vi.hoisted(() => vi.fn());
const loadMasterProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));
vi.mock("@reactive-resume/db/schema", () => ({
	cvmateCvBuild: { id: "build_id", userId: "build_user_id", identitySnapshot: "build_identity_snapshot" },
	cvmateCvDocument: { resumeId: "document_resume_id", userId: "document_user_id", cvBuildId: "document_build_id" },
}));
vi.mock("drizzle-orm", () => ({
	and: (...args: unknown[]) => ["and", ...args],
	eq: (...args: unknown[]) => ["eq", ...args],
}));
vi.mock("../resume/service", () => ({ resumeService: { getById: getResumeByIdMock } }));
vi.mock("../cvmate-build/ai-redaction-context", () => ({ loadMasterProfileAiIdentity: loadMasterProfileMock }));

const { resolveAtsReviewRedaction } = await import("./ats-review-redaction-context");
const { redactTextForAi } = await import("./redaction");

const resumeData = {
	basics: {
		name: "Jan Maria Kowalski",
		email: "jan@cv.example",
		phone: "+48 600 100 200",
		website: { url: "https://jankowalski.pl", label: "" },
		customFields: [
			{ id: "1", icon: "", text: "jan.alt@cv.example", link: "" },
			{ id: "2", icon: "", text: "+48 601 234 567", link: "" },
			{ id: "3", icon: "", text: "GitHub", link: "https://github.com/jankowalski" },
		],
	},
	sections: { profiles: { items: [{ website: { url: "https://www.linkedin.com/in/jan-kowalski-123" } }] } },
};

beforeEach(() => {
	whereMock.mockReset();
	getResumeByIdMock.mockReset();
	loadMasterProfileMock.mockReset();
	loadMasterProfileMock.mockResolvedValue(undefined);
	whereMock.mockResolvedValue([]);
});

describe("resolveAtsReviewRedaction", () => {
	it("uses the account identity when there is no Master Profile and no resume", async () => {
		const redaction = await resolveAtsReviewRedaction({
			userId: "user-1",
			user: { name: "Marta Zając", email: "marta@konto.example" },
		});

		expect(redactTextForAi("Marta Zając, marta@konto.example, Zając", redaction.context)).toBe(
			"[OSOBA], [EMAIL], [OSOBA]",
		);
		expect(redaction.knownFullNames).toEqual(["Marta Zając"]);
		expect(getResumeByIdMock).not.toHaveBeenCalled();
	});

	it("keeps a one-word account name as a first name, which is never redacted alone", async () => {
		const redaction = await resolveAtsReviewRedaction({ userId: "user-1", user: { name: "Marta", email: null } });

		expect(redactTextForAi("Marta z zespołu", redaction.context)).toBe("Marta z zespołu");
		expect(redaction.knownFullNames).toEqual([]);
	});

	it("merges the account, the Master Profile, the resume and the CV build snapshot", async () => {
		loadMasterProfileMock.mockResolvedValue({ firstName: "Jan", lastName: "Kowalski", phone: "602 345 678" });
		getResumeByIdMock.mockResolvedValue({ id: "resume-1", data: resumeData });
		whereMock.mockResolvedValue([
			{ identitySnapshot: { firstName: "Jan", lastName: "Nowak", email: "old@cv.example" } },
		]);

		const redaction = await resolveAtsReviewRedaction({
			userId: "user-1",
			user: { name: "Jan K", email: "konto@cv.example" },
			resumeId: "resume-1",
		});

		const text = [
			"Jan Maria Kowalski, Nowak",
			"jan@cv.example, jan.alt@cv.example, old@cv.example, konto@cv.example",
			"600100200, 601 234 567, 602-345-678",
			"jankowalski.pl/blog, github.com/jankowalski, linkedin.com/in/jan-kowalski-123",
		].join("\n");

		expect(redactTextForAi(text, redaction.context)).toBe(
			[
				"[OSOBA], [OSOBA]",
				"[EMAIL], [EMAIL], [EMAIL], [EMAIL]",
				"[TELEFON], [TELEFON], [TELEFON]",
				"[URL], [URL], [URL]",
			].join("\n"),
		);
		expect(redaction.knownFullNames).toEqual(["Jan K", "Jan Kowalski", "Jan Maria Kowalski", "Jan Nowak"]);
		expect(getResumeByIdMock).toHaveBeenCalledWith({ id: "resume-1", userId: "user-1" });
	});

	it("scopes the CV build lookup to the requesting user", async () => {
		getResumeByIdMock.mockResolvedValue({ id: "resume-1", data: resumeData });

		await resolveAtsReviewRedaction({ userId: "user-1", user: {}, resumeId: "resume-1" });

		expect(JSON.stringify(whereMock.mock.calls[0])).toContain('["eq","document_user_id","user-1"]');
		expect(JSON.stringify(whereMock.mock.calls[0])).toContain('["eq","build_user_id","user-1"]');
	});

	it("treats a resume that did not come from a CV build as an ordinary resume", async () => {
		getResumeByIdMock.mockResolvedValue({ id: "resume-1", data: resumeData });
		whereMock.mockResolvedValue([]);

		const redaction = await resolveAtsReviewRedaction({ userId: "user-1", user: {}, resumeId: "resume-1" });

		expect(redaction.knownFullNames).toEqual(["Jan Maria Kowalski"]);
	});

	it("adds the builder resume's references: names, phones, links and descriptions", async () => {
		getResumeByIdMock.mockResolvedValue({
			id: "resume-1",
			data: {
				...resumeData,
				sections: {
					...resumeData.sections,
					references: {
						items: [
							{
								name: "Anna Nowak",
								position: "Dyrektor",
								phone: "601 999 888",
								website: { url: "https://www.linkedin.com/in/anna-nowak" },
								description: "<p>Anna była moją przełożoną&nbsp;przez trzy lata.</p>",
							},
							{
								name: "Available upon request",
								position: "",
								phone: "",
								website: { url: "" },
								description: "<p>Krótko</p>",
							},
						],
					},
				},
			},
		});

		const redaction = await resolveAtsReviewRedaction({ userId: "user-1", user: {}, resumeId: "resume-1" });

		expect(redactTextForAi("Anna Nowak, Nowak, 601 999 888, linkedin.com/in/anna-nowak", redaction.context)).toBe(
			"[OSOBA], [OSOBA], [TELEFON], [URL]",
		);
		// A note in the name field is not a person, so "request" must not become a redacted last name.
		expect(redactTextForAi("Delivered on request.", redaction.context)).toBe("Delivered on request.");
		expect(redaction.referencePhrases).toEqual(["Anna była moją przełożoną przez trzy lata."]);
		// Only names that read like a person: the "Available upon request" note is left out.
		expect(redaction.referenceNames).toEqual([{ firstName: "Anna", lastName: "Nowak" }]);
		// The header line decision is about the user, never about a reference.
		expect(redaction.knownFullNames).toEqual(["Jan Maria Kowalski"]);
		expect(redaction.identities).toEqual(expect.arrayContaining([expect.objectContaining({ phone: "601 999 888" })]));
	});

	it("tolerates stored resume data with missing fields", async () => {
		getResumeByIdMock.mockResolvedValue({ id: "resume-1", data: { basics: { name: "" } } });

		await expect(
			resolveAtsReviewRedaction({ userId: "user-1", user: {}, resumeId: "resume-1" }),
		).resolves.toBeDefined();
	});

	it("answers another user's resume and a missing one with the same error", async () => {
		const attempt = (failure: unknown) => {
			getResumeByIdMock.mockRejectedValueOnce(failure);
			return resolveAtsReviewRedaction({ userId: "user-1", user: {}, resumeId: "resume-x" }).catch(
				(error: unknown) => error,
			);
		};

		// resumeService.getById filters by id and owner, so both cases surface as NOT_FOUND there; the
		// resolver also flattens any other failure on this path into the same answer.
		const foreign = await attempt(new ORPCError("NOT_FOUND"));
		const failed = await attempt(new Error("connection reset for resume-x"));

		for (const error of [foreign, failed]) {
			expect(error).toBeInstanceOf(ORPCError);
			expect(error).toMatchObject({ code: "NOT_FOUND", message: "Resume not found." });
			expect((error as Error).cause).toBeUndefined();
			expect(JSON.stringify(error)).not.toContain("resume-x");
		}
	});
});
