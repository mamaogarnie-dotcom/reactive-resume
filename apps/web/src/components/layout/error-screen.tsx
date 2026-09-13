import { Trans } from "@lingui/react/macro";
import {
	ArrowClockwiseIcon,
	HouseIcon,
	ReadCvLogoIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@reactive-resume/ui/components/alert";
import { Button, buttonVariants } from "@reactive-resume/ui/components/button";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export function ErrorScreen({ reset }: ErrorComponentProps) {
	return (
		<div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-y-4">
			<div className="flex items-center gap-2">
				<ReadCvLogoIcon className="size-10" />
				<span className="font-semibold text-xl tracking-tight">1story</span>
			</div>

			<Alert>
				<WarningIcon />
				<AlertTitle>
					<Trans>Something went wrong</Trans>
				</AlertTitle>
				<AlertDescription>
					<Trans>
						An unexpected error stopped this page from loading. You can try
						again or head back.
					</Trans>
				</AlertDescription>
			</Alert>

			<div className="flex items-center gap-x-2">
				<Button onClick={reset}>
					<ArrowClockwiseIcon />
					<Trans>Try again</Trans>
				</Button>

				<Link
					to="/dashboard"
					className={buttonVariants({ variant: "secondary" })}
				>
					<HouseIcon />
					<Trans>Go to dashboard</Trans>
				</Link>
			</div>
		</div>
	);
}
