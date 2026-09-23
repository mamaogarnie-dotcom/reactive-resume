import { z } from "zod";

export const cvmateCreateSearchSchema = z.object({
	buildId: z.string().trim().min(1).optional(),
});

export type ResumableRequirement = {
	id: string;
	category: "required" | "preferred" | "responsibility" | "keyword" | "other";
	priority: "critical" | "important" | "additional";
	sourceText: string | null;
	text: string;
};

export type ResumableJobOffer = {
	id: string;
	roleTitle: string | null;
	companyName: string | null;
	location: string | null;
	language: string | null;
	requirements: ResumableRequirement[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function nullableString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

const requirementCategories = new Set(["required", "preferred", "responsibility", "keyword", "other"]);
const requirementPriorities = new Set(["critical", "important", "additional"]);

function parseRequirement(value: unknown): ResumableRequirement | null {
	const record = asRecord(value);
	if (!record) return null;

	if (
		typeof record.id !== "string" ||
		typeof record.category !== "string" ||
		!requirementCategories.has(record.category) ||
		typeof record.priority !== "string" ||
		!requirementPriorities.has(record.priority) ||
		typeof record.text !== "string" ||
		record.text.trim().length === 0
	) {
		return null;
	}

	return {
		id: record.id,
		category: record.category as ResumableRequirement["category"],
		priority: record.priority as ResumableRequirement["priority"],
		sourceText: nullableString(record.sourceText),
		text: record.text,
	};
}

export function parseResumableJobOffer(snapshot: unknown): ResumableJobOffer | null {
	const record = asRecord(snapshot);
	if (!record) return null;

	if (typeof record.id !== "string" || record.id.trim().length === 0) return null;
	if (!Array.isArray(record.requirements)) return null;

	const requirements: ResumableRequirement[] = [];

	for (const value of record.requirements) {
		const requirement = parseRequirement(value);
		if (!requirement) return null;
		requirements.push(requirement);
	}

	return {
		id: record.id,
		roleTitle: nullableString(record.roleTitle),
		companyName: nullableString(record.companyName),
		location: nullableString(record.location),
		language: nullableString(record.language),
		requirements,
	};
}
export type CvmateResumeStep =
	| "offer"
	| "analysis"
	| "selection"
	| "gaps"
	| "preview"
	| "editor"
	| "review"
	| "completed";

export function resumeStepTargetId(step: CvmateResumeStep): string {
	switch (step) {
		case "gaps":
			return "cvmate-step-gaps";
		case "review":
			return "cvmate-step-review";
		case "preview":
		case "editor":
		case "completed":
			return "cvmate-step-preview";
		case "offer":
		case "analysis":
		case "selection":
		default:
			return "cvmate-step-selection";
	}
}

export function shouldRestoreBuildPreview(step: CvmateResumeStep): boolean { 	return step === "preview" || step === "editor"; }

export type ResumeRouteGuardState = "idle" | "loading" | "error" | "ready" | "clearing";

export function resumeRouteGuardState({
	searchBuildId,
	localBuildId,
	previousSearchBuildId,
	restoreAttemptId,
	restoreIsError,
}: {
	searchBuildId: string | undefined;
	localBuildId: string | null;
	previousSearchBuildId: string | undefined;
	restoreAttemptId: string | undefined;
	restoreIsError: boolean;
}): ResumeRouteGuardState {
	if (!searchBuildId) return previousSearchBuildId === undefined ? "idle" : "clearing";
	if (localBuildId === searchBuildId) return "ready";
	if (restoreIsError && restoreAttemptId === searchBuildId) return "error";
	return "loading";
}
export function shouldWarnMissingEducation(
	selectionItems: readonly { sourceType: string; selected: boolean }[],
): boolean {
	const educationItems = selectionItems.filter((item) => item.sourceType === "education");
	return educationItems.length > 0 && !educationItems.some((item) => item.selected);
}
