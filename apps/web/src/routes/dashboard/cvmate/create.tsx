import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { FileTextIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { resolveCvLanguage } from "@reactive-resume/utils/locale";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/cvmate/create")({
	component: RouteComponent,
});

type RequirementCategory = "required" | "preferred" | "responsibility" | "keyword" | "other";
type SelectionItem = Awaited<ReturnType<typeof orpc.cvmateBuild.listSelectionItems.call>>[number];
type Gap = Awaited<ReturnType<typeof orpc.cvmateBuild.listGaps.call>>[number];
type GeneratedContent = Awaited<ReturnType<typeof orpc.cvmateBuild.listGeneratedContent.call>>[number];
type GapEvidenceKind = "competency" | "software" | "tool" | "responsibility";

type GapEvidenceDraft = {
	kind: GapEvidenceKind;
	text: string;
	employmentSelectionItemId: string;
};

function categoryTitle(category: RequirementCategory) {
	switch (category) {
		case "required":
			return t`Most important requirements`;
		case "preferred":
			return t`Nice to have`;
		case "responsibility":
			return t`Responsibilities`;
		case "keyword":
			return t`Important keywords`;
		case "other":
			return t`Employer priorities`;
	}
}

function priorityLabel(priority: Gap["severity"]) {
	switch (priority) {
		case "critical":
			return t`Critical`;
		case "important":
			return t`Important`;
		case "additional":
			return t`Additional`;
	}
}

function gapOriginLabel(origin: Gap["origin"]) {
	switch (origin) {
		case "detected":
			return t`Detected`;
		case "user":
			return t`Added by you`;
	}
}

function sourceTypeLabel(sourceType: SelectionItem["sourceType"]) {
	switch (sourceType) {
		case "employment":
			return t`Employment`;
		case "experience_fact":
			return t`Experience fact`;
		case "project":
			return t`Project`;
		case "education":
			return t`Education`;
		case "course":
			return t`Course`;
		case "certification":
			return t`Certification`;
		case "volunteer":
			return t`Volunteer`;
		case "language":
			return t`Language`;
		case "award":
			return t`Award`;
		case "reference":
			return t`Reference`;
		case "license":
			return t`License`;
		case "profile_list_item":
			return t`Profile information`;
		case "clause":
			return t`Clause`;
		case "profile_photo":
			return t`Profile photo`;
		case "custom_section_item":
			return t`Custom section item`;
	}
}

function selectionLabel(item: SelectionItem) {
	return item.sourceTextSnapshot?.trim() || sourceTypeLabel(item.sourceType);
}

