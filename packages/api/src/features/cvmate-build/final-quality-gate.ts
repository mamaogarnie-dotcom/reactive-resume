import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { z } from "zod";
import type { cvmateGeneratedContentSchema, cvmateSelectionItemSchema } from "../../dto/cvmate-build";
import type { CvmateBuildPageMetrics, CvmateBuildQualityGate } from "../../dto/cvmate-build-materialize";

type SelectionItem = z.infer<typeof cvmateSelectionItemSchema>;
type GeneratedContent = z.infer<typeof cvmateGeneratedContentSchema>;

type NarrativeFragment = {
	path: string;
	text: string;
	resumeItemId?: string;
};

const DEDUP_MINIMUM_NORMALIZED_LENGTH = 24;
const PROFESSIONAL_COMPLETENESS_UNDERFILL_THRESHOLD = 0.7;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&nbsp;/giu, " ")
		.replace(/&amp;/giu, "&")
		.replace(/&lt;/giu, "<")
		.replace(/&gt;/giu, ">")
		.replace(/&quot;/giu, '"')
		.replace(/&#39;/giu, "'");
}

function htmlToText(value: string): string {
	return decodeHtmlEntities(
		value
			.replace(/<br\s*\/?>/giu, "\n")
			.replace(/<\/?(?:p|li|ul|ol|div|section|article|blockquote)[^>]*>/giu, "\n")
			.replace(/<[^>]+>/gu, ""),
	).trim();
}

function normalizeNarrative(value: string): string {
	return htmlToText(value)
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replace(/\s+/gu, " ")
		.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "")
		.trim();
}

function numericTokens(value: string | null): Set<string> {
	if (!value) return new Set();

	return new Set([...value.normalize("NFKC").matchAll(/\d+(?:[.,]\d+)?/gu)].map((match) => match[0].replace(",", ".")));
}

const TARGET_TERM_MINIMUM_LENGTH = 7;
const GENERIC_TARGET_TERMS = new Set([
	"ability",
	"experience",
	"knowledge",
	"professional",
	"required",
	"requirement",
	"skills",
	"working",
	"do\u015bwiadczenie",
	"znajomo\u015b\u0107",
	"umiej\u0119tno\u015b\u0107",
	"podstawowych",
	"zwi\u0105zanych",
	"wymagane",
]);

function targetTerms(value: string): Set<string> {
	return new Set(
		normalizeNarrative(value)
			.split(/[^\p{L}\p{N}]+/gu)
			.filter(
				(token) =>
					token.length >= TARGET_TERM_MINIMUM_LENGTH &&
					!GENERIC_TARGET_TERMS.has(token),
			),
	);
}

function jobRequirementRecords(jobOfferSnapshot: Record<string, unknown> | null): Record<string, unknown>[] {
	const requirements = jobOfferSnapshot?.requirements;
	return Array.isArray(requirements) ? requirements.filter(isRecord) : [];
}

function criticalRequirementTexts(jobOfferSnapshot: Record<string, unknown> | null): string[] {
	return jobRequirementRecords(jobOfferSnapshot)
		.filter((requirement) => requirement.priority === "critical")
		.map((requirement) => (typeof requirement.text === "string" ? requirement.text.trim() : ""))
		.filter(Boolean);
}

function evidenceTerms(selectionItems: SelectionItem[]): Set<string> {
	const terms = new Set<string>();

	for (const item of selectionItems) {
		const text = item.sourceTextSnapshot ?? "";
		for (const token of targetTerms(text)) terms.add(token);
	}

	return terms;
}

function overlappingTerms(requirementText: string, evidence: ReadonlySet<string>): Set<string> {
	return new Set([...targetTerms(requirementText)].filter((token) => evidence.has(token)));
}

function selectedRecommendedEvidence(selectionItems: SelectionItem[]): SelectionItem[] {
	return selectionItems.filter(
		(item) =>
			item.selected &&
			item.recommended &&
			item.sourceType !== "profile_photo" &&
			item.sourceType !== "clause",
	);
}

function supportedCriticalHeadlineTerms(
	jobOfferSnapshot: Record<string, unknown> | null,
	selectionItems: SelectionItem[],
): Set<string> {
	const selectedEvidence = evidenceTerms(selectedRecommendedEvidence(selectionItems));
	const supported = new Set<string>();

	for (const requirementText of criticalRequirementTexts(jobOfferSnapshot)) {
		for (const token of overlappingTerms(requirementText, selectedEvidence)) {
			supported.add(token);
		}
	}

	return supported;
}

