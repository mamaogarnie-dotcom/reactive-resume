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

export function compactSourceDataForAi(value: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([key]) => AI_ALLOWED_SOURCE_DATA_KEYS.has(key)));
}
