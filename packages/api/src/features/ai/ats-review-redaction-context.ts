import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { AiIdentityTerms, AiRedactionContext } from "./redaction";
import { ORPCError } from "@orpc/client";
import { and, eq } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { EMAIL_TEST } from "@reactive-resume/resume/contact-patterns";
import { loadMasterProfileAiIdentity } from "../cvmate-build/ai-redaction-context";
import { resumeService } from "../resume/service";
import { buildAiRedactionContext } from "./redaction";

// Identity sources for the ATS review payload. The reviewed PDF is either rendered from one of the
// user's resumes in the builder or uploaded on the ATS checker page, so the redaction context is the
// union of everything known about the user: account, Master Profile and, for a builder resume, its
// basics and the identity snapshot of the CV build it came from. A builder resume also names its
// references, which must never reach the provider (AGENTS.md A3), so their details are added too.

export type AtsReviewRedaction = {
	context: AiRedactionContext;
	/** The user's full names, for telling a known name apart from any other header line. */
	knownFullNames: string[];
	/** Raw identity values the residual guard checks the finished prompt against. */
	identities: AiIdentityTerms[];
	/** Plain-text descriptions of the builder resume's references, removed wherever they appear. */
	referencePhrases: string[];
	/** Names of the builder resume's references: still in the text after the cut means fail closed. */
	referenceNames: AiIdentityTerms[];
};

type AtsReviewRedactionInput = {
	userId: string;
	user: { name?: string | null; email?: string | null };
	resumeId?: string;
};

type ResumeRedactionSources = {
	identities: AiIdentityTerms[];
	referenceIdentities: AiIdentityTerms[];
	referencePhrases: string[];
};

/** Shorter descriptions are too likely to equal ordinary resume wording. */
const MIN_REFERENCE_PHRASE_LENGTH = 20;
const REFERENCE_NAME_WORD = /^\p{Lu}[\p{L}'’.-]*$/u;

/** "Jan Maria Kowalski" → first "Jan Maria", last "Kowalski". A single word stays a first name. */
function splitFullName(value: string | null | undefined): Pick<AiIdentityTerms, "firstName" | "lastName"> {
	const words = value?.trim().split(/\s+/).filter(Boolean) ?? [];
	if (words.length === 0) return {};
	if (words.length === 1) return { firstName: words[0] ?? null };

	return { firstName: words.slice(0, -1).join(" "), lastName: words.at(-1) ?? null };
}

function looksLikePhone(value: string): boolean {
	const digits = value.replace(/\D/g, "").length;
	return digits >= 7 && digits <= 15 && /^[+\d\s().-]+$/.test(value.trim());
}

/** Identity fields of a builder resume. The data is stored JSON, so every field is read defensively. */
function resumeDataIdentities(data: ResumeData | null | undefined): AiIdentityTerms[] {
	const basics = data?.basics;
	const identities: AiIdentityTerms[] = [
		{
			...splitFullName(basics?.name),
			email: basics?.email ?? null,
			phone: basics?.phone ?? null,
			websiteUrl: basics?.website?.url ?? null,
		},
	];

	for (const field of basics?.customFields ?? []) {
		const text = field?.text?.trim() ?? "";
		identities.push({
			websiteUrl: field?.link ?? null,
			...(EMAIL_TEST.test(text) ? { email: text } : {}),
			...(looksLikePhone(text) ? { phone: text } : {}),
		});
	}

	for (const profile of data?.sections?.profiles?.items ?? []) {
		if (profile?.website?.url) identities.push({ websiteUrl: profile.website.url });
	}

	return identities;
}

/**
 * A reference's name counts only when it reads like a person's name (2–4 capitalised words). The field
 * also holds notes such as "Available upon request", whose last word must not become a redacted name.
 */
function referenceName(value: string | null | undefined): Pick<AiIdentityTerms, "firstName" | "lastName"> {
	const words = value?.trim().split(/\s+/).filter(Boolean) ?? [];
	if (words.length < 2 || words.length > 4 || !words.every((word) => REFERENCE_NAME_WORD.test(word))) return {};

	return splitFullName(words.join(" "));
}

function htmlToPlainText(html: string): string {
	return html
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

/** Names, phones and links of the resume's references, plus their descriptions as whole phrases. */
function resumeDataReferences(
	data: ResumeData | null | undefined,
): Pick<ResumeRedactionSources, "referenceIdentities" | "referencePhrases"> {
	const referenceIdentities: AiIdentityTerms[] = [];
	const referencePhrases: string[] = [];

	for (const reference of data?.sections?.references?.items ?? []) {
		referenceIdentities.push({
			...referenceName(reference?.name),
			phone: reference?.phone ?? null,
			websiteUrl: reference?.website?.url ?? null,
		});

		const description = htmlToPlainText(reference?.description ?? "");
		if (description.length >= MIN_REFERENCE_PHRASE_LENGTH) referencePhrases.push(description);
	}

	return { referenceIdentities, referencePhrases };
}

async function loadResumeSources(userId: string, resumeId: string): Promise<ResumeRedactionSources> {
	try {
		// Scoped to the user: another user's resume and a missing one are the same NOT_FOUND.
		const resume = await resumeService.getById({ id: resumeId, userId });

		const [document] = await db
			.select({ identitySnapshot: schema.cvmateCvBuild.identitySnapshot })
			.from(schema.cvmateCvDocument)
			.innerJoin(schema.cvmateCvBuild, eq(schema.cvmateCvDocument.cvBuildId, schema.cvmateCvBuild.id))
			.where(
				and(
					eq(schema.cvmateCvDocument.resumeId, resumeId),
					eq(schema.cvmateCvDocument.userId, userId),
					eq(schema.cvmateCvBuild.userId, userId),
				),
			);

		return {
			identities: [
				...resumeDataIdentities(resume.data),
				...(document?.identitySnapshot ? [document.identitySnapshot] : []),
			],
			...resumeDataReferences(resume.data),
		};
	} catch {
		// One answer for every failure, so the response never tells whether the resume exists.
		throw new ORPCError("NOT_FOUND", { message: "Resume not found." });
	}
}

function fullNameOf(identity: AiIdentityTerms): string | null {
	const firstName = identity.firstName?.trim();
	const lastName = identity.lastName?.trim();
	return firstName && lastName ? `${firstName} ${lastName}` : null;
}

const NO_RESUME_SOURCES: ResumeRedactionSources = { identities: [], referenceIdentities: [], referencePhrases: [] };

export async function resolveAtsReviewRedaction(input: AtsReviewRedactionInput): Promise<AtsReviewRedaction> {
	const [masterProfile, resumeSources] = await Promise.all([
		loadMasterProfileAiIdentity(input.userId),
		input.resumeId ? loadResumeSources(input.userId, input.resumeId) : Promise.resolve(NO_RESUME_SOURCES),
	]);

	const userIdentities: AiIdentityTerms[] = [
		{ ...splitFullName(input.user.name), email: input.user.email ?? null },
		...(masterProfile ? [masterProfile] : []),
		...resumeSources.identities,
	];
	const identities = [...userIdentities, ...resumeSources.referenceIdentities];

	return {
		context: buildAiRedactionContext(identities),
		// The user's own names only: a reference's name says nothing about who the header names.
		knownFullNames: [...new Set(userIdentities.map(fullNameOf).filter((name): name is string => name !== null))],
		identities,
		referencePhrases: resumeSources.referencePhrases,
		referenceNames: resumeSources.referenceIdentities
			.filter((identity) => identity.firstName && identity.lastName)
			.map(({ firstName, lastName }) => ({ firstName: firstName ?? null, lastName: lastName ?? null })),
	};
}