function hasSupportedCriticalRequirementSelection(
	requirementText: string,
	selectionItems: SelectionItem[],
): boolean {
	const selectedEvidence = evidenceTerms(selectedRecommendedEvidence(selectionItems));
	return overlappingTerms(requirementText, selectedEvidence).size > 0;
}

function hasAvailableCriticalRequirementEvidence(
	requirementText: string,
	selectionItems: SelectionItem[],
): boolean {
	return overlappingTerms(requirementText, evidenceTerms(selectionItems)).size > 0;
}

function collectResumeItemIds(value: unknown, ids = new Set<string>()): Set<string> {
	if (Array.isArray(value)) {
		for (const item of value) collectResumeItemIds(item, ids);
		return ids;
	}

	if (!isRecord(value)) return ids;

	if (typeof value.id === "string" && value.id.trim()) {
		ids.add(value.id);
	}

	for (const child of Object.values(value)) {
		collectResumeItemIds(child, ids);
	}

	return ids;
}

function pushNarrative(fragments: NarrativeFragment[], path: string, value: unknown, resumeItemId?: string) {
	if (typeof value !== "string" || value.length === 0) return;

	fragments.push({
		path,
		text: value,
		...(resumeItemId ? { resumeItemId } : {}),
	});
}

function collectNarrativeFragments(data: ResumeData): NarrativeFragment[] {
	const fragments: NarrativeFragment[] = [];

	pushNarrative(fragments, "summary.content", data.summary.content);

	for (const [sectionId, sectionValue] of Object.entries(data.sections)) {
		if (["skills", "languages", "profiles", "interests"].includes(sectionId)) continue;
		if (!isRecord(sectionValue) || !Array.isArray(sectionValue.items)) continue;

		for (const [index, itemValue] of sectionValue.items.entries()) {
			if (!isRecord(itemValue)) continue;

			const itemRecord: Record<string, unknown> = itemValue;
			const resumeItemId = typeof itemRecord.id === "string" ? itemRecord.id : undefined;

			for (const key of ["description", "summary", "content"]) {
				pushNarrative(fragments, `sections.${sectionId}.items.${index}.${key}`, itemRecord[key], resumeItemId);
			}
		}
	}

	for (const [sectionIndex, sectionValue] of data.customSections.entries()) {
		if (!isRecord(sectionValue) || sectionValue.id === "cvmate-clauses") continue;
		if (!Array.isArray(sectionValue.items)) continue;

		for (const [itemIndex, itemValue] of sectionValue.items.entries()) {
			if (!isRecord(itemValue)) continue;

			const itemRecord: Record<string, unknown> = itemValue;
			const resumeItemId = typeof itemRecord.id === "string" ? itemRecord.id : undefined;

			for (const key of ["description", "summary", "content"]) {
				pushNarrative(
					fragments,
					`customSections.${sectionIndex}.items.${itemIndex}.${key}`,
					itemRecord[key],
					resumeItemId,
				);
			}
		}
	}

	return fragments;
}

function splitSummarySentences(value: string): string[] {
	return htmlToText(value)
		.split(/(?:\r?\n)+|(?<=[.!?])\s+/u)
		.map((sentence) => sentence.trim())
		.filter(Boolean);
}

function collectDedupNarrativeUnits(
	fragments: NarrativeFragment[],
): NarrativeFragment[] {
	const units: NarrativeFragment[] = [];

	for (const fragment of fragments) {
		if (fragment.path === "summary.content") {
			for (const sentence of splitSummarySentences(fragment.text)) {
				units.push({
					...fragment,
					text: sentence,
				});
			}
			continue;
		}

		const atomicParts = htmlToText(fragment.text)
			.split(/\r?\n+/u)
			.map((part) => part.trim())
			.filter(Boolean);

		for (const part of atomicParts) {
			units.push({
				...fragment,
				text: part,
			});
		}
	}

	return units;
}

function latestGeneratedSelectionText(generatedContent: GeneratedContent[], selectionItemId: string): string | null {
	for (let index = generatedContent.length - 1; index >= 0; index -= 1) {
		const item = generatedContent[index];
		if (!item) continue;

		if (item.selectionItemId !== selectionItemId || item.kind !== "experience_fact") continue;

		return item.finalText ?? item.aiText ?? item.sourceText ?? null;
	}

	return null;
}

