import { msg, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
	MagnifyingGlassIcon,
	PlusIcon,
	ReadCvLogoIcon,
} from "@phosphor-icons/react";
import { Button } from "@reactive-resume/ui/components/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@reactive-resume/ui/components/input-group";
import { Label } from "@reactive-resume/ui/components/label";
import { Separator } from "@reactive-resume/ui/components/separator";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@reactive-resume/ui/components/tabs";
import { toast } from "@reactive-resume/ui/components/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import { useMemo } from "react";
import z from "zod";
import { Combobox } from "@/components/ui/combobox";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

type SortOption = "lastUpdatedAt" | "createdAt" | "name";
const tabSchema = z.enum(["all", "ready", "draft", "favorites", "trash"]);

const searchSchema = z.object({
	search: z.string().default(""),
	tags: z.array(z.string()).default([]),
	sort: z.enum(["lastUpdatedAt", "createdAt", "name"]).default("lastUpdatedAt"),
	tab: tabSchema.default("all"),
});

type Search = z.output<typeof searchSchema>;

const defaultSearch: Search = {
	search: "",
	tags: [],
	sort: "lastUpdatedAt",
	tab: "all",
};

export const Route = createFileRoute("/dashboard/resumes/")({
	component: RouteComponent,
	validateSearch: searchSchema,
	search: {
		middlewares: [stripSearchParams(defaultSearch)],
	},
});

