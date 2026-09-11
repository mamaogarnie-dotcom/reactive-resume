import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { FileTextIcon } from "@phosphor-icons/react";
import { Button } from "@reactive-resume/ui/components/button";
import { Separator } from "@reactive-resume/ui/components/separator";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/cvmate/create")({
	component: RouteComponent,
});

const textareaClassName =
	"min-h-56 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

const fileClassName =
	"block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm disabled:cursor-not-allowed disabled:opacity-50";

type RequirementCategory =
	| "required"
	| "preferred"
	| "responsibility"
	| "keyword"
	| "other";
type SelectionItem = Awaited<
	ReturnType<typeof orpc.cvmateBuild.listSelectionItems.call>
>[number];
type Gap = Awaited<ReturnType<typeof orpc.cvmateBuild.listGaps.call>>[number];

const categoryTitle: Record<RequirementCategory, string> = {
	required: "Most important requirements",
	preferred: "Nice to have",
	responsibility: "Responsibilities",
	keyword: "Important keywords",
	other: "Other",
};

function selectionLabel(item: SelectionItem) {
	return (
		item.sourceTextSnapshot?.trim() || item.sourceType.replaceAll("_", " ")
	);
}

function RouteComponent() {
	const [rawText, setRawText] = useState("");
	const [asset, setAsset] = useState<File | null>(null);
	const [buildId, setBuildId] = useState<string | null>(null);
	const [selectionItems, setSelectionItems] = useState<SelectionItem[]>([]);
	const [gaps, setGaps] = useState<Gap[]>([]);

	const analyzeOffer = useMutation({
		mutationFn: async () => {
			const text = rawText.trim();
			const id = await orpc.cvmateJobOffer.create.call(
				text.length > 0 ? { rawText: text } : {},
			);

			let cleanupOnFailure = true;

			try {
				if (asset) {
					await orpc.cvmateJobOffer.uploadAsset.call({
						jobOfferId: id,
						file: asset,
					});
				}

				cleanupOnFailure = false;
				return await orpc.cvmateJobOffer.analyze.call({ id });
			} catch (error) {
				if (cleanupOnFailure) {
					await orpc.cvmateJobOffer.delete.call({ id }).catch(() => undefined);
				}
				throw error;
			}
		},
	});

	const recommendContent = useMutation({
		mutationFn: async () => {
			if (!analyzeOffer.data)
				throw new Error("Analyze the job offer before creating a CV.");

			let id = buildId;

			if (!id) {
				id = await orpc.cvmateBuild.create.call({
					jobOfferId: analyzeOffer.data.id,
					targetLanguage: analyzeOffer.data.language,
				});
				setBuildId(id);
			}

			const initialItems = await orpc.cvmateBuild.listSelectionItems.call({
				cvBuildId: id,
			});
			setSelectionItems(initialItems);

			if (initialItems.length === 0) {
				throw new Error(
					"Your Master Profile does not contain any content that can be selected for this CV.",
				);
			}

			const result = await orpc.cvmateBuild.generateRecommendations.call({
				id,
			});
			return { id, ...result };
		},
		onSuccess: (result) => {
			setSelectionItems(result.selectionItems);
			setGaps(result.gaps);
		},
	});

	const updateSelection = useMutation({
		mutationFn: async (input: { item: SelectionItem; selected: boolean }) => {
			const updated: SelectionItem[] = [];

			if (input.selected && input.item.parentSelectionItemId) {
				const parent = selectionItems.find(
					(item) => item.id === input.item.parentSelectionItemId,
				);
				if (parent && !parent.selected) {
					updated.push(
						await orpc.cvmateBuild.updateSelectionItem.call({
							id: parent.id,
							selected: true,
						}),
					);
				}
			}

			if (!input.selected && input.item.parentSelectionItemId === null) {
				for (const child of selectionItems.filter(
					(item) =>
						item.parentSelectionItemId === input.item.id && item.selected,
				)) {
					updated.push(
						await orpc.cvmateBuild.updateSelectionItem.call({
							id: child.id,
							selected: false,
						}),
					);
				}
			}

			updated.push(
				await orpc.cvmateBuild.updateSelectionItem.call({
					id: input.item.id,
					selected: input.selected,
				}),
			);

			return updated;
		},
		onSuccess: (updatedItems) => {
			const updates = new Map(
				updatedItems.map((item) => [item.id, item] as const),
			);
			setSelectionItems((items) =>
				items.map((item) => updates.get(item.id) ?? item),
			);
		},
	});

	const selectRecommended = useMutation({
		mutationFn: async () => {
			const targets = selectionItems.filter(
				(item) => item.recommended && !item.selected,
			);
			return Promise.all(
				targets.map((item) =>
					orpc.cvmateBuild.updateSelectionItem.call({
						id: item.id,
						selected: true,
					}),
				),
			);
		},
		onSuccess: (updatedItems) => {
			const updates = new Map(
				updatedItems.map((item) => [item.id, item] as const),
			);
			setSelectionItems((items) =>
				items.map((item) => updates.get(item.id) ?? item),
			);
		},
	});

	const dismissGap = useMutation({
		mutationFn: (id: string) =>
			orpc.cvmateBuild.updateGap.call({ id, status: "dismissed" }),
		onSuccess: (updated) => {
			setGaps((items) =>
				items.map((item) => (item.id === updated.id ? updated : item)),
			);
		},
	});

	const groupedRequirements = useMemo(() => {
		const initial: Record<
			RequirementCategory,
			NonNullable<typeof analyzeOffer.data>["requirements"]
		> = {
			required: [],
			preferred: [],
			responsibility: [],
			keyword: [],
			other: [],
		};

		for (const requirement of analyzeOffer.data?.requirements ?? []) {
			initial[requirement.category].push(requirement);
		}

		return initial;
	}, [analyzeOffer.data]);

	const childrenByParent = useMemo(() => {
		const map = new Map<string, SelectionItem[]>();

		for (const item of selectionItems) {
			if (!item.parentSelectionItemId) continue;
			const children = map.get(item.parentSelectionItemId) ?? [];
			children.push(item);
			map.set(item.parentSelectionItemId, children);
		}

		return map;
	}, [selectionItems]);

	const rootSelectionItems = selectionItems.filter(
		(item) => item.parentSelectionItemId === null,
	);
	const selectedCount = selectionItems.filter((item) => item.selected).length;
	const recommendedCount = selectionItems.filter(
		(item) => item.recommended,
	).length;
	const openGaps = gaps.filter((gap) => gap.status === "open");

	const canAnalyze = rawText.trim().length > 0 || asset !== null;
	const selectionPending =
		updateSelection.isPending || selectRecommended.isPending;

	const reset = () => {
		setRawText("");
		setAsset(null);
		setBuildId(null);
		setSelectionItems([]);
		setGaps([]);
		analyzeOffer.reset();
		recommendContent.reset();
		updateSelection.reset();
		selectRecommended.reset();
		dismissGap.reset();
	};

	const renderSelectionItem = (item: SelectionItem, nested = false) => (
		<div
			key={item.id}
			className={`rounded-md border p-3 ${nested ? "ml-6 border-dashed" : ""}`}
		>
			<div className="flex items-start gap-3">
				<input
					type="checkbox"
					className="mt-1 size-4 shrink-0"
					checked={item.selected}
					disabled={selectionPending}
					onChange={(event) =>
						updateSelection.mutate({
							item,
							selected: event.target.checked,
						})
					}
				/>
				<div className="min-w-0 flex-1 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm">{selectionLabel(item)}</span>
						<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
							{item.sourceType.replaceAll("_", " ")}
						</span>
						{item.recommended ? (
							<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-xs">
								<Trans>Recommended</Trans>
							</span>
						) : null}
					</div>
					{item.recommendationReason ? (
						<p className="text-muted-foreground text-xs">
							{item.recommendationReason}
						</p>
					) : null}
				</div>
			</div>
		</div>
	);

	return (
		<div className="space-y-4">
			<DashboardHeader icon={FileTextIcon} title={t`Create CV`} />

			<Separator />

			<div className="mx-auto max-w-5xl space-y-6">
				<div className="space-y-1">
					<h2 className="font-medium text-lg">
						<Trans>Job offer</Trans>
					</h2>
					<p className="text-muted-foreground text-sm">
						<Trans>
							Paste the job offer or attach a PDF/image. CVMate will analyze it
							before building your tailored CV.
						</Trans>
					</p>
				</div>

				{!analyzeOffer.data ? (
					<form
						className="space-y-5 rounded-lg border p-5"
						onSubmit={(event) => {
							event.preventDefault();
							if (canAnalyze) analyzeOffer.mutate();
						}}
					>
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="cvmate-job-offer-text"
							>
								<Trans>Paste job offer</Trans>
							</label>
							<textarea
								id="cvmate-job-offer-text"
								className={textareaClassName}
								placeholder={t`Paste the complete job offer here...`}
								value={rawText}
								disabled={analyzeOffer.isPending}
								onChange={(event) => setRawText(event.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="cvmate-job-offer-file"
							>
								<Trans>Or attach a file</Trans>
							</label>
							<input
								id="cvmate-job-offer-file"
								type="file"
								className={fileClassName}
								accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
								disabled={analyzeOffer.isPending}
								onChange={(event) => setAsset(event.target.files?.[0] ?? null)}
							/>
							<p className="text-muted-foreground text-xs">
								<Trans>PDF, JPEG, PNG, WebP or GIF, up to 10 MB.</Trans>
							</p>
						</div>

						{analyzeOffer.isError ? (
							<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
								{analyzeOffer.error instanceof Error
									? analyzeOffer.error.message
									: t`The job offer could not be analyzed.`}
							</div>
						) : null}

						<div className="flex justify-end">
							<Button
								type="submit"
								disabled={!canAnalyze || analyzeOffer.isPending}
							>
								{analyzeOffer.isPending ? (
									<Trans>Analyzing...</Trans>
								) : (
									<Trans>Save and analyze</Trans>
								)}
							</Button>
						</div>
					</form>
				) : (
					<div className="space-y-6">
						<div className="rounded-lg border p-5">
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div className="space-y-1">
									<h3 className="font-medium text-base">
										{analyzeOffer.data.roleTitle ?? t`Analyzed job offer`}
									</h3>
									<p className="text-muted-foreground text-sm">
										{[analyzeOffer.data.companyName, analyzeOffer.data.location]
											.filter(Boolean)
											.join(" · ") || t`Analysis completed`}
									</p>
								</div>
								<Button type="button" variant="outline" onClick={reset}>
									<Trans>Analyze another offer</Trans>
								</Button>
							</div>
						</div>

						<div className="grid gap-4 lg:grid-cols-2">
							{(
								[
									"required",
									"preferred",
									"responsibility",
									"keyword",
									"other",
								] as RequirementCategory[]
							).map((category) => {
								const requirements = groupedRequirements[category];
								if (requirements.length === 0) return null;

								return (
									<section key={category} className="rounded-lg border p-5">
										<div className="mb-3 flex items-center justify-between gap-3">
											<h3 className="font-medium text-sm">
												{categoryTitle[category]}
											</h3>
											<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
												{requirements.length}
											</span>
										</div>
										<ul className="space-y-2">
											{requirements.map((requirement) => (
												<li
													key={requirement.id}
													className="rounded-md bg-muted/40 px-3 py-2 text-sm"
												>
													<div className="flex items-start justify-between gap-3">
														<span>{requirement.text}</span>
														<span className="shrink-0 text-muted-foreground text-xs">
															{requirement.priority}
														</span>
													</div>
												</li>
											))}
										</ul>
									</section>
								);
							})}
						</div>

						{analyzeOffer.data.requirements.length === 0 ? (
							<div className="rounded-lg border p-5 text-muted-foreground text-sm">
								<Trans>
									Analysis completed, but no structured requirements were
									extracted.
								</Trans>
							</div>
						) : null}

						{selectionItems.length === 0 ? (
							<div className="rounded-lg border p-5">
								<div className="space-y-1">
									<h3 className="font-medium">
										<Trans>Match your Master Profile</Trans>
									</h3>
									<p className="text-muted-foreground text-sm">
										<Trans>
											Create a CV build from your Master Profile and let AI
											recommend only facts already stored there.
										</Trans>
									</p>
								</div>

								{recommendContent.isError ? (
									<div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
										{recommendContent.error instanceof Error
											? recommendContent.error.message
											: t`Recommendations could not be generated.`}
									</div>
								) : null}

								<div className="mt-4 flex justify-end">
									<Button
										type="button"
										disabled={recommendContent.isPending}
										onClick={() => recommendContent.mutate()}
									>
										{recommendContent.isPending ? (
											<Trans>Matching profile...</Trans>
										) : buildId ? (
											<Trans>Retry AI recommendations</Trans>
										) : (
											<Trans>Match Master Profile</Trans>
										)}
									</Button>
								</div>
							</div>
						) : (
							<>
								<section className="space-y-4 rounded-lg border p-5">
									<div className="flex flex-wrap items-start justify-between gap-4">
										<div className="space-y-1">
											<h3 className="font-medium">
												<Trans>Choose CV content</Trans>
											</h3>
											<p className="text-muted-foreground text-sm">
												<Trans>
													AI recommendations are suggestions only. You decide
													what is included in the final CV.
												</Trans>
											</p>
										</div>
										<div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
											<span className="rounded-full bg-muted px-2 py-1">
												{recommendedCount} <Trans>recommended</Trans>
											</span>
											<span className="rounded-full bg-muted px-2 py-1">
												{selectedCount} <Trans>selected</Trans>
											</span>
										</div>
									</div>

									{recommendContent.isError ? (
										<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
											<div>
												{recommendContent.error instanceof Error
													? recommendContent.error.message
													: t`AI recommendations could not be generated. You can still select content manually.`}
											</div>
											<Button
												type="button"
												variant="outline"
												className="mt-3"
												disabled={recommendContent.isPending}
												onClick={() => recommendContent.mutate()}
											>
												<Trans>Retry AI recommendations</Trans>
											</Button>
										</div>
									) : null}

									{recommendedCount > 0 ? (
										<div className="flex justify-end">
											<Button
												type="button"
												variant="outline"
												disabled={selectionPending}
												onClick={() => selectRecommended.mutate()}
											>
												{selectRecommended.isPending ? (
													<Trans>Selecting...</Trans>
												) : (
													<Trans>Select all recommended</Trans>
												)}
											</Button>
										</div>
									) : null}

									<div className="space-y-3">
										{rootSelectionItems.map((item) => (
											<div key={item.id} className="space-y-2">
												{renderSelectionItem(item)}
												{(childrenByParent.get(item.id) ?? []).map((child) =>
													renderSelectionItem(child, true),
												)}
											</div>
										))}
									</div>
								</section>

								<section className="space-y-4 rounded-lg border p-5">
									<div className="space-y-1">
										<h3 className="font-medium">
											<Trans>Gaps</Trans>
										</h3>
										<p className="text-muted-foreground text-sm">
											<Trans>
												These are required or preferred job requirements for
												which CVMate found no direct evidence in your Master
												Profile.
											</Trans>
										</p>
									</div>

									{openGaps.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											<Trans>No open gaps detected.</Trans>
										</p>
									) : (
										<div className="space-y-2">
											{openGaps.map((gap) => (
												<div
													key={gap.id}
													className="flex items-start justify-between gap-4 rounded-md bg-muted/40 p-3"
												>
													<div className="space-y-1">
														<p className="text-sm">{gap.text}</p>
														<p className="text-muted-foreground text-xs">
															{gap.severity} · {gap.origin}
														</p>
													</div>
													<Button
														type="button"
														variant="outline"
														disabled={dismissGap.isPending}
														onClick={() => dismissGap.mutate(gap.id)}
													>
														<Trans>Dismiss</Trans>
													</Button>
												</div>
											))}
										</div>
									)}
								</section>

								<div className="flex justify-end">
									<Button type="button" disabled={selectedCount === 0}>
										<Trans>Continue to tailored content</Trans>
									</Button>
								</div>
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
