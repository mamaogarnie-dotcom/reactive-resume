import { describe, expect, it } from "vitest";
import { cvmateCreateSearchSchema, parseResumableJobOffer, resumeRouteGuardState, resumeStepTargetId, shouldRestoreBuildPreview, shouldWarnMissingEducation } from "./create-resume";

describe("cvmateCreateSearchSchema", () => {
	it("accepts no buildId or a non-empty buildId", () => {
		expect(cvmateCreateSearchSchema.parse({})).toEqual({});
		expect(cvmateCreateSearchSchema.parse({ buildId: "build-1" })).toEqual({ buildId: "build-1" });
	});

	it("rejects an empty buildId", () => {
		expect(() => cvmateCreateSearchSchema.parse({ buildId: "   " })).toThrow();
	});
});

describe("parseResumableJobOffer", () => {
	it("restores durable offer data used by the CV creation UI", () => {
		expect(parseResumableJobOffer({
			id: "offer-1",
			roleTitle: "Operations Manager",
			companyName: "Example",
			location: "Wroclaw",
			language: "pl",
			requirements: [{
				id: "req-1",
				category: "required",
				priority: "critical",
				sourceText: "Microsoft Office",
				text: "Microsoft Office",
			}],
		})).toEqual({
			id: "offer-1",
			roleTitle: "Operations Manager",
			companyName: "Example",
			location: "Wroclaw",
			language: "pl",
			requirements: [{
				id: "req-1",
				category: "required",
				priority: "critical",
				sourceText: "Microsoft Office",
				text: "Microsoft Office",
			}],
		});
	});

	it("accepts a saved offer with zero requirements", () => {
		expect(parseResumableJobOffer({
			id: "offer-2",
			roleTitle: null,
			companyName: null,
			location: null,
			language: "en",
			requirements: [],
		})).toEqual({
			id: "offer-2",
			roleTitle: null,
			companyName: null,
			location: null,
			language: "en",
			requirements: [],
		});
	});

	it("rejects malformed frozen snapshots", () => {
		expect(parseResumableJobOffer(null)).toBeNull();
		expect(parseResumableJobOffer({ id: "offer-1" })).toBeNull();
		expect(parseResumableJobOffer({ id: "offer-1", requirements: [{
			id: "req-1",
			category: "unexpected",
			priority: "critical",
			sourceText: null,
			text: "Requirement",
		}] })).toBeNull();
	});
});
describe("resumeStepTargetId", () => {
	it("maps persisted build steps to stable resume anchors", () => {
		expect(resumeStepTargetId("selection")).toBe("cvmate-step-selection");
		expect(resumeStepTargetId("gaps")).toBe("cvmate-step-gaps");
		expect(resumeStepTargetId("review")).toBe("cvmate-step-review");
		expect(resumeStepTargetId("preview")).toBe("cvmate-step-preview");
		expect(resumeStepTargetId("editor")).toBe("cvmate-step-preview");
		expect(resumeStepTargetId("offer")).toBe("cvmate-step-selection");
		expect(resumeStepTargetId("analysis")).toBe("cvmate-step-selection");
	});
});
describe("shouldRestoreBuildPreview", () => {
	it("reconstructs only persisted steps that require transient preview state", () => {
		expect(shouldRestoreBuildPreview("preview")).toBe(true);
		expect(shouldRestoreBuildPreview("editor")).toBe(true);
		expect(shouldRestoreBuildPreview("review")).toBe(false);
		expect(shouldRestoreBuildPreview("gaps")).toBe(false);
		expect(shouldRestoreBuildPreview("selection")).toBe(false);
	});
});
describe("resumeRouteGuardState", () => {
	it("blocks the creation form before hydration starts and while the matching build is loading", () => {
		expect(
			resumeRouteGuardState({
				searchBuildId: "build-1",
				localBuildId: null,
				previousSearchBuildId: "build-1",
				restoreAttemptId: undefined,
				restoreIsError: false,
			}),
		).toBe("loading");
	});

	it("shows an error only for the current build restore attempt", () => {
		expect(
			resumeRouteGuardState({
				searchBuildId: "build-2",
				localBuildId: null,
				previousSearchBuildId: "build-1",
				restoreAttemptId: "build-2",
				restoreIsError: true,
			}),
		).toBe("error");

		expect(
			resumeRouteGuardState({
				searchBuildId: "build-2",
				localBuildId: null,
				previousSearchBuildId: "build-1",
				restoreAttemptId: "build-1",
				restoreIsError: true,
			}),
		).toBe("loading");
	});

	it("marks URL removal as a clearing transition but leaves a fresh create route idle", () => {
		expect(
			resumeRouteGuardState({
				searchBuildId: undefined,
				localBuildId: "build-1",
				previousSearchBuildId: "build-1",
				restoreAttemptId: "build-1",
				restoreIsError: false,
			}),
		).toBe("clearing");

		expect(
			resumeRouteGuardState({
				searchBuildId: undefined,
				localBuildId: null,
				previousSearchBuildId: undefined,
				restoreAttemptId: undefined,
				restoreIsError: false,
			}),
		).toBe("idle");
	});

	it("marks the route ready only when local state matches the canonical buildId", () => {
		expect(
			resumeRouteGuardState({
				searchBuildId: "build-1",
				localBuildId: "build-1",
				previousSearchBuildId: "build-1",
				restoreAttemptId: "build-1",
				restoreIsError: false,
			}),
		).toBe("ready");
	});
});
describe("shouldWarnMissingEducation", () => {
	it("does not warn when the build has no education candidates", () => {
		expect(shouldWarnMissingEducation([{ sourceType: "project", selected: true }])).toBe(false);
	});

	it("warns when education exists but none is selected", () => {
		expect(
			shouldWarnMissingEducation([
				{ sourceType: "education", selected: false },
				{ sourceType: "project", selected: true },
			]),
		).toBe(true);
	});

	it("does not warn when at least one education record is selected", () => {
		expect(
			shouldWarnMissingEducation([
				{ sourceType: "education", selected: false },
				{ sourceType: "education", selected: true },
			]),
		).toBe(false);
	});
});
