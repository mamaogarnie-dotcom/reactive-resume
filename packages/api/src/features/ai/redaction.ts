import { BARE_DOMAIN_PATTERN, EMAIL_PATTERN, URL_PATTERN } from "@reactive-resume/resume/contact-patterns";

// Deterministic redaction of contact and identity details from free text before it is sent to an
// external AI provider. It only ever changes the AI payload: stored Master Profile data, CV builds
// and generated CV content keep the user's original text.

export const AI_REDACTION_PLACEHOLDERS = {
	email: "[EMAIL]",
	phone: "[TELEFON]",
	url: "[URL]",
	person: "[OSOBA]",
	address: "[ADRES]",
} as const;

/** Also catches spaced or translated echoes of a placeholder, so they can never reach a finished CV. */
const PLACEHOLDER_ECHO_PATTERN = /\[\s*(?:e-?mail|telefon|phone|url|osoba|person|name|adres|address)\s*\]/iu;

export type AiIdentityTerms = {
	firstName?: string | null;
	lastName?: string | null;
	email?: string | null;
	phone?: string | null;
	linkedinUrl?: string | null;
	websiteUrl?: string | null;
};

type Replacement = {
	pattern: RegExp;
	placeholder: string;
	/** Returns false to keep a candidate match unchanged. */
	accept?: (match: string) => boolean;
};

export type AiRedactionContext = {
	readonly identityReplacements: readonly Replacement[];
};

const MIN_LAST_NAME_LENGTH = 3;
const MIN_PHONE_DIGITS = 9;
const MAX_PHONE_DIGITS = 15;

const NOT_AFTER_WORD = "(?<![\\p{L}\\p{N}])";
const NOT_BEFORE_WORD = "(?![\\p{L}\\p{N}])";
const NOT_AFTER_DIGIT = "(?<![\\d\\p{L}])";
/** A digit group followed by a currency or unit is an amount, not a phone number. */
const NOT_BEFORE_DIGIT_OR_UNIT = "(?!\\d)(?![\\s\\u00a0]*(?:zł|zl|pln|eur|usd|€|\\$|mln|mld|tys|%|k\\b))";

const PHONE_REPLACEMENTS: readonly Replacement[] = [
	// International, with an explicit `+` or `00` country prefix: +48 123 456 789, 0048 12 345 67 89.
	{
		pattern: new RegExp(
			`${NOT_AFTER_DIGIT}(?:\\+|00)\\d{1,3}[\\s.-]?(?:\\(\\d{1,4}\\)[\\s.-]?)?\\d{2,4}(?:[\\s.-]?\\d{2,4}){1,4}${NOT_BEFORE_DIGIT_OR_UNIT}`,
			"giu",
		),
		placeholder: AI_REDACTION_PLACEHOLDERS.phone,
		accept: (match) => {
			const digits = match.replace(/\D/g, "").length;
			return digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS;
		},
	},
	// Polish mobile written in 3-3-3 groups with one consistent separator: 601 234 567, 601-234-567.
	{
		pattern: new RegExp(`${NOT_AFTER_DIGIT}[4-8]\\d{2}([ -])\\d{3}\\1\\d{3}${NOT_BEFORE_DIGIT_OR_UNIT}`, "giu"),
		placeholder: AI_REDACTION_PLACEHOLDERS.phone,
	},
	// Polish landline: (12) 345 67 89, 12 345 67 89, 12-345-67-89.
	{
		pattern: new RegExp(
			`${NOT_AFTER_DIGIT}(?:\\([1-9]\\d\\)[ -]?|[1-9]\\d([ -]))\\d{3}[ -]\\d{2}[ -]\\d{2}${NOT_BEFORE_DIGIT_OR_UNIT}`,
			"giu",
		),
		placeholder: AI_REDACTION_PLACEHOLDERS.phone,
	},
	// Nine contiguous digits only when explicitly labelled as a phone number: tel. 601234567.
	{
		pattern: new RegExp(
			`(?<=${NOT_AFTER_WORD}(?:tel|telefon|phone|kom|mob|komórka|komorka)\\.?:?[\\s\\u00a0]*)\\d{9}${NOT_BEFORE_DIGIT_OR_UNIT}`,
			"giu",
		),
		placeholder: AI_REDACTION_PLACEHOLDERS.phone,
	},
];

