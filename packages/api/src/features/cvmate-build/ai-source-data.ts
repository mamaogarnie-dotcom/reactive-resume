import type { CvmateSelectionSourceType } from "@reactive-resume/db/schema";

// Only these professional fields may be sent to the AI provider. Anything else is dropped,
// including fields added to the profile in the future (fail closed).
export const AI_ALLOWED_SOURCE_DATA_KEYS = new Set([
	"company",
	"jobTitle",
	"location",
	"isCurrent",
	"startDate",
	"endDate",
	"date",
	"text",
	"kind",
	"value",
	"name",
	"description",
	"institution",
	"degree",
	"fieldOfStudy",
	"specialization",
	"organization",
	"role",
	"content",
	"language",
	"level",
	"scope",
	"issuer",
	"organizer",
	"title",
	"subtitle",
]);

// Only selection items of these source types may be sent to the AI provider. Photos and references
// are never sent, and a source type added in the future stays out until it is listed here (fail closed).
export const AI_ALLOWED_SELECTION_SOURCE_TYPES: ReadonlySet<string> = new Set<CvmateSelectionSourceType>([
	"employment",
	"experience_fact",
	"project",
	"education",
	"course",
	"certification",
	"volunteer",
	"language",
	"award",
	"license",
	"profile_list_item",
	"clause",
	"custom_section_item",
]);

export function isAiAllowedSelectionSourceType(sourceType: string): boolean {
	return AI_ALLOWED_SELECTION_SOURCE_TYPES.has(sourceType);
}

// Every allowed field is a text, boolean or number column of the Master Profile. A nested object or
// array under an allowed key could carry unlisted fields or IDs, so it is dropped (fail closed).
function isAiAllowedSourceDataValue(value: unknown): boolean {
	return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function compactSourceDataForAi(value: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(value).filter(
			([key, item]) => AI_ALLOWED_SOURCE_DATA_KEYS.has(key) && isAiAllowedSourceDataValue(item),
		),
	);
}