function RouteComponent() {
	const { i18n } = useLingui();
	const { search, tags, sort, tab } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const queryClient = useQueryClient();

	const { data: allTags } = useQuery(orpc.resume.tags.list.queryOptions());
	const { data: resumes, isLoading: resumesLoading } = useQuery(
		orpc.resume.list.queryOptions({ input: { tags, sort } }),
	);
	const { data: documents, isLoading: documentsLoading } = useQuery(
		orpc.cvmateBuild.listDocuments.queryOptions(),
	);

	const updateDocumentMutation = useMutation({
		mutationFn: (input: {
			id: string;
			status?: "draft" | "ready";
			isFavorite?: boolean;
			trashed?: boolean;
		}) => orpc.cvmateBuild.updateDocument.call(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.cvmateBuild.listDocuments.queryKey(),
			});
		},
		onError: (error) => {
			toast.add({
				type: "error",
				description: getOrpcErrorMessage(error, {
					fallback: t`Could not update this CV.`,
				}),
			});
		},
	});

	const rows = useMemo(() => {
		const documentByResumeId = new Map(
			(documents ?? []).map((document) => [document.resumeId, document]),
		);
		const query = search.trim().toLowerCase();

		return (resumes ?? [])
			.flatMap((resume) => {
				const document = documentByResumeId.get(resume.id);
				return document ? [{ resume, document }] : [];
			})
			.filter(({ resume, document }) => {
				const isTrashed = document.trashedAt !== null;

				const matchesTab =
					tab === "trash"
						? isTrashed
						: !isTrashed &&
							(tab === "all" ||
								(tab === "ready" && document.status === "ready") ||
								(tab === "draft" && document.status === "draft") ||
								(tab === "favorites" && document.isFavorite));

				if (!matchesTab) return false;
				if (!query) return true;

				return (
					resume.name.toLowerCase().includes(query) ||
					resume.slug.toLowerCase().includes(query)
				);
			});
	}, [documents, resumes, search, tab]);

	const counts = useMemo(() => {
		const list = documents ?? [];
		return {
			all: list.filter((document) => document.trashedAt === null).length,
			ready: list.filter(
				(document) =>
					document.trashedAt === null && document.status === "ready",
			).length,
			draft: list.filter(
				(document) =>
					document.trashedAt === null && document.status === "draft",
			).length,
			favorites: list.filter(
				(document) => document.trashedAt === null && document.isFavorite,
			).length,
			trash: list.filter((document) => document.trashedAt !== null).length,
		};
	}, [documents]);

	const tagOptions = useMemo(() => {
		if (!allTags) return [];
		return allTags.map((tag) => ({ value: tag, label: tag }));
	}, [allTags]);

	const sortOptions = useMemo(
		() => [
			{ value: "lastUpdatedAt", label: i18n.t(msg`Last Updated`) },
			{ value: "createdAt", label: i18n.t(msg`Created`) },
			{ value: "name", label: i18n.t(msg`Name`) },
		],
		[i18n],
	);

	const isLoading = resumesLoading || documentsLoading;

	return (
		<div className="space-y-4">
			<DashboardHeader
				icon={ReadCvLogoIcon}
				title={t`My CV`}
				actions={
					<Button
						size="sm"
						nativeButton={false}
						render={<Link to="/dashboard/cvmate/create" />}
					>
						<PlusIcon />
						<Trans>Create CV</Trans>
					</Button>
				}
			/>

			<Separator />

			<Tabs value={tab}>
				<TabsList className="h-auto w-full flex-wrap justify-start">
					<TabsTrigger
						value="all"
						nativeButton={false}
						render={
							<Link
								to="."
								search={(previous: Search) => ({ ...previous, tab: "all" })}
							/>
						}
					>
						<Trans>All</Trans>
						<span className="ms-1 text-muted-foreground text-xs">
							{counts.all}
						</span>
					</TabsTrigger>
					<TabsTrigger
						value="ready"
						nativeButton={false}
						render={
							<Link
								to="."
								search={(previous: Search) => ({ ...previous, tab: "ready" })}
							/>
						}
					>
						<Trans>Ready</Trans>
						<span className="ms-1 text-muted-foreground text-xs">
							{counts.ready}
						</span>
					</TabsTrigger>
					<TabsTrigger
						value="draft"
						nativeButton={false}
						render={
							<Link
								to="."
								search={(previous: Search) => ({ ...previous, tab: "draft" })}
							/>
						}
					>
						<Trans>Drafts</Trans>
						<span className="ms-1 text-muted-foreground text-xs">
							{counts.draft}
						</span>
					</TabsTrigger>
					<TabsTrigger
						value="favorites"
						nativeButton={false}
						render={
							<Link
								to="."
								search={(previous: Search) => ({
									...previous,
									tab: "favorites",
								})}
							/>
						}
					>
						<Trans>Favorites</Trans>
						<span className="ms-1 text-muted-foreground text-xs">
							{counts.favorites}
						</span>
					</TabsTrigger>
					<TabsTrigger
						value="trash"
						nativeButton={false}
						render={
							<Link
								to="."
								search={(previous: Search) => ({ ...previous, tab: "trash" })}
							/>
						}
					>
						<Trans>Trash</Trans>
						<span className="ms-1 text-muted-foreground text-xs">
							{counts.trash}
						</span>
					</TabsTrigger>
				</TabsList>
			</Tabs>

			<div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
				<div className="grid min-w-0 gap-1.5 sm:flex sm:items-center sm:gap-2">
					<Label className="text-muted-foreground text-xs sm:text-sm">
						<Trans>Sort by</Trans>
					</Label>
					<Combobox
						className="w-full sm:w-44"
						value={sort}
						options={sortOptions}
						placeholder={t`Sort by`}
						onValueChange={(value) => {
							if (!value) return;
							void navigate({
								search: (previous: Search) => ({
									...previous,
									sort: value as SortOption,
								}),
							});
						}}
					/>
				</div>

				{tagOptions.length > 0 ? (
					<div className="grid min-w-0 gap-1.5 sm:flex sm:items-center sm:gap-2">
						<Label className="text-muted-foreground text-xs sm:text-sm">
							<Trans>Filter by</Trans>
						</Label>
						<Combobox
							multiple
							className="w-full sm:w-44"
							value={tags}
							options={tagOptions}
							placeholder={t`Filter by`}
							onValueChange={(value) => {
								void navigate({
									search: (previous: Search) => ({
										...previous,
										tags: value ?? [],
									}),
								});
							}}
						/>
					</div>
				) : null}

				<InputGroup className="w-full sm:ms-auto sm:w-64">
					<InputGroupAddon align="inline-start">
						<MagnifyingGlassIcon />
					</InputGroupAddon>
					<InputGroupInput
						value={search}
						placeholder={t`Search CVs...`}
						onChange={(event) => {
							const value = event.target.value;
							void navigate({
								search: (previous: Search) => ({
									...previous,
									search: value,
								}),
							});
						}}
					/>
				</InputGroup>
			</div>

			{isLoading ? (
				<div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
					<Trans>Loading your CVs…</Trans>
				</div>
			) : rows.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center">
					<p className="font-medium">
						{tab === "trash" ? (
							<Trans>Trash is empty</Trans>
						) : (
							<Trans>No CVs in this view</Trans>
						)}
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						{tab === "all" ? (
							<Trans>
								Create a tailored CV from a job offer to see it here.
							</Trans>
						) : (
							<Trans>Change the filter or update one of your CVs.</Trans>
						)}
					</p>
				</div>
			) : (
				<div className="space-y-2">
					{rows.map(({ resume, document }) => {
						const isTrashed = document.trashedAt !== null;
						const isPending = updateDocumentMutation.isPending;

						return (
							<div
								key={document.id}
								className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center"
							>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<Link
											to="/builder/$resumeId"
											params={{ resumeId: resume.id }}
											className="truncate font-medium hover:underline"
										>
											{resume.name}
										</Link>

										<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
											{document.status === "ready" ? (
												<Trans>Ready</Trans>
											) : (
												<Trans>Draft</Trans>
											)}
										</span>

										{document.isFavorite ? (
											<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
												<Trans>Favorite</Trans>
											</span>
										) : null}
									</div>

									<p className="mt-1 text-muted-foreground text-xs">
										<Trans>Last updated</Trans>{" "}
										{Intl.DateTimeFormat(i18n.locale, {
											dateStyle: "medium",
											timeStyle: "short",
										}).format(document.updatedAt)}
									</p>
								</div>

								<div className="flex flex-wrap gap-2">
									{isTrashed ? (
										<Button
											size="sm"
											variant="outline"
											disabled={isPending}
											onClick={() =>
												updateDocumentMutation.mutate({
													id: document.id,
													trashed: false,
												})
											}
										>
											<Trans>Restore</Trans>
										</Button>
									) : (
										<>
											<Button
												size="sm"
												variant="outline"
												disabled={isPending}
												onClick={() =>
													updateDocumentMutation.mutate({
														id: document.id,
														isFavorite: !document.isFavorite,
													})
												}
											>
												{document.isFavorite ? (
													<Trans>Remove favorite</Trans>
												) : (
													<Trans>Add favorite</Trans>
												)}
											</Button>

											<Button
												size="sm"
												variant="outline"
												disabled={isPending}
												onClick={() =>
													updateDocumentMutation.mutate({
														id: document.id,
														status:
															document.status === "ready" ? "draft" : "ready",
													})
												}
											>
												{document.status === "ready" ? (
													<Trans>Mark draft</Trans>
												) : (
													<Trans>Mark ready</Trans>
												)}
											</Button>

											<Button
												size="sm"
												variant="outline"
												disabled={isPending}
												onClick={() =>
													updateDocumentMutation.mutate({
														id: document.id,
														trashed: true,
													})
												}
											>
												<Trans>Move to trash</Trans>
											</Button>
										</>
									)}

									<Button
										size="sm"
										disabled={isPending}
										nativeButton={false}
										render={
											<Link
												to="/builder/$resumeId"
												params={{ resumeId: resume.id }}
											/>
										}
									>
										<Trans>Open</Trans>
									</Button>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