function finding(
	dimension: CvmateBuildQualityGate["findings"][number]["dimension"],
	severity: CvmateBuildQualityGate["findings"][number]["severity"],
	code: string,
	message: string,
	optional: Partial<Pick<CvmateBuildQualityGate["findings"][number], "selectionItemId" | "resumeItemId" | "path">> = {},
) {
	return {
		code,
		dimension,
		severity,
		message,
		...optional,
	} satisfies CvmateBuildQualityGate["findings"][number];
}

function dimensionStatus(
	findings: CvmateBuildQualityGate["findings"],
	dimension: CvmateBuildQualityGate["findings"][number]["dimension"],
): CvmateBuildQualityGate["dimensions"]["coverage"] {
	const relevant = findings.filter((item) => item.dimension === dimension);

	if (relevant.some((item) => item.severity === "blocking")) return "blocked";
	if (relevant.length > 0) return "warning";
	return "pass";
}

export function evaluateFinalCvQuality(input: {
	data: ResumeData;
	pageMetrics: CvmateBuildPageMetrics;
	selectionItems: SelectionItem[];
	generatedContent: GeneratedContent[];
	jobOfferSnapshot?: Record<string, unknown> | null;
}): CvmateBuildQualityGate {
	const findings: CvmateBuildQualityGate["findings"] = [];
	const { data, selectionItems, generatedContent, jobOfferSnapshot = null } = input;
	const fragments = collectNarrativeFragments(data);
	const dedupUnits = collectDedupNarrativeUnits(fragments);
	const renderedIds = collectResumeItemIds(data);

	const normalizedNarrative = fragments
		.map((fragment) => normalizeNarrative(fragment.text))
		.filter(Boolean)
		.join(" ");

	if (!data.basics.headline.trim()) {
		findings.push(
			finding(
				"coverage",
				"warning",
				"MISSING_PROFESSIONAL_HEADLINE",
				"The final CV does not contain a professional headline.",
				{ path: "basics.headline" },
			),
		);
	}

	const supportedHeadlineTerms = supportedCriticalHeadlineTerms(jobOfferSnapshot, selectionItems);

	if (supportedHeadlineTerms.size > 0) {
		const headlineTerms = targetTerms(data.basics.headline);
		const hasSupportedTargetTerm = [...supportedHeadlineTerms].some((token) => headlineTerms.has(token));

		if (!hasSupportedTargetTerm) {
			findings.push(
				finding(
					"coverage",
					"warning",
					"HEADLINE_MISSES_SUPPORTED_CRITICAL_REQUIREMENT_TERM",
					"The professional headline does not include any candidate-supported term from a critical job requirement.",
					{ path: "basics.headline" },
				),
			);
		}
	}

	const uncoveredCriticalRequirement = criticalRequirementTexts(jobOfferSnapshot).find(
		(requirementText) =>
			hasAvailableCriticalRequirementEvidence(requirementText, selectionItems) &&
			!hasSupportedCriticalRequirementSelection(requirementText, selectionItems),
	);

	if (uncoveredCriticalRequirement) {
		findings.push(
			finding(
				"coverage",
				"warning",
				"SUPPORTED_CRITICAL_REQUIREMENT_NOT_SELECTED",
				"Candidate evidence exists for a critical job requirement but no selected recommended item covers it.",
			),
		);
	}

	const educationAvailable = selectionItems.some((item) => item.sourceType === "education");
	const educationRendered = data.sections.education.items.some(
		(item) => !item.hidden && item.school.trim().length > 0,
	);

	if (educationAvailable && !educationRendered) {
		findings.push(
			finding(
				"coverage",
				"warning",
				"AVAILABLE_EDUCATION_NOT_RENDERED",
				"Education is available in the frozen CV build inventory but no visible education item is rendered.",
				{ path: "sections.education.items" },
			),
		);
	}

	const languageAvailable = selectionItems.some((item) => item.sourceType === "language");
	const languageRendered = data.sections.languages.items.some(
		(item) => !item.hidden && item.language.trim().length > 0,
	);

	if (languageAvailable && !languageRendered) {
		findings.push(
			finding(
				"coverage",
				"warning",
				"AVAILABLE_LANGUAGE_NOT_RENDERED",
				"Language information is available in the frozen CV build inventory but no visible language item is rendered.",
				{ path: "sections.languages.items" },
			),
		);
	}

	if (
		input.pageMetrics.actualPageCount === 1 &&
		input.pageMetrics.lastPageTextUtilization < PROFESSIONAL_COMPLETENESS_UNDERFILL_THRESHOLD
	) {
		findings.push(
			finding(
				"density",
				"warning",
				"ONE_PAGE_UNDERFILLED",
				"The final one-page CV uses less than 70% of the available page text area.",
				{ path: "pageMetrics.lastPageTextUtilization" },
			),
		);
	}
	for (const item of selectionItems) {
		if (!item.selected || !item.recommended) continue;
		if (item.sourceType === "profile_photo" || item.sourceType === "clause") continue;

		if (renderedIds.has(item.id)) continue;

		const generatedText = latestGeneratedSelectionText(generatedContent, item.id);
		const expectedText = normalizeNarrative(generatedText ?? item.sourceTextSnapshot ?? "");

		if (expectedText && normalizedNarrative.includes(expectedText)) continue;

		findings.push(
			finding(
				"coverage",
				"warning",
				"RECOMMENDED_SELECTED_ITEM_NOT_RENDERED",
				"A selected recommended item could not be confirmed in the final rendered CV data.",
				{ selectionItemId: item.id },
			),
		);
	}

	for (const fragment of fragments) {
		const plainText = htmlToText(fragment.text);

		if (fragment.text.trim() && !plainText) {
			findings.push(
				finding(
					"grammar",
					"warning",
					"EMPTY_NARRATIVE_FRAGMENT",
					"A final narrative field contains markup but no readable text.",
					{ path: fragment.path, ...(fragment.resumeItemId ? { resumeItemId: fragment.resumeItemId } : {}) },
				),
			);
		}

		if (/[^\S\r\n]{2,}/u.test(plainText)) {
			findings.push(
				finding("grammar", "warning", "REPEATED_WHITESPACE", "A final narrative field contains repeated whitespace.", {
					path: fragment.path,
					...(fragment.resumeItemId ? { resumeItemId: fragment.resumeItemId } : {}),
				}),
			);
		}

		if (/!{2,}|\?{2,}|\.{4,}/u.test(plainText)) {
			findings.push(
				finding(
					"grammar",
					"warning",
					"REPEATED_TERMINAL_PUNCTUATION",
					"A final narrative field contains repeated terminal punctuation.",
					{ path: fragment.path, ...(fragment.resumeItemId ? { resumeItemId: fragment.resumeItemId } : {}) },
				),
			);
		}

		const sentences =
			plainText.match(/[^.!?]+(?:[.!?]+|$)/gu)?.map((sentence) => sentence.trim()) ??
			[];

		for (let index = 1; index < sentences.length; index += 1) {
			const previousSentence = sentences[index - 1] ?? "";
			const currentSentence = sentences[index] ?? "";
			const previousTokens =
				previousSentence.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
			const currentTokens =
				currentSentence.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
			const repeatedBoundaryFragment =
				numericTokens(previousSentence).size > 0 &&
				numericTokens(currentSentence).size === 0 &&
				currentTokens.length > 0 &&
				currentTokens.length <= 2 &&
				previousTokens.length > 0 &&
				previousTokens[previousTokens.length - 1] === currentTokens[0];

			if (!repeatedBoundaryFragment) continue;

			findings.push(
				finding(
					"grammar",
					"warning",
					"REPEATED_SENTENCE_BOUNDARY_FRAGMENT",
					"A final narrative field contains a short repeated sentence-boundary fragment after quantified text.",
					{ path: fragment.path, ...(fragment.resumeItemId ? { resumeItemId: fragment.resumeItemId } : {}) },
				),
			);
			break;
		}
	}

	const firstFragmentByNormalizedText = new Map<string, NarrativeFragment>();

	for (const fragment of dedupUnits) {
		const normalized = normalizeNarrative(fragment.text);

		if (normalized.length < DEDUP_MINIMUM_NORMALIZED_LENGTH) continue;

		const first = firstFragmentByNormalizedText.get(normalized);

		if (!first) {
			firstFragmentByNormalizedText.set(normalized, fragment);
			continue;
		}

		findings.push(
			finding(
				"dedup",
				"warning",
				"DUPLICATE_FINAL_NARRATIVE_TEXT",
				"Two final narrative fragments contain the same normalized text.",
				{
					path: fragment.path,
					...(fragment.resumeItemId ? { resumeItemId: fragment.resumeItemId } : {}),
				},
			),
		);
	}

	for (const item of selectionItems) {
		if (!item.selected || item.parentSelectionItemId === null) continue;

		const sourceNumbers = numericTokens(item.sourceTextSnapshot);
		if (sourceNumbers.size === 0) continue;

		const mappedFragments = fragments.filter((fragment) => fragment.resumeItemId === item.parentSelectionItemId);

		const comparisonText = mappedFragments.map((fragment) => htmlToText(fragment.text)).join(" ");
		const renderedNumbers = numericTokens(comparisonText);

		const missingNumbers = [...sourceNumbers].filter((token) => !renderedNumbers.has(token));

		if (missingNumbers.length === 0) continue;

		findings.push(
			finding(
				"achievements_numbers",
				"warning",
				"SELECTED_NUMERIC_EVIDENCE_NOT_PRESERVED",
				"Selected numeric evidence is not fully preserved in the mapped final CV fact.",
				{
					selectionItemId: item.id,
					resumeItemId: item.parentSelectionItemId,
				},
			),
		);
	}

	const pages = data.metadata.layout.pages;
	const main = pages[0]?.main ?? [];

	if (!data.picture.hidden || data.picture.url) {
		findings.push(
			finding(
				"master_ats",
				"blocking",
				"MASTER_ATS_PICTURE_VISIBLE",
				"MASTER ATS requires the profile picture to remain hidden.",
				{ path: "picture" },
			),
		);
	}

	if (pages.length !== 1) {
		findings.push(
			finding(
				"master_ats",
				"blocking",
				"MASTER_ATS_LAYOUT_PAGE_COUNT",
				"MASTER ATS requires one logical layout page.",
				{ path: "metadata.layout.pages" },
			),
		);
	}

	if (pages[0]?.fullWidth !== true) {
		findings.push(
			finding(
				"master_ats",
				"blocking",
				"MASTER_ATS_NOT_FULL_WIDTH",
				"MASTER ATS requires a full-width one-column logical layout.",
				{ path: "metadata.layout.pages.0.fullWidth" },
			),
		);
	}

	if ((pages[0]?.sidebar.length ?? 0) !== 0) {
		findings.push(
			finding("master_ats", "blocking", "MASTER_ATS_SIDEBAR_NOT_EMPTY", "MASTER ATS requires an empty sidebar.", {
				path: "metadata.layout.pages.0.sidebar",
			}),
		);
	}

	if (new Set(main).size !== main.length) {
		findings.push(
			finding(
				"master_ats",
				"blocking",
				"MASTER_ATS_DUPLICATE_MAIN_SECTION",
				"MASTER ATS main section IDs must be unique.",
				{ path: "metadata.layout.pages.0.main" },
			),
		);
	}

	if (main.length === 0) {
		findings.push(
			finding("master_ats", "blocking", "MASTER_ATS_EMPTY_MAIN", "MASTER ATS requires at least one main section.", {
				path: "metadata.layout.pages.0.main",
			}),
		);
	}

	const dimensions = {
		coverage: dimensionStatus(findings, "coverage"),
		grammar: dimensionStatus(findings, "grammar"),
		dedup: dimensionStatus(findings, "dedup"),
		achievementsNumbers: dimensionStatus(findings, "achievements_numbers"),
		masterAts: dimensionStatus(findings, "master_ats"),
		density: dimensionStatus(findings, "density"),
	} satisfies CvmateBuildQualityGate["dimensions"];

	const status = findings.some((item) => item.severity === "blocking")
		? "blocked"
		: findings.length > 0
			? "warning"
			: "pass";

	return {
		status,
		findings,
		dimensions,
	};
}

export const __testables = {
	collectNarrativeFragments,
	collectDedupNarrativeUnits,
	normalizeNarrative,
	numericTokens,
	targetTerms,
	criticalRequirementTexts,
	supportedCriticalHeadlineTerms,
	hasAvailableCriticalRequirementEvidence,
	hasSupportedCriticalRequirementSelection,
};
