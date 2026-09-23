export type ActiveDraftSort = "lastUpdatedAt" | "createdAt" | "name";

export type ActiveDraftBuild = {
	id: string;
	status: string;
	jobOfferSnapshot: Record<string, unknown> | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ActiveDraftDocument = {
	cvBuildId: string | null;
};

export type ActiveDraftRow<TBuild extends ActiveDraftBuild = ActiveDraftBuild> = {
	build: TBuild;
	name: string;
};

function snapshotText(snapshot: Record<string, unknown> | null, key: string): string {
	const value = snapshot?.[key];
	return typeof value === "string" ? value.trim() : "";
}

export function activeDraftName(snapshot: Record<string, unknown> | null): string {
	const roleTitle = snapshotText(snapshot, "roleTitle");
	const companyName = snapshotText(snapshot, "companyName");

	if (roleTitle && companyName) return `${roleTitle} - ${companyName}`;
	return roleTitle || companyName || "1story CV";
}

export function selectActiveDrafts<TBuild extends ActiveDraftBuild>({
	builds,
	documents,
	tab,
	search,
	tags,
	sort,
}: {
	builds: TBuild[];
	documents: ActiveDraftDocument[];
	tab: "all" | "ready" | "draft" | "favorites" | "trash";
	search: string;
	tags: string[];
	sort: ActiveDraftSort;
}): ActiveDraftRow<TBuild>[] {
	if (tab !== "all" && tab !== "draft") return [];
	if (tags.length > 0) return [];

	const materializedBuildIds = new Set(
		documents.flatMap((document) => (document.cvBuildId === null ? [] : [document.cvBuildId])),
	);
	const query = search.trim().toLowerCase();

	const rows = builds
		.filter((build) => build.status === "active" && !materializedBuildIds.has(build.id))
		.map((build) => ({ build, name: activeDraftName(build.jobOfferSnapshot) }))
		.filter(({ name }) => query.length === 0 || name.toLowerCase().includes(query));

	return rows.sort((left, right) => {
		if (sort === "name") return left.name.localeCompare(right.name);
		if (sort === "createdAt") return right.build.createdAt.getTime() - left.build.createdAt.getTime();
		return right.build.updatedAt.getTime() - left.build.updatedAt.getTime();
	});
}