function RouteComponent() {
	const [rawText, setRawText] = useState("");
	const [asset, setAsset] = useState<File | null>(null);
	const [buildId, setBuildId] = useState<string | null>(null);
	const [selectionItems, setSelectionItems] = useState<SelectionItem[]>([]);
	const [gaps, setGaps] = useState<Gap[]>([]);
	const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
	const [quickFactTextByEmployment, setQuickFactTextByEmployment] = useState<Record<string, string>>({});
	const [gapEvidenceDrafts, setGapEvidenceDrafts] = useState<Record<string, GapEvidenceDraft>>({});

	const analyzeOffer = useMutation({
		mutationFn: async () => {
			const text = rawText.trim();
			const id = await orpc.cvmateJobOffer.create.call(text.length > 0 ? { rawText: text } : {});

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
			if (!analyzeOffer.data) throw new Error(t`Analyze the job offer before creating a CV.`);

			let id = buildId;

			if (!id) {
				id = await orpc.cvmateBuild.create.call({
					jobOfferId: analyzeOffer.data.id,
					targetLanguage: resolveCvLanguage(analyzeOffer.data.language),
				});
				setBuildId(id);
			}

			const initialItems = await orpc.cvmateBuild.listSelectionItems.call({
				cvBuildId: id,
			});
			setSelectionItems(initialItems);

			if (initialItems.length === 0) {
				throw new Error(t`Your Master Profile does not contain any content that can be selected for this CV.`);
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
				const parent = selectionItems.find((item) => item.id === input.item.parentSelectionItemId);
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
					(item) => item.parentSelectionItemId === input.item.id && item.selected,
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
			const updates = new Map(updatedItems.map((item) => [item.id, item] as const));
			setSelectionItems((items) => items.map((item) => updates.get(item.id) ?? item));
			setGeneratedContent([]);
		},
	});

	const quickAddResponsibility = useMutation({
		mutationFn: async (input: { employmentItem: SelectionItem; text: string }) => {
			if (!buildId) {
				throw new Error(t`Start creating the CV before generating tailored content.`);
			}

			if (input.employmentItem.sourceType !== "employment") {
				throw new Error("Invalid inline responsibility parent.");
			}

			const text = input.text.trim();

			if (!text) {
				throw new Error("Responsibility cannot be empty.");
			}

			const sortOrder =
				selectionItems
					.filter((item) => item.parentSelectionItemId === input.employmentItem.id)
					.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;

			let factId: string | null = null;
			let linked = false;
			let selectionItemId: string | null = null;
			let parentChanged = false;

			try {
				const fact = await orpc.cvmateProfile.createExperienceFact.call({
					text,
					kind: "responsibility",
				});

				factId = fact.id;

				await orpc.cvmateProfile.linkEmploymentFact.call({
					employmentId: input.employmentItem.sourceId,
					experienceFactId: fact.id,
					sortOrder,
				});

				linked = true;

				const createdChild = await orpc.cvmateBuild.createSelectionItem.call({
					cvBuildId: buildId,
					parentSelectionItemId: input.employmentItem.id,
					sourceType: "experience_fact",
					sourceId: fact.id,
					selected: false,
					sortOrder,
				});

				selectionItemId = createdChild.id;

				let parent = input.employmentItem;

				if (!parent.selected) {
					parent = await orpc.cvmateBuild.updateSelectionItem.call({
						id: parent.id,
						selected: true,
					});

					parentChanged = true;
				}

				const child = await orpc.cvmateBuild.updateSelectionItem.call({
					id: createdChild.id,
					selected: true,
				});

				return { child, parent };
			} catch (error) {
				if (selectionItemId) {
					await orpc.cvmateBuild.deleteSelectionItem.call({ id: selectionItemId }).catch(() => undefined);
				}

				if (parentChanged) {
					await orpc.cvmateBuild.updateSelectionItem
						.call({
							id: input.employmentItem.id,
							selected: false,
						})
						.catch(() => undefined);
				}

				if (linked && factId) {
					await orpc.cvmateProfile.unlinkEmploymentFact
						.call({
							employmentId: input.employmentItem.sourceId,
							experienceFactId: factId,
						})
						.catch(() => undefined);
				}

				if (factId) {
					await orpc.cvmateProfile.deleteExperienceFact.call({ id: factId }).catch(() => undefined);
				}

				throw error;
			}
		},
		onSuccess: ({ child, parent }, variables) => {
			setSelectionItems((items) => [...items.map((item) => (item.id === parent.id ? parent : item)), child]);

			setQuickFactTextByEmployment((current) => ({
				...current,
				[variables.employmentItem.id]: "",
			}));

			setGeneratedContent([]);
		},
	});
	const selectRecommended = useMutation({
		// biome-ignore lint/suspicious/useAwait: Preserve async rejection semantics for the mutation function.
		mutationFn: async () => {
			const targets = selectionItems.filter((item) => item.recommended && !item.selected);
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
			const updates = new Map(updatedItems.map((item) => [item.id, item] as const));
			setSelectionItems((items) => items.map((item) => updates.get(item.id) ?? item));
			setGeneratedContent([]);
		},
	});

	const resolveGapWithEvidence = useMutation({
		mutationFn: async (input: { gap: Gap; kind: GapEvidenceKind; text: string; employmentSelectionItemId: string }) => {
			if (!buildId) {
				throw new Error(t`Start creating the CV before generating tailored content.`);
			}

			const text = input.text.trim();

			if (!text) {
				throw new Error("Profile evidence cannot be empty.");
			}

			let factId: string | null = null;
			let listItemId: string | null = null;
			let linkedEmploymentId: string | null = null;
			let createdSelectionItem: SelectionItem | null = null;
			let parentSelectionItem: SelectionItem | null = null;
			let parentChanged = false;

			try {
				let resolutionSourceType: "experience_fact" | "profile_list_item";
				let resolutionSourceId: string;

				if (input.kind === "responsibility") {
					const employmentItem = selectionItems.find(
						(item) => item.id === input.employmentSelectionItemId && item.sourceType === "employment",
					);

					if (!employmentItem) {
						throw new Error("A responsibility must be linked to an employment.");
					}

					const sortOrder =
						selectionItems
							.filter((item) => item.parentSelectionItemId === employmentItem.id)
							.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;

					const fact = await orpc.cvmateProfile.createExperienceFact.call({
						text,
						kind: "responsibility",
					});

					factId = fact.id;
					linkedEmploymentId = employmentItem.sourceId;

					await orpc.cvmateProfile.linkEmploymentFact.call({
						employmentId: employmentItem.sourceId,
						experienceFactId: fact.id,
						sortOrder,
					});

					createdSelectionItem = await orpc.cvmateBuild.createSelectionItem.call({
						cvBuildId: buildId,
						parentSelectionItemId: employmentItem.id,
						sourceType: "experience_fact",
						sourceId: fact.id,
						selected: true,
						sortOrder,
					});

					parentSelectionItem = employmentItem;

					if (!employmentItem.selected) {
						parentSelectionItem = await orpc.cvmateBuild.updateSelectionItem.call({
							id: employmentItem.id,
							selected: true,
						});

						parentChanged = true;
					}

					resolutionSourceType = "experience_fact";
					resolutionSourceId = fact.id;
				} else {
					const listItem = await orpc.cvmateProfile.createListItem.call({
						kind: input.kind,
						value: text,
					});

					listItemId = listItem.id;

					const sortOrder = selectionItems.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;

					createdSelectionItem = await orpc.cvmateBuild.createSelectionItem.call({
						cvBuildId: buildId,
						parentSelectionItemId: null,
						sourceType: "profile_list_item",
						sourceId: listItem.id,
						selected: true,
						sortOrder,
					});

					resolutionSourceType = "profile_list_item";
					resolutionSourceId = listItem.id;
				}

				const updatedGap = await orpc.cvmateBuild.updateGap.call({
					id: input.gap.id,
					resolutionSourceType,
					resolutionSourceId,
				});

				return {
					gap: updatedGap,
					selectionItem: createdSelectionItem,
					parentSelectionItem,
				};
			} catch (error) {
				if (createdSelectionItem) {
					await orpc.cvmateBuild.deleteSelectionItem.call({ id: createdSelectionItem.id }).catch(() => undefined);
				}

				if (parentChanged && parentSelectionItem) {
					await orpc.cvmateBuild.updateSelectionItem
						.call({
							id: parentSelectionItem.id,
							selected: false,
						})
						.catch(() => undefined);
				}

				if (linkedEmploymentId && factId) {
					await orpc.cvmateProfile.unlinkEmploymentFact
						.call({
							employmentId: linkedEmploymentId,
							experienceFactId: factId,
						})
						.catch(() => undefined);
				}

				if (factId) {
					await orpc.cvmateProfile.deleteExperienceFact.call({ id: factId }).catch(() => undefined);
				}

				if (listItemId) {
					await orpc.cvmateProfile.deleteListItem.call({ id: listItemId }).catch(() => undefined);
				}

				throw error;
			}
		},
		onSuccess: ({ gap, selectionItem, parentSelectionItem }, variables) => {
			setSelectionItems((items) => [
				...items.map((item) =>
					parentSelectionItem && item.id === parentSelectionItem.id ? parentSelectionItem : item,
				),
				selectionItem,
			]);

			setGaps((items) => items.map((item) => (item.id === gap.id ? gap : item)));

			setGapEvidenceDrafts((current) => {
				const next = { ...current };
				delete next[variables.gap.id];
				return next;
			});

			setGeneratedContent([]);
		},
	});
	const dismissGap = useMutation({
		mutationFn: (id: string) => orpc.cvmateBuild.updateGap.call({ id, status: "dismissed" }),
		onSuccess: (updated) => {
			setGaps((items) => items.map((item) => (item.id === updated.id ? updated : item)));
		},
	});

	const generateTailoredContent = useMutation({
		mutationFn: async () => {
			if (!buildId) throw new Error(t`Start creating the CV before generating tailored content.`);

			const result = await orpc.cvmateBuild.generateTailoredContent.call({
				id: buildId,
			});

			return result.generatedContent;
		},
		onSuccess: (items) => {
			setGeneratedContent(items);
		},
	});

	const saveGeneratedContent = useMutation({
		mutationFn: (input: { id: string; finalText: string | null }) =>
			orpc.cvmateBuild.updateGeneratedContentFinalText.call(input),
		onSuccess: (updated) => {
			setGeneratedContent((items) => items.map((item) => (item.id === updated.id ? updated : item)));
		},
	});

	const materializeCv = useMutation({
		// biome-ignore lint/suspicious/useAwait: Preserve async rejection semantics for the mutation function.
		mutationFn: async () => {
			if (!buildId) throw new Error(t`Start creating the CV before opening the editor.`);

			return orpc.cvmateBuild.materialize.call({ id: buildId });
		},
		onSuccess: (result) => {
			window.location.assign(`/builder/${result.resumeId}`);
		},
	});

	const groupedRequirements = useMemo(() => {
		const initial: Record<RequirementCategory, NonNullable<typeof analyzeOffer.data>["requirements"]> = {
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

	const rootSelectionItems = selectionItems.filter((item) => item.parentSelectionItemId === null);
	const selectedCount = selectionItems.filter((item) => item.selected).length;
	const recommendedCount = selectionItems.filter((item) => item.recommended).length;
	const openGaps = gaps.filter((gap) => gap.status === "open");
	const selectedIds = new Set(selectionItems.filter((item) => item.selected).map((item) => item.id));
	const visibleGeneratedContent = generatedContent.filter(
		(item) =>
			item.kind === "professional_summary" ||
			(item.kind === "experience_fact" && item.selectionItemId !== null && selectedIds.has(item.selectionItemId)),
	);
	const hasTailoredContent = visibleGeneratedContent.some((item) => item.kind === "professional_summary");

	const canAnalyze = rawText.trim().length > 0 || asset !== null;
	const selectionPending =
		updateSelection.isPending ||
		selectRecommended.isPending ||
		quickAddResponsibility.isPending ||
		resolveGapWithEvidence.isPending;

	const reset = () => {
		setRawText("");
		setAsset(null);
		setBuildId(null);
		setSelectionItems([]);
		setGaps([]);
		setGeneratedContent([]);
		setQuickFactTextByEmployment({});
		setGapEvidenceDrafts({});
		analyzeOffer.reset();
		recommendContent.reset();
		updateSelection.reset();
		quickAddResponsibility.reset();
		resolveGapWithEvidence.reset();
		selectRecommended.reset();
		dismissGap.reset();
		generateTailoredContent.reset();
		saveGeneratedContent.reset();
		materializeCv.reset();
	};

	const renderSelectionItem = (item: SelectionItem, nested = false) => (
		<div key={item.id} className={`rounded-lg border bg-card p-3 ${nested ? "ml-6 border-dashed" : ""}`}>
			<div className="flex items-start gap-3">
				<input
					type="checkbox"
					aria-labelledby={`cvmate-selection-label-${item.id}`}
					className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
					checked={item.selected}
					disabled={selectionPending}
					onChange={(event) =>
						updateSelection.mutate({
							item,
							selected: event.target.checked,
						})
					}
				/>
				<div id={`cvmate-selection-label-${item.id}`} className="min-w-0 flex-1 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm">{selectionLabel(item)}</span>
						<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-sm">
							{sourceTypeLabel(item.sourceType)}
						</span>
						{item.recommended ? (
							<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-sm">
								<Trans>Recommended</Trans>
							</span>
						) : null}
					</div>
					{item.recommendationReason ? (
						<p className="text-muted-foreground text-sm">{item.recommendationReason}</p>
					) : null}
				</div>
			</div>
		</div>
	);
	const renderQuickAddResponsibility = (employmentItem: SelectionItem) => {
		if (employmentItem.sourceType !== "employment") return null;

		const value = quickFactTextByEmployment[employmentItem.id] ?? "";
		const activeEmploymentId = quickAddResponsibility.variables?.employmentItem.id ?? null;
		const isActive = quickAddResponsibility.isPending && activeEmploymentId === employmentItem.id;

		return (
			<form
				className="ml-6 flex flex-col gap-2 rounded-lg border border-dashed bg-muted/30 p-3 sm:flex-row"
				onSubmit={(event) => {
					event.preventDefault();

					const text = value.trim();

					if (!text || quickAddResponsibility.isPending) return;

					quickAddResponsibility.mutate({
						employmentItem,
						text,
					});
				}}
			>
				<Input
					className="min-w-0 flex-1"
					aria-label={t`Responsibility`}
					placeholder={t`Responsibility`}
					value={value}
					disabled={quickAddResponsibility.isPending}
					onChange={(event) =>
						setQuickFactTextByEmployment((current) => ({
							...current,
							[employmentItem.id]: event.target.value,
						}))
					}
				/>

				<Button
					type="submit"
					variant="outline"
					className="shrink-0"
					disabled={!value.trim() || quickAddResponsibility.isPending}
				>
					<Trans>Add responsibility</Trans>
					{isActive ? (
						<span className="sr-only">
							<Trans>Saving...</Trans>
						</span>
					) : null}
				</Button>
			</form>
		);
	};

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
							Paste the job offer or attach a PDF/image. 1story will analyze it before building your tailored CV.
						</Trans>
					</p>
				</div>

				{!analyzeOffer.data ? (
					<form
						className="space-y-5 rounded-xl border bg-card p-5"
						onSubmit={(event) => {
							event.preventDefault();
							if (canAnalyze) analyzeOffer.mutate();
						}}
					>
						<div className="space-y-2">
							<label className="font-medium text-sm" htmlFor="cvmate-job-offer-text">
								<Trans>Paste job offer</Trans>
							</label>
							<Textarea
								id="cvmate-job-offer-text"
								className="min-h-56 resize-y"
								placeholder={t`Paste the complete job offer here...`}
								value={rawText}
								disabled={analyzeOffer.isPending}
								onChange={(event) => setRawText(event.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<label className="font-medium text-sm" htmlFor="cvmate-job-offer-file">
								<Trans>Or attach a file</Trans>
							</label>
							<Input
								id="cvmate-job-offer-file"
								type="file"
								className="h-auto py-2"
								accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
								disabled={analyzeOffer.isPending}
								onChange={(event) => setAsset(event.target.files?.[0] ?? null)}
							/>
							<p className="text-muted-foreground text-sm">
								<Trans>PDF, JPEG, PNG, WebP or GIF, up to 10 MB.</Trans>
							</p>
						</div>

						{analyzeOffer.isError ? (
							<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
								{getOrpcErrorMessage(analyzeOffer.error, {
									fallback: t`The job offer could not be analyzed.`,
								})}
							</div>
						) : null}

						<div className="flex justify-end">
							<Button type="submit" disabled={!canAnalyze || analyzeOffer.isPending}>
								{analyzeOffer.isPending ? <Trans>Analyzing...</Trans> : <Trans>Save and analyze</Trans>}
							</Button>
						</div>
					</form>
				) : (
					<div className="space-y-6">
						<div className="rounded-xl border bg-card p-5">
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div className="space-y-1">
									<h3 className="font-medium text-base">{analyzeOffer.data.roleTitle ?? t`Analyzed job offer`}</h3>
									<p className="text-muted-foreground text-sm">
										{[analyzeOffer.data.companyName, analyzeOffer.data.location].filter(Boolean).join(" Â· ") ||
											t`Analysis completed`}
									</p>
								</div>
								<Button type="button" variant="outline" onClick={reset}>
									<Trans>Analyze another offer</Trans>
								</Button>
							</div>
						</div>

						<div className="grid gap-4 lg:grid-cols-2">
							{(["required", "preferred", "responsibility", "keyword", "other"] as RequirementCategory[]).map(
								(category) => {
									const requirements = groupedRequirements[category];
									if (requirements.length === 0) return null;

									return (
										<section key={category} className="rounded-xl border bg-card p-5">
											<div className="mb-3 flex items-center justify-between gap-3">
												<h3 className="font-medium text-sm">{categoryTitle(category)}</h3>
												<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-sm">
													{requirements.length}
												</span>
											</div>
											<ul className="space-y-2">
												{requirements.map((requirement) => (
													<li key={requirement.id} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
														<div className="flex items-start justify-between gap-3">
															<span>{requirement.text}</span>
															<span className="shrink-0 text-muted-foreground text-sm">
																{priorityLabel(requirement.priority)}
															</span>
														</div>
													</li>
												))}
											</ul>
										</section>
									);
								},
							)}
						</div>

						{analyzeOffer.data.requirements.length === 0 ? (
							<div className="rounded-xl border bg-card p-5 text-muted-foreground text-sm">
								<Trans>Analysis completed, but no structured requirements were extracted.</Trans>
							</div>
						) : null}

						{selectionItems.length === 0 ? (
							<div className="rounded-xl border bg-card p-5">
								<div className="space-y-1">
									<h3 className="font-medium">
										<Trans>Match your Master Profile</Trans>
									</h3>
									<p className="text-muted-foreground text-sm">
										<Trans>
											Create a CV from your Master Profile and let AI recommend only information already stored there.
										</Trans>
									</p>
								</div>

								{recommendContent.isError ? (
									<div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
										{getOrpcErrorMessage(recommendContent.error, {
											fallback: t`Recommendations could not be generated.`,
										})}
									</div>
								) : null}

								<div className="mt-4 flex justify-end">
									<Button type="button" disabled={recommendContent.isPending} onClick={() => recommendContent.mutate()}>
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
								<section className="space-y-4 rounded-xl border bg-card p-5">
									<div className="flex flex-wrap items-start justify-between gap-4">
										<div className="space-y-1">
											<h3 className="font-medium">
												<Trans>Choose CV content</Trans>
											</h3>
											<p className="text-muted-foreground text-sm">
												<Trans>
													AI recommendations are suggestions only. You decide what is included in the final CV.
												</Trans>
											</p>
										</div>
										<div className="flex flex-wrap gap-2 text-muted-foreground text-sm">
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
												{getOrpcErrorMessage(recommendContent.error, {
													fallback: t`AI recommendations could not be generated. You can still select content manually.`,
												})}
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
												{(childrenByParent.get(item.id) ?? []).map((child) => renderSelectionItem(child, true))}
												{renderQuickAddResponsibility(item)}
											</div>
										))}
									</div>

									{quickAddResponsibility.isError ? (
										<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
											{getOrpcErrorMessage(quickAddResponsibility.error, {
												fallback: t`Could not update this CV.`,
											})}
										</div>
									) : null}
								</section>

								<section className="space-y-4 rounded-xl border bg-card p-5">
									<div className="space-y-1">
										<h3 className="font-medium">
											<Trans>Gaps</Trans>
										</h3>
										<p className="text-muted-foreground text-sm">
											<Trans>
												These are required or preferred job requirements for which 1story found no direct evidence in
												your Master Profile.
											</Trans>
										</p>
									</div>

									{openGaps.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											<Trans>No open gaps detected.</Trans>
										</p>
									) : (
										<div className="space-y-3">
											{openGaps.map((gap) => {
												const draft = gapEvidenceDrafts[gap.id] ?? {
													kind: "competency" as GapEvidenceKind,
													text: "",
													employmentSelectionItemId:
														rootSelectionItems.find((item) => item.sourceType === "employment")?.id ?? "",
												};

												const isResponsibility = draft.kind === "responsibility";

												const active =
													resolveGapWithEvidence.isPending && resolveGapWithEvidence.variables?.gap.id === gap.id;

												return (
													<div key={gap.id} className="space-y-3 rounded-md bg-muted/40 p-3">
														<div className="flex items-start justify-between gap-4">
															<div className="space-y-1">
																<p className="text-sm">{gap.text}</p>
																<p className="text-muted-foreground text-sm">
																	{priorityLabel(gap.severity)} · {gapOriginLabel(gap.origin)}
																</p>
															</div>

															<Button
																type="button"
																variant="outline"
																disabled={dismissGap.isPending || resolveGapWithEvidence.isPending}
																onClick={() => dismissGap.mutate(gap.id)}
															>
																<Trans>Dismiss</Trans>
															</Button>
														</div>

														<form
															className="space-y-2 rounded-lg border border-dashed bg-card p-3"
															onSubmit={(event) => {
																event.preventDefault();

																const text = draft.text.trim();

																if (!text || resolveGapWithEvidence.isPending) {
																	return;
																}

																resolveGapWithEvidence.mutate({
																	gap,
																	kind: draft.kind,
																	text,
																	employmentSelectionItemId: draft.employmentSelectionItemId,
																});
															}}
														>
															<div className="grid gap-2 md:grid-cols-2">
																<select
																	aria-label={t`Type`}
																	className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
																	value={draft.kind}
																	disabled={resolveGapWithEvidence.isPending}
																	onChange={(event) => {
																		const kind = event.target.value as GapEvidenceKind;

																		setGapEvidenceDrafts((current) => ({
																			...current,
																			[gap.id]: {
																				...draft,
																				kind,
																				employmentSelectionItemId:
																					kind === "responsibility" && !draft.employmentSelectionItemId
																						? (rootSelectionItems.find((item) => item.sourceType === "employment")
																								?.id ?? "")
																						: draft.employmentSelectionItemId,
																			},
																		}));
																	}}
																>
																	<option value="competency">{t`Skills`}</option>
																	<option value="software">{t`Software`}</option>
																	<option value="tool">{t`Tools`}</option>
																	<option value="responsibility">{t`Responsibility`}</option>
																</select>

																{isResponsibility ? (
																	<select
																		aria-label={t`Employment`}
																		className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
																		value={draft.employmentSelectionItemId}
																		disabled={resolveGapWithEvidence.isPending}
																		onChange={(event) =>
																			setGapEvidenceDrafts((current) => ({
																				...current,
																				[gap.id]: {
																					...draft,
																					employmentSelectionItemId: event.target.value,
																				},
																			}))
																		}
																	>
																		{rootSelectionItems
																			.filter((item) => item.sourceType === "employment")
																			.map((item) => (
																				<option key={item.id} value={item.id}>
																					{selectionLabel(item)}
																				</option>
																			))}
																	</select>
																) : null}
															</div>

															<div className="flex flex-col gap-2 sm:flex-row">
																<Input
																	className="min-w-0 flex-1"
																	aria-label={t`Profile information`}
																	placeholder={t`Profile information`}
																	value={draft.text}
																	disabled={resolveGapWithEvidence.isPending}
																	onChange={(event) =>
																		setGapEvidenceDrafts((current) => ({
																			...current,
																			[gap.id]: {
																				...draft,
																				text: event.target.value,
																			},
																		}))
																	}
																/>

																<Button
																	type="submit"
																	variant="outline"
																	className="shrink-0"
																	disabled={
																		!draft.text.trim() ||
																		resolveGapWithEvidence.isPending ||
																		(isResponsibility && !draft.employmentSelectionItemId)
																	}
																>
																	<Trans>Add</Trans>
																	{active ? (
																		<span className="sr-only">
																			<Trans>Saving...</Trans>
																		</span>
																	) : null}
																</Button>
															</div>

															{resolveGapWithEvidence.isError && resolveGapWithEvidence.variables?.gap.id === gap.id ? (
																<p className="text-destructive text-sm">
																	{getOrpcErrorMessage(resolveGapWithEvidence.error, {
																		fallback: t`Could not update this CV.`,
																	})}
																</p>
															) : null}
														</form>
													</div>
												);
											})}
										</div>
									)}
								</section>

								<div className="space-y-3">
									{generateTailoredContent.isError ? (
										<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
											{getOrpcErrorMessage(generateTailoredContent.error, {
												fallback: t`Tailored CV content could not be generated.`,
											})}
										</div>
									) : null}

									<div className="flex justify-end">
										<Button
											type="button"
											disabled={selectedCount === 0 || generateTailoredContent.isPending}
											onClick={() => generateTailoredContent.mutate()}
										>
											{generateTailoredContent.isPending ? (
												<Trans>Generating tailored content...</Trans>
											) : hasTailoredContent ? (
												<Trans>Regenerate tailored content</Trans>
											) : (
												<Trans>Continue to tailored content</Trans>
											)}
										</Button>
									</div>
								</div>

								{hasTailoredContent ? (
									<section className="space-y-5 rounded-xl border bg-card p-5">
										<div className="space-y-1">
											<h3 className="font-medium">
												<Trans>Tailored CV content</Trans>
											</h3>
											<p className="text-muted-foreground text-sm">
												<Trans>
													Review the AI wording before opening the CV editor. Your edits are saved as final text and
													preserved when AI content is regenerated.
												</Trans>
											</p>
										</div>

										<div className="space-y-4">
											{visibleGeneratedContent.map((content) => {
												const sourceItem = content.selectionItemId
													? selectionItems.find((item) => item.id === content.selectionItemId)
													: null;
												const label =
													content.kind === "professional_summary"
														? t`Professional summary`
														: sourceItem
															? selectionLabel(sourceItem)
															: t`Experience fact`;

												return (
													<div key={content.id} className="space-y-2">
														<div className="flex flex-wrap items-center justify-between gap-2">
															<label className="font-medium text-sm" htmlFor={`cvmate-generated-${content.id}`}>
																{label}
															</label>
															{content.finalText ? (
																<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-sm">
																	<Trans>Edited</Trans>
																</span>
															) : null}
														</div>
														<Textarea
															id={`cvmate-generated-${content.id}`}
															className="min-h-28 resize-y"
															value={content.finalText ?? content.aiText ?? ""}
															disabled={saveGeneratedContent.isPending}
															onChange={(event) => {
																const value = event.target.value;
																setGeneratedContent((items) =>
																	items.map((item) => (item.id === content.id ? { ...item, finalText: value } : item)),
																);
															}}
															onBlur={(event) => {
																const value = event.currentTarget.value.trim();
																const aiValue = (content.aiText ?? "").trim();
																saveGeneratedContent.mutate({
																	id: content.id,
																	finalText: value.length > 0 && value !== aiValue ? value : null,
																});
															}}
														/>
													</div>
												);
											})}
										</div>

										{saveGeneratedContent.isError ? (
											<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
												{getOrpcErrorMessage(saveGeneratedContent.error, {
													fallback: t`Your final text could not be saved.`,
												})}
											</div>
										) : null}

										{materializeCv.isError ? (
											<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
												{getOrpcErrorMessage(materializeCv.error, {
													fallback: t`The CV could not be opened in the editor.`,
												})}
											</div>
										) : null}

										<div className="flex justify-end">
											<Button
												type="button"
												disabled={materializeCv.isPending || saveGeneratedContent.isPending}
												onClick={() => materializeCv.mutate()}
											>
												{materializeCv.isPending ? <Trans>Preparing CV...</Trans> : <Trans>Open in CV editor</Trans>}
											</Button>
										</div>
									</section>
								) : null}
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
