import type { AtsReviewRedaction } from "./ats-review-redaction-context";
import type { AiIdentityTerms } from "./redaction";
import { ORPCError } from "@orpc/client";
import { z } from "zod";
import { atsReviewSystemPrompt, atsReviewUserPromptTemplate } from "@reactive-resume/ai/prompts";
import { EMAIL_TEST, PROFESSIONAL_HOSTS, SPACED_EMAIL_TEST } from "@reactive-resume/resume/contact-patterns";
import { generateJson } from "./generate-json";
import {
	AI_REDACTION_PLACEHOLDERS,
	buildAiRedactionContext,
	containsAiRedactionPlaceholder,
	normalizeTextForAi,
	redactContactLinePhones,
	redactTextForAi,
} from "./redaction";
import { getModel } from "./service";

/** Roughly a very long resume. The client truncates the extracted text to this before sending. */
const MAX_EXTRACTED_TEXT_CHARS = 50_000;
/** Matches the cap the applications feature already uses for a pasted posting. */
const MAX_JOB_DESCRIPTION_CHARS = 20_000;
const MAX_FINDINGS = 120;

export const atsReviewInputSchema = z.object({
	aiProviderId: z.string().optional(),
	/** The builder resume the PDF was rendered from; adds its identity details to the redaction. */
	resumeId: z.string().min(1).max(64).optional(),
	extractedText: z.string().trim().min(1).max(MAX_EXTRACTED_TEXT_CHARS),
	findings: z
		.array(
			z.object({
				code: z.string().max(64),
				severity: z.string().max(16),
				message: z.string().max(300),
			}),
		)
		.max(MAX_FINDINGS)
		.default([]),
	jobDescription: z.string().trim().max(MAX_JOB_DESCRIPTION_CHARS).optional(),
});

type AtsReviewInput = z.infer<typeof atsReviewInputSchema>;

const impactSchema = z.enum(["high", "medium", "low"]).catch("medium");

/**
 * Tolerant by design: a provider that returns one malformed suggestion should cost the user that
 * suggestion, not the whole review. Lists are capped by slicing rather than rejecting.
 *
 * There is deliberately no score anywhere in this shape. The deterministic report owns the only
 * number in this feature, and an AI-adjusted score would make it mean less.
 */
export const atsReviewOutputSchema = z.object({
	summary: z.string().catch(""),
	suggestions: z
		.array(
			z.object({
				section: z.string().nullable().catch(null),
				issue: z.string().catch(""),
				rewrite: z.string().nullable().catch(null),
				impact: impactSchema,
			}),
		)
		.catch([])
		.transform((entries) => entries.filter((entry) => entry.issue.trim().length > 0).slice(0, 12)),
	strengths: z
		.array(z.string())
		.catch([])
		.transform((entries) => entries.filter(Boolean).slice(0, 8)),
	jdAlignment: z
		.object({
			verdict: z.string().catch(""),
			missingConcepts: z
				.array(z.string())
				.catch([])
				.transform((entries) => entries.filter(Boolean).slice(0, 15)),
			strengths: z
				.array(z.string())
				.catch([])
				.transform((entries) => entries.filter(Boolean).slice(0, 10)),
		})
		.nullable()
		.catch(null),
});

export type AtsReviewOutput = z.infer<typeof atsReviewOutputSchema>;

type AtsReviewServiceInput = AtsReviewInput & {
	provider: Parameters<typeof getModel>[0]["provider"];
	model: string;
	apiKey: string;
	baseURL: string;
};

/** The only message a failed preparation ever carries: no resume text, no cause. */
const PREPARATION_FAILED_MESSAGE = "The resume text could not be prepared for AI review.";

// --- Header name line ------------------------------------------------------------------------

