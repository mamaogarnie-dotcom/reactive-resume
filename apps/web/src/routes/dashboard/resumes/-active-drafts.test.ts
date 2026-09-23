import { describe, expect, it } from "vitest";
import { activeDraftName, selectActiveDrafts, type ActiveDraftBuild } from "./-active-drafts";

function build(
	id: string,
	status: string,
	roleTitle: string | null,
	companyName: string | null,
	createdAt: string,
	updatedAt: string,
): ActiveDraftBuild {
	return {
		id,
		status,
		jobOfferSnapshot:
			roleTitle === null && companyName === null
				? null
				: { roleTitle, companyName },
		createdAt: new Date(createdAt),
		updatedAt: new Date(updatedAt),
	};
}

describe("activeDraftName", () => {
	it("uses the same offer-based naming fallback as materialization", () => {
		expect(activeDraftName({ roleTitle: "Office Manager", companyName: "Acme" })).toBe("Office Manager - Acme");
		expect(activeDraftName({ roleTitle: "Office Manager" })).toBe("Office Manager");
		expect(activeDraftName({ companyName: "Acme" })).toBe("Acme");
		expect(activeDraftName(null)).toBe("1story CV");
	});
});

describe("selectActiveDrafts", () => {
	const builds = [
		build("active-new", "active", "New role", "New company", "2026-09-22T08:00:00Z", "2026-09-22T12:00:00Z"),
		build("active-old", "active", "Old role", "Old company", "2026-09-20T08:00:00Z", "2026-09-20T12:00:00Z"),
		build("materialized", "active", "Materialized", "Company", "2026-09-21T08:00:00Z", "2026-09-21T12:00:00Z"),
		build("completed", "completed", "Completed", "Company", "2026-09-19T08:00:00Z", "2026-09-19T12:00:00Z"),
		build("abandoned", "abandoned", "Abandoned", "Company", "2026-09-18T08:00:00Z", "2026-09-18T12:00:00Z"),
	];
	const documents = [{ cvBuildId: "materialized" }, { cvBuildId: null }];

	it("returns only active non-materialized builds for All and Drafts", () => {
		const common = { builds, documents, search: "", tags: [], sort: "lastUpdatedAt" as const };

		expect(selectActiveDrafts({ ...common, tab: "all" }).map(({ build }) => build.id)).toEqual([
			"active-new",
			"active-old",
		]);
		expect(selectActiveDrafts({ ...common, tab: "draft" }).map(({ build }) => build.id)).toEqual([
			"active-new",
			"active-old",
		]);
		expect(selectActiveDrafts({ ...common, tab: "ready" })).toEqual([]);
		expect(selectActiveDrafts({ ...common, tab: "favorites" })).toEqual([]);
		expect(selectActiveDrafts({ ...common, tab: "trash" })).toEqual([]);
	});

	it("honors search and hides build drafts when a resume-tag filter is active", () => {
		expect(
			selectActiveDrafts({
				builds,
				documents,
				tab: "all",
				search: "old company",
				tags: [],
				sort: "lastUpdatedAt",
			}).map(({ build }) => build.id),
		).toEqual(["active-old"]);

		expect(
			selectActiveDrafts({
				builds,
				documents,
				tab: "all",
				search: "",
				tags: ["tagged"],
				sort: "lastUpdatedAt",
			}),
		).toEqual([]);
	});

	it("sorts active drafts by name, created date, or last update", () => {
		const common = { builds, documents, tab: "all" as const, search: "", tags: [] };

		expect(selectActiveDrafts({ ...common, sort: "name" }).map(({ build }) => build.id)).toEqual([
			"active-new",
			"active-old",
		]);
		expect(selectActiveDrafts({ ...common, sort: "createdAt" }).map(({ build }) => build.id)).toEqual([
			"active-new",
			"active-old",
		]);
		expect(selectActiveDrafts({ ...common, sort: "lastUpdatedAt" }).map(({ build }) => build.id)).toEqual([
			"active-new",
			"active-old",
		]);
	});
});