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

const categoryTitle: Record<RequirementCategory, string> = {
	required: "Most important requirements",
	preferred: "Nice to have",
	responsibility: "Responsibilities",
	keyword: "Important keywords",
	other: "Other",
};

function RouteComponent() {
	const [rawText, setRawText] = useState("");
	const [asset, setAsset] = useState<File | null>(null);

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

	const canAnalyze = rawText.trim().length > 0 || asset !== null;

	const reset = () => {
		setRawText("");
		setAsset(null);
		analyzeOffer.reset();
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
							Paste the job offer or attach a PDF/image. CVMate will save the
							offer and analyze it before building your tailored CV.
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
											.join(" Â· ") || t`Analysis completed`}
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
					</div>
				)}
			</div>
		</div>
	);
}