const MAX_HEADER_NAME_LENGTH = 60;
const TITLE_CASE_NAME_WORD = /^\p{Lu}\p{Ll}+(?:[-'’]\p{Lu}?\p{Ll}+)*$/u;
const UPPER_CASE_NAME_WORD = /^\p{Lu}{2,}(?:[-'’]\p{Lu}{2,})*$/u;

// "CV" alone is a single word and never passes the two-word minimum; it is listed for clarity.
const DOCUMENT_TITLES = new Set(["curriculum vitae", "cv", "zyciorys", "resume", "list motywacyjny", "cover letter"]);

// Compared after folding case and Polish characters, so "Menedżer" and "MANAGER" both count.
const JOB_TITLE_WORDS = new Set([
	"manager",
	"menedzer",
	"kierownik",
	"kierowniczka",
	"dyrektor",
	"dyrektorka",
	"director",
	"developer",
	"programista",
	"programistka",
	"engineer",
	"inzynier",
	"inzynierka",
	"specjalista",
	"specjalistka",
	"specialist",
	"analityk",
	"analityczka",
	"analyst",
	"consultant",
	"konsultant",
	"konsultantka",
	"designer",
	"projektant",
	"projektantka",
	"architect",
	"architekt",
	"architektka",
	"lead",
	"leader",
	"senior",
	"junior",
	"intern",
	"stazysta",
	"stazystka",
	"asystent",
	"asystentka",
	"assistant",
	"koordynator",
	"koordynatorka",
	"coordinator",
	"officer",
	"owner",
	"head",
	"administrator",
	"administratorka",
	"tester",
	"testerka",
	"ksiegowy",
	"ksiegowa",
	"accountant",
	"executive",
	"product",
	"project",
]);

function foldForComparison(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[łŁ]/gu, (character) => (character === "ł" ? "l" : "L"))
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

/** A one-row header puts the name first and the contact details after a separator. */
const HEADER_SEGMENT_SEPARATOR = /\s*[|•·▪●]\s*/u;

/**
 * The first non-empty line, or its first segment in a one-row header, when it reads like a person's
 * name rather than a document title or a job title.
 */
function detectHeaderNameLine(text: string): string | null {
	const firstLine = text
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0);
	const candidate = firstLine?.split(HEADER_SEGMENT_SEPARATOR)[0]?.trim();

	if (!candidate || candidate.length > MAX_HEADER_NAME_LENGTH || /\d/.test(candidate)) return null;

	const words = candidate.split(" ");
	if (words.length < 2 || words.length > 4) return null;
	if (!words.every((word) => TITLE_CASE_NAME_WORD.test(word) || UPPER_CASE_NAME_WORD.test(word))) return null;

	const folded = foldForComparison(candidate);
	if (DOCUMENT_TITLES.has(folded)) return null;
	if (folded.split(/[\s'’-]+/).some((word) => JOB_TITLE_WORDS.has(word))) return null;

	return candidate;
}

function sameName(left: string, right: string): boolean {
	const words = (value: string) =>
		foldForComparison(value)
			.split(/[\s-]+/)
			.sort()
			.join(" ");
	return words(left) === words(right);
}

/**
 * Redacts the header name line in place, and only there. A name that matches one of the user's
 * identity sources is already redacted everywhere by the identity patterns.
 */
function redactHeaderNameLine(text: string, knownFullNames: readonly string[]): string {
	const nameLine = detectHeaderNameLine(text);
	if (!nameLine || knownFullNames.some((known) => sameName(known, nameLine))) return text;

	const index = text.indexOf(nameLine);
	return `${text.slice(0, index)}${AI_REDACTION_PLACEHOLDERS.person}${text.slice(index + nameLine.length)}`;
}

// --- References section ------------------------------------------------------------------------
//
// References never go to the provider (AGENTS.md A3). A line that starts with a references heading
// (also "Referencje   Kursy", where two columns share the line) starts a cut to the next heading this
// list knows, or to the end of the text; cutting too much is the accepted failure mode. A references
// heading in the middle of a line belongs to another column and cannot be separated safely, so the
// request fails closed. Only the heading form counts: a capital first letter, capitals throughout, or
// a colon after the word. "zebrałem referencje od klientów" in a sentence neither cuts nor blocks.

/** The heading words in any case; whether an occurrence is a heading is decided by its form. */
const REFERENCE_HEADING_WORD =
	/(?<![\p{L}\p{N}])(?:referencje|references|rekomendacje|osoby[ ]polecające|osoby[ ]polecajace)(?![\p{L}\p{N}])/giu;

// Compared after folding case and Polish characters and dropping a trailing colon.
const SECTION_HEADINGS = new Set([
	"doswiadczenie",
	"doswiadczenie zawodowe",
	"historia zatrudnienia",
	"przebieg kariery",
	"experience",
	"work experience",
	"professional experience",
	"employment history",
	"wyksztalcenie",
	"edukacja",
	"education",
	"umiejetnosci",
	"kompetencje",
	"skills",
	"key skills",
	"jezyki",
	"jezyki obce",
	"languages",
	"certyfikaty",
	"certyfikaty i kursy",
	"certifications",
	"kursy",
	"szkolenia",
	"kursy i szkolenia",
	"courses",
	"training",
	"projekty",
	"projects",
	"zainteresowania",
	"hobby",
	"interests",
	"osiagniecia",
	"achievements",
	"nagrody",
	"awards",
	"publikacje",
	"publications",
	"wolontariat",
	"volunteering",
	"volunteer experience",
	"profil",
	"profil zawodowy",
	"podsumowanie",
	"o mnie",
	"summary",
	"profile",
	"about me",
	"kontakt",
	"contact",
	"dane osobowe",
	"dane kontaktowe",
	"klauzula",
	"klauzula rodo",
	"zgoda",
	"rodo",
]);

/** A consent clause usually closes a Polish resume without a heading of its own. */
const CLAUSE_START = /^(?:wyrazam zgode|zgodnie z art|i (?:hereby )?(?:agree|consent)|klauzula)/;
/** "Referencje: dostępne na życzenie" is a note, not a section. */
const ON_REQUEST_NOTE = /^(?:dostepne|udostepnie|available|provided)\b.*(?:zyczenie|prosbe|request)/;

/** A line folded for heading checks: no case, no Polish characters, no leading bullet, tight colons. */
function headingKey(line: string): string {
	return foldForComparison(line)
		.replace(/^[^\p{L}]+/u, "")
		.replace(/\s*:\s*/g, ":");
}

function isHeadingForm(word: string, after: string): boolean {
	const first = word.charAt(0);
	return first !== first.toLowerCase() || /^\s*:/u.test(after);
}

/**
 * Where a references heading sits on the line: at its start (after any bullet), in the middle (another
 * column), or nowhere. A note such as "Referencje dostępne na życzenie" is not a heading.
 */
function findReferenceHeading(line: string): "start" | "inline" | null {
	for (const match of line.matchAll(REFERENCE_HEADING_WORD)) {
		const after = line.slice(match.index + match[0].length);
		if (!isHeadingForm(match[0], after)) continue;
		if (ON_REQUEST_NOTE.test(foldForComparison(after.replace(/^\s*:?\s*/u, "")))) continue;

		return /^[^\p{L}\p{N}]*$/u.test(line.slice(0, match.index)) ? "start" : "inline";
	}

	return null;
}

function isSectionBoundary(key: string): boolean {
	return SECTION_HEADINGS.has(key.replace(/:$/, "")) || CLAUSE_START.test(key);
}

type ReferencesCut = {
	text: string;
	/** A references section was found and cut, or one was found that could not be cut. */
	found: boolean;
	/** A references heading sits mid-line, beside another column: the text must not be sent. */
	inseparable: boolean;
};

function removeReferencesSection(text: string): ReferencesCut {
	const kept: string[] = [];
	let inReferences = false;
	let found = false;
	let inseparable = false;

	for (const line of text.split("\n")) {
		const heading = findReferenceHeading(line);

		if (heading === "start") {
			inReferences = true;
			found = true;
			continue;
		}

		if (inReferences && isSectionBoundary(headingKey(line))) inReferences = false;
		if (inReferences) continue;

		if (heading === "inline") {
			found = true;
			inseparable = true;
		}
		kept.push(line);
	}

	return { text: kept.join("\n"), found, inseparable };
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Removes the builder resume's reference descriptions wherever they appear, however they wrapped. */
function removeReferencePhrases(text: string, phrases: readonly string[]): string {
	return phrases.reduce((result, phrase) => {
		const words = normalizeTextForAi(phrase).split(/\s+/).filter(Boolean).map(escapeRegExp);
		if (words.length === 0) return result;
		return result.replace(new RegExp(words.join("\\s+"), "giu"), "");
	}, text);
}

// --- Contact zone ------------------------------------------------------------------------------
//
// An unlabelled nine-digit number is a phone number only where contact details live: the first lines
// of the resume, and lines that carry a contact label or a header separator.

const CONTACT_ZONE_HEAD_LINES = 5;
const CONTACT_LABEL = /(?<![\p{L}\p{N}])(?:tel|telefon|kontakt|contact|mobile|mob|kom|phone)(?!\p{L})/iu;
const CONTACT_SEPARATOR = /[|•·▪●]/u;

function redactContactZonePhones(text: string): string {
	let nonEmptyLines = 0;

	return text
		.split("\n")
		.map((line) => {
			const inHead = line.trim().length > 0 && nonEmptyLines++ < CONTACT_ZONE_HEAD_LINES;
			return inHead || CONTACT_LABEL.test(line) || CONTACT_SEPARATOR.test(line) ? redactContactLinePhones(line) : line;
		})
		.join("\n");
}

// --- Residual guard --------------------------------------------------------------------------

type ResidualCategory = "email" | "phone" | "url";

const MIN_GUARDED_PHONE_DIGITS = 7;
const NATIONAL_PHONE_DIGITS = 9;
const DIGIT_RUN = /\d(?:[\s().-]*\d)*/g;

function guardedPhoneDigits(identities: readonly AiIdentityTerms[]): string[] {
	return identities.flatMap((identity) => {
		const digits = identity.phone?.replace(/\D/g, "") ?? "";
		if (digits.length < MIN_GUARDED_PHONE_DIGITS) return [];
		return [digits.length > NATIONAL_PHONE_DIGITS ? digits.slice(-NATIONAL_PHONE_DIGITS) : digits];
	});
}

/** A bare professional host (github.com) is a common word in a resume, not the user's own link. */
function guardedUrlCores(identities: readonly AiIdentityTerms[]): string[] {
	return identities.flatMap((identity) =>
		[identity.linkedinUrl, identity.websiteUrl].flatMap((value) => {
			const core = (value ?? "")
				.trim()
				.replace(/^https?:\/\//i, "")
				.replace(/^www\./i, "")
				.replace(/\/+$/, "")
				.toLowerCase();

			if (core.length < 4 || PROFESSIONAL_HOSTS.includes(core)) return [];
			return [core];
		}),
	);
}

/**
 * Last line of defence on the finished prompt. The criteria are deliberately narrow: any address
 * shape, or one of the user's own phone numbers or links. Years, amounts, tax and company numbers
 * do not match unless they are literally the user's phone number.
 */
function findResidualContact(prompt: string, identities: readonly AiIdentityTerms[]): ResidualCategory | null {
	// Also the shapes PDF extraction leaves behind: `jan@ gmail . COM`, `jan@gmail.\ncom`.
	if (EMAIL_TEST.test(prompt) || SPACED_EMAIL_TEST.test(prompt)) return "email";

	const phones = guardedPhoneDigits(identities);
	if (phones.length > 0) {
		const runs = (prompt.match(DIGIT_RUN) ?? []).map((run) => run.replace(/\D/g, ""));
		if (runs.some((run) => phones.some((phone) => run.includes(phone)))) return "phone";
	}

	const lowerPrompt = prompt.toLowerCase();
	if (guardedUrlCores(identities).some((core) => lowerPrompt.includes(core))) return "url";

	return null;
}

// --- Prompt ----------------------------------------------------------------------------------

function renderFindings(findings: AtsReviewInput["findings"]): string {
	if (findings.length === 0) return "None reported.";
	return findings.map((finding) => `- [${finding.severity}] ${finding.code}: ${finding.message}`).join("\n");
}

function renderJobDescriptionSection(jobDescription: string | undefined): string {
	if (!jobDescription) return "";

	return [
		"",
		"## Job description",
		"",
		"<<<JOB_DESCRIPTION_START>>>",
		jobDescription,
		"<<<JOB_DESCRIPTION_END>>>",
	].join("\n");
}

const CONTACT_PRESENCE_LABELS: ReadonlyArray<[string, string]> = [
	["Name", AI_REDACTION_PLACEHOLDERS.person],
	["E-mail", AI_REDACTION_PLACEHOLDERS.email],
	["Phone", AI_REDACTION_PLACEHOLDERS.phone],
	["Links", AI_REDACTION_PLACEHOLDERS.url],
	["Street address", AI_REDACTION_PLACEHOLDERS.address],
];

/** Which kinds of contact detail the resume has, read off the redaction itself. Never the values. */
function renderContactPresence(redactedText: string, referencesHidden: boolean): string {
	return [
		...CONTACT_PRESENCE_LABELS.map(
			([label, placeholder]) =>
				`- ${label}: ${redactedText.includes(placeholder) ? "present (value hidden)" : "not detected"}`,
		),
		`- References section: ${referencesHidden ? "present (content hidden)" : "not detected"}`,
	].join("\n");
}

/**
 * Builds the user prompt from redacted values only. Throws when anything identifying is left in the
 * finished prompt; the caller turns that into a controlled error without sending anything.
 */
function prepareAtsReviewPrompt(input: AtsReviewInput, redaction: AtsReviewRedaction): string {
	const patternsOnly = buildAiRedactionContext([]);
	const redact = (value: string) => redactTextForAi(normalizeTextForAi(value), redaction.context);

	const references = removeReferencesSection(normalizeTextForAi(input.extractedText));
	if (references.inseparable) failClosed("reference");

	const withoutReferences = removeReferencePhrases(references.text, redaction.referencePhrases);
	const referencesHidden = references.found || withoutReferences !== references.text;

	// A builder resume names its references: if one of them is still in the text after the cut, in any
	// form, the section was not fully separated and nothing may be sent.
	if (redaction.referenceNames.length > 0) {
		const namesOnly = buildAiRedactionContext(redaction.referenceNames);
		if (redactTextForAi(withoutReferences, namesOnly) !== withoutReferences) failClosed("reference");
	}

	const resumeText = redactContactZonePhones(
		redactTextForAi(redactHeaderNameLine(withoutReferences, redaction.knownFullNames), redaction.context),
	);

	// The posting is someone else's text: like the job offer in CV builds, only the patterns apply.
	const jobDescription = input.jobDescription
		? redactTextForAi(normalizeTextForAi(input.jobDescription), patternsOnly)
		: undefined;

	// Findings are rendered from client-supplied strings, so they are treated as untrusted text too.
	const findings = input.findings.map((finding) => ({
		code: redact(finding.code),
		severity: redact(finding.severity),
		message: redact(finding.message),
	}));

	const prompt = atsReviewUserPromptTemplate
		.replaceAll("{{EXTRACTED_TEXT}}", () => resumeText)
		.replaceAll("{{CONTACT_PRESENCE}}", () => renderContactPresence(resumeText, referencesHidden))
		.replaceAll("{{FINDINGS}}", () => renderFindings(findings))
		.replaceAll("{{JOB_DESCRIPTION_SECTION}}", () => renderJobDescriptionSection(jobDescription));

	const residual = findResidualContact(prompt, redaction.identities);
	if (residual) failClosed(residual);

	return prompt;
}

/** Logs only the category, never a value, a fragment or a length, and stops the request. */
function failClosed(category: ResidualCategory | "reference"): never {
	console.warn("[ats-review] residual PII guard", { category });
	throw new Error("ATS_REVIEW_RESIDUAL_PII");
}

// --- Output ----------------------------------------------------------------------------------

export type AtsReviewSanitizeCounts = {
	blankedSummary: number;
	droppedSuggestions: number;
	nulledRewrites: number;
	nulledSections: number;
	droppedStrengths: number;
	blankedVerdict: number;
	droppedMissingConcepts: number;
	droppedJdStrengths: number;
	droppedJdAlignment: number;
};

/**
 * Removes every echo of a redaction placeholder from what the user will read, so a review can never
 * say "your [EMAIL]". Logs how many fields were touched, never what they said.
 */
function sanitizeAtsReviewOutput(output: AtsReviewOutput): AtsReviewOutput {
	const counts: AtsReviewSanitizeCounts = {
		blankedSummary: 0,
		droppedSuggestions: 0,
		nulledRewrites: 0,
		nulledSections: 0,
		droppedStrengths: 0,
		blankedVerdict: 0,
		droppedMissingConcepts: 0,
		droppedJdStrengths: 0,
		droppedJdAlignment: 0,
	};

	const keepClean = (entries: string[], key: keyof AtsReviewSanitizeCounts) => {
		const clean = entries.filter((entry) => !containsAiRedactionPlaceholder(entry));
		counts[key] += entries.length - clean.length;
		return clean;
	};

	let summary = output.summary;
	if (containsAiRedactionPlaceholder(summary)) {
		summary = "";
		counts.blankedSummary += 1;
	}

	const suggestions = output.suggestions.flatMap((suggestion) => {
		if (containsAiRedactionPlaceholder(suggestion.issue)) {
			counts.droppedSuggestions += 1;
			return [];
		}

		let { rewrite, section } = suggestion;
		if (containsAiRedactionPlaceholder(rewrite)) {
			rewrite = null;
			counts.nulledRewrites += 1;
		}
		if (containsAiRedactionPlaceholder(section)) {
			section = null;
			counts.nulledSections += 1;
		}

		return [{ ...suggestion, rewrite, section }];
	});

	const strengths = keepClean(output.strengths, "droppedStrengths");

	let jdAlignment = output.jdAlignment;
	if (jdAlignment) {
		let { verdict } = jdAlignment;
		if (containsAiRedactionPlaceholder(verdict)) {
			verdict = "";
			counts.blankedVerdict += 1;
		}

		const missingConcepts = keepClean(jdAlignment.missingConcepts, "droppedMissingConcepts");
		const jdStrengths = keepClean(jdAlignment.strengths, "droppedJdStrengths");

		// An empty block would still render its heading in the review, so it goes entirely.
		if (!verdict.trim() && missingConcepts.length === 0 && jdStrengths.length === 0) {
			jdAlignment = null;
			counts.droppedJdAlignment += 1;
		} else {
			jdAlignment = { verdict, missingConcepts, strengths: jdStrengths };
		}
	}

	if (Object.values(counts).some((count) => count > 0)) {
		console.warn("[ats-review] placeholder echoes removed", counts);
	}

	return { summary, suggestions, strengths, jdAlignment };
}

/**
 * Qualitative review of the writing. Never returns a score — see {@link atsReviewOutputSchema}.
 *
 * Fail-closed: when the text cannot be redacted, or anything identifying survives redaction, nothing
 * is sent to the provider and the caller gets an error that carries no resume text.
 */
export async function reviewResumeText(
	input: AtsReviewServiceInput,
	redaction: AtsReviewRedaction,
): Promise<AtsReviewOutput> {
	let prompt: string;

	try {
		prompt = prepareAtsReviewPrompt(input, redaction);
	} catch {
		throw new ORPCError("INTERNAL_SERVER_ERROR", { message: PREPARATION_FAILED_MESSAGE });
	}

	const model = getModel(input);
	const output = await generateJson(model, { system: atsReviewSystemPrompt, prompt }, atsReviewOutputSchema);

	return sanitizeAtsReviewOutput(output);
}

export const __testables = {
	detectHeaderNameLine,
	findResidualContact,
	prepareAtsReviewPrompt,
	redactContactZonePhones,
	removeReferencesSection,
	renderFindings,
	sanitizeAtsReviewOutput,
};
