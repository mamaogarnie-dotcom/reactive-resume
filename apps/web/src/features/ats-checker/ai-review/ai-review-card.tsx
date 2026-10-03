import type { PdfAtsReport } from "@reactive-resume/resume/ats-pdf";
import type { AtsAiReview } from "./ai-review-results";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon, InfoIcon, SparkleIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { Alert, AlertDescription } from "@reactive-resume/ui/components/alert";
import { Button } from "@reactive-resume/ui/components/button";
import { Label } from "@reactive-resume/ui/components/label";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { toast } from "@reactive-resume/ui/components/toast";
import { AiProviderPicker } from "@/features/settings/integrations/components/ai-provider-picker";
import { useHasUsableAiProvider } from "@/features/settings/integrations/hooks/use-has-usable-ai-provider";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { getPdfFindingMessage } from "../messages";
import { AiReviewResults } from "./ai-review-results";

/** Matches the procedure's input cap; the text is trimmed here so the request is never rejected. */
const MAX_EXTRACTED_TEXT_CHARS = 50_000;
const MAX_FINDINGS = 120;

type AiReviewCardProps = {
	report: PdfAtsReport;
	fullText: string;
	jobDescription?: string;
	/** Set in the builder, so the server can also redact the identity details of that resume. */
	resumeId?: string;
};

/**
 * Tier three: opt-in, per run, and only after the deterministic report already exists.
 *
 * Everything sent is stated on the card before the button is pressed. The PDF itself never leaves
 * the browser. Only the text already extracted from it travels.
 */
export function AiReviewCard({ report, fullText, jobDescription, resumeId }: AiReviewCardProps) {
	const { usableProviders, hasUsableProvider, isLoading } = useHasUsableAiProvider();
	const context = useRouteContext({ strict: false });
	// Without a provider of their own, the user's review runs on the 1story platform provider (when configured).
	const usesPlatformProvider = !hasUsableProvider && (context.flags?.platformAiEnabled ?? false);
	const [providerOverride, setProviderOverride] = useState<string | null | undefined>(undefined);
	const [review, setReview] = useState<AtsAiReview | null>(null);

	const aiProviderId = providerOverride ?? usableProviders[0]?.id ?? null;

	const { mutate, isPending } = useMutation({
		...orpc.ai.atsReview.mutationOptions(),
		onSuccess: setReview,
		onError: (error) => {
			toast.add({
				type: "error",
				description: getOrpcErrorMessage(error, {
					byCode: {
						BAD_GATEWAY: t`Your AI provider could not be reached. Check its settings and try again.`,
						BAD_REQUEST: t`The provider returned a review that could not be read. Try again.`,
						PRECONDITION_FAILED: t`AI providers are unavailable until ENCRYPTION_SECRET is configured.`,
					},
					fallback: t`Failed to review this resume.`,
				}),
			});
		},
	});

	if (isLoading) return null;

	if (!hasUsableProvider && !usesPlatformProvider) return <NoProviderState />;

	const trimmedText = fullText.slice(0, MAX_EXTRACTED_TEXT_CHARS).trim();

	const onRun = () => {
		if (!trimmedText) return;

		mutate({
			...(aiProviderId ? { aiProviderId } : {}),
			...(resumeId ? { resumeId } : {}),
			extractedText: trimmedText,
			findings: report.findings.slice(0, MAX_FINDINGS).map((finding) => ({
				code: finding.code,
				severity: finding.severity,
				message: getPdfFindingMessage(finding.code).title,
			})),
			...(jobDescription?.trim() ? { jobDescription: jobDescription.trim() } : {}),
		});
	};

	return (
		<div className="space-y-3 rounded-md border p-4">
			<div className="flex items-center gap-2">
				<SparkleIcon className="size-4 shrink-0 text-primary" />
				<h4 className="font-semibold text-sm">
					<Trans>Review the writing with AI</Trans>
				</h4>
			</div>

			<p className="text-muted-foreground text-sm leading-normal">
				<Trans>
					The checks above are mechanical. This asks a language model what a reader would think of your bullets, and
					suggests rewrites. It produces no score.
				</Trans>
			</p>

			<p className="text-muted-foreground text-xs leading-normal">
				{usesPlatformProvider ? (
					<Trans>
						Sends the text extracted from your PDF, and the job description if you pasted one, to the 1story AI
						provider. The PDF file itself is never uploaded.
					</Trans>
				) : jobDescription?.trim() ? (
					<Trans>
						Sends the text already extracted from your PDF, plus the job description you pasted, to the AI provider you
						choose below. The PDF file itself is never uploaded.
					</Trans>
				) : (
					<Trans>
						Sends the text already extracted from your PDF to the AI provider you choose below. The PDF file itself is
						never uploaded.
					</Trans>
				)}
			</p>

			{!usesPlatformProvider && (
				<div className="space-y-2">
					<Label>
						<Trans>AI provider</Trans>
					</Label>
					<AiProviderPicker
						value={aiProviderId}
						providers={usableProviders}
						disabled={isPending}
						onValueChange={setProviderOverride}
					/>
				</div>
			)}

			<Button size="sm" disabled={isPending || !trimmedText} onClick={onRun}>
				{isPending ? <Spinner /> : <SparkleIcon />}
				{isPending ? <Trans>Reviewing…</Trans> : <Trans>Run AI review</Trans>}
			</Button>

			{review && <AiReviewResults review={review} />}
		</div>
	);
}

function NoProviderState() {
	return (
		<Alert>
			<InfoIcon />
			<AlertDescription className="space-y-3">
				<p>
					<Trans>
						Connect your own AI provider to get a review of the writing. The checks above need no provider and no
						account.
					</Trans>
				</p>

				<Button
					size="sm"
					variant="outline"
					nativeButton={false}
					render={
						<Link to="/dashboard/settings/integrations">
							<Trans>Open Integrations Settings</Trans>
							<ArrowRightIcon />
						</Link>
					}
				/>
			</AlertDescription>
		</Alert>
	);
}