/** Trailing sentence punctuation is part of the sentence, not of the URL. */
function splitTrailingPunctuation(value: string): [string, string] {
	const match = value.match(/[.,;:!?]+$/u);
	if (!match) return [value, ""];
	return [value.slice(0, -match[0].length), match[0]];
}

const URL_REPLACEMENTS: readonly Replacement[] = [{ pattern: URL_PATTERN, placeholder: AI_REDACTION_PLACEHOLDERS.url }];

const EMAIL_REPLACEMENTS: readonly Replacement[] = [
	{ pattern: EMAIL_PATTERN, placeholder: AI_REDACTION_PLACEHOLDERS.email },
];

// A bare domain is redacted only with a path (linkedin.com/in/jan, portfolio.pl/cv). Without one it
// is usually an employer or product name (Booking.com), which is a professional fact. The host is
// matched regardless of case (LINKEDIN.COM/in/jan); only the technology names listed below, written
// like a host with a path (ASP.NET/MVC), are not links.
const EXTRA_BARE_DOMAIN_PATTERN = /\b(?:[\w-]+\.)+(?:pl|eu|de|uk|info|biz)(?:\/[^\s<>"')\]]*)?/gi;

const TECHNOLOGY_NAME_HOSTS = new Set(["asp.net", "vb.net", "ado.net"]);

function isBareLinkWithPath(match: string): boolean {
	const slashIndex = match.indexOf("/");
	if (slashIndex === -1 || slashIndex === match.length - 1) return false;

	return !TECHNOLOGY_NAME_HOSTS.has(match.slice(0, slashIndex).toLowerCase());
}

const BARE_DOMAIN_REPLACEMENTS: readonly Replacement[] = [
	{ pattern: BARE_DOMAIN_PATTERN, placeholder: AI_REDACTION_PLACEHOLDERS.url, accept: isBareLinkWithPath },
	{ pattern: EXTRA_BARE_DOMAIN_PATTERN, placeholder: AI_REDACTION_PLACEHOLDERS.url, accept: isBareLinkWithPath },
];

const SPACE = "[\\s\\u00a0]";
const STREET_NAME_WORD = "[\\p{L}\\d][\\p{L}\\d.'-]*";
/** A building number or range: 5, 7a, 5-7. */
const BUILDING_NUMBER = "\\d{1,4}[a-z]?(?:-\\d{1,4}[a-z]?)?";
const POSTAL_CODE = "\\d{2}-\\d{3}";

// A street address needs a street prefix, a name and a building number: ul. Polna 5, al. Jana Pawła II
// 12/4, ulica Długa 10 m. 2. A number inside the street name is followed by the building number
// (ul. Dywizjonu 303 12/4). A postal code right after the street is part of the address; the town
// stays, because a location is a professional fact. The lookbehind keeps "Firma.pl. W 2019" intact,
// and the full prefixes are whole words, so "na ulicach Warszawy" is not an address.
const STREET_ADDRESS_PATTERN = new RegExp(
	`(?<![\\p{L}\\p{N}.])(?:ul\\.|al\\.|os\\.|pl\\.|(?:ulica|aleja)${NOT_BEFORE_WORD})${SPACE}*` +
		`${STREET_NAME_WORD}(?:${SPACE}+${STREET_NAME_WORD}){0,3}?` +
		`${SPACE}+${BUILDING_NUMBER}(?:${SPACE}+${BUILDING_NUMBER}(?=${SPACE}*\\/))?` +
		`(?:${SPACE}*\\/${SPACE}*${BUILDING_NUMBER}|${SPACE}+(?:m|lok)\\.${SPACE}*\\d{1,4})?` +
		`(?:(?:,${SPACE}*|${SPACE}+)${POSTAL_CODE})?${NOT_BEFORE_WORD}`,
	"giu",
);

// A postal code on its own counts only directly before a capitalised town name (00-950 Warszawa), so
// ranges such as "10-200 osób", "20-300 zł", "10-200 PLN" or "10-200 OSÓB" stay. Only the code is
// redacted; the town stays. A town written in capitals (00-950 WARSZAWA) is a known limitation: it
// cannot be told apart from an upper-case unit or currency.
const POSTAL_CODE_PATTERN = new RegExp(
	`(?<![\\p{L}\\p{N}-])${POSTAL_CODE}` +
		`(?=${SPACE}+\\p{Lu}\\p{Ll})` +
		`(?!${SPACE}+(?:PLN|EUR|USD|CHF|GBP|ZŁ|ZL|MLN|MLD|TYS)${NOT_BEFORE_WORD})`,
	"gu",
);

const ADDRESS_REPLACEMENTS: readonly Replacement[] = [
	{ pattern: STREET_ADDRESS_PATTERN, placeholder: AI_REDACTION_PLACEHOLDERS.address },
	{ pattern: POSTAL_CODE_PATTERN, placeholder: AI_REDACTION_PLACEHOLDERS.address },
];

const POLISH_FOLD: Record<string, string> = {
	ą: "a",
	ć: "c",
	ę: "e",
	ł: "l",
	ń: "n",
	ó: "o",
	ś: "s",
	ź: "z",
	ż: "z",
	Ą: "A",
	Ć: "C",
	Ę: "E",
	Ł: "L",
	Ń: "N",
	Ó: "O",
	Ś: "S",
	Ź: "Z",
	Ż: "Z",
};

function foldPolish(value: string): string {
	return value.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu, (character) => POLISH_FOLD[character] ?? character);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanTerm(value: string | null | undefined): string {
	return value?.trim().replace(/\s+/g, " ") ?? "";
}

/** A term with flexible inner whitespace, matched as whole words, with and without Polish diacritics. */
function wordTermPatterns(term: string): RegExp[] {
	const variants = [...new Set([term, foldPolish(term)])];

	return variants.map(
		(variant) => new RegExp(`${NOT_AFTER_WORD}${escapeRegExp(variant).replace(/ /g, "\\s+")}${NOT_BEFORE_WORD}`, "giu"),
	);
}

function personReplacements(identity: AiIdentityTerms): Replacement[] {
	const firstName = cleanTerm(identity.firstName);
	const lastName = cleanTerm(identity.lastName);
	const terms: string[] = [];

	// The first name alone is deliberately kept: on its own it is too common to identify anyone and
	// it collides with colleagues, clients and product names in professional facts.
	if (firstName && lastName) terms.push(`${firstName} ${lastName}`, `${lastName} ${firstName}`);

	if (lastName.length >= MIN_LAST_NAME_LENGTH) terms.push(lastName);

	// Compound surnames (Nowak-Kowalska) are also redacted part by part.
	for (const part of lastName.split(/[\s-]+/)) {
		if (part.length >= MIN_LAST_NAME_LENGTH && part !== lastName) terms.push(part);
	}

	return terms.flatMap((term) =>
		wordTermPatterns(term).map((pattern) => ({ pattern, placeholder: AI_REDACTION_PLACEHOLDERS.person })),
	);
}

function emailReplacements(identity: AiIdentityTerms): Replacement[] {
	const email = cleanTerm(identity.email);
	if (!email) return [];

	return [{ pattern: new RegExp(escapeRegExp(email), "giu"), placeholder: AI_REDACTION_PLACEHOLDERS.email }];
}

function phoneReplacements(identity: AiIdentityTerms): Replacement[] {
	const allDigits = cleanTerm(identity.phone).replace(/\D/g, "");
	if (allDigits.length < 7) return [];

	// Match the national number however it is written, with or without a country prefix.
	const digits = allDigits.length > 9 ? allDigits.slice(-9) : allDigits;
	const body = [...digits].join("[\\s().-]*");

	return [
		{
			// Same amount guard as the generic patterns: "Revenue 601 234 567 PLN" is a figure, not a phone.
			pattern: new RegExp(`(?<!\\d)(?:(?:\\+|00)\\d{1,3}[\\s.-]*)?${body}${NOT_BEFORE_DIGIT_OR_UNIT}`, "giu"),
			placeholder: AI_REDACTION_PLACEHOLDERS.phone,
		},
	];
}

function profileUrlReplacements(identity: AiIdentityTerms): Replacement[] {
	return [identity.linkedinUrl, identity.websiteUrl].flatMap((value) => {
		const core = cleanTerm(value)
			.replace(/^https?:\/\//i, "")
			.replace(/^www\./i, "")
			.replace(/\/+$/, "");

		if (core.length < 4) return [];

		return [
			{
				pattern: new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?${escapeRegExp(core)}\\/?`, "giu"),
				placeholder: AI_REDACTION_PLACEHOLDERS.url,
			},
		];
	});
}

/**
 * Builds the redaction context from every identity source available for the user, e.g. the CV
 * build's identity snapshot together with the current Master Profile.
 */
export function buildAiRedactionContext(
	identities: ReadonlyArray<AiIdentityTerms | null | undefined>,
): AiRedactionContext {
	const present = identities.filter((identity): identity is AiIdentityTerms => Boolean(identity));

	return {
		identityReplacements: [
			...present.flatMap(profileUrlReplacements),
			...present.flatMap(emailReplacements),
			...present.flatMap(personReplacements),
			...present.flatMap(phoneReplacements),
		],
	};
}

function applyReplacements(text: string, replacements: readonly Replacement[]): string {
	let result = text;

	for (const { pattern, placeholder, accept } of replacements) {
		result = result.replace(pattern, (match: string) => {
			const [value, trailing] = splitTrailingPunctuation(match);
			if (!value || (accept && !accept(value))) return match;
			return `${placeholder}${trailing}`;
		});
	}

	return result;
}

export function redactTextForAi(text: string, context: AiRedactionContext): string;
export function redactTextForAi(text: string | null, context: AiRedactionContext): string | null;
export function redactTextForAi(text: string | null, context: AiRedactionContext): string | null {
	if (text === null || text.length === 0) return text;

	const identityUrls = context.identityReplacements.filter(
		(replacement) => replacement.placeholder === AI_REDACTION_PLACEHOLDERS.url,
	);
	const identityRest = context.identityReplacements.filter(
		(replacement) => replacement.placeholder !== AI_REDACTION_PLACEHOLDERS.url,
	);

	// Order matters: links and e-mail addresses go first because they often contain the person's
	// name, street addresses before names and phones, and phone numbers go last so digits inside links
	// and addresses are already gone.
	return applyReplacements(text, [
		...identityUrls,
		...URL_REPLACEMENTS,
		...EMAIL_REPLACEMENTS,
		...BARE_DOMAIN_REPLACEMENTS,
		...ADDRESS_REPLACEMENTS,
		...identityRest,
		...PHONE_REPLACEMENTS,
	]);
}

/** Redacts every string inside a JSON-like value; other values are returned unchanged. */
export function redactValuesForAi<T>(value: T, context: AiRedactionContext): T {
	if (typeof value === "string") return redactTextForAi(value, context) as T;

	if (Array.isArray(value)) return value.map((item) => redactValuesForAi(item, context)) as T;

	if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactValuesForAi(item, context)]),
		) as T;
	}

	return value;
}

export function containsAiRedactionPlaceholder(text: string | null | undefined): boolean {
	return typeof text === "string" && PLACEHOLDER_ECHO_PATTERN.test(text);
}
