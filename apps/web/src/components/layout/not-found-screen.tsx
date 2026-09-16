import { BrandIcon } from "@reactive-resume/ui/components/brand-icon";
import { Trans } from "@lingui/react/macro";
import {
	HouseIcon,
	MagnifyingGlassIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@reactive-resume/ui/components/alert";
import { buttonVariants } from "@reactive-resume/ui/components/button";
import { Link } from "@tanstack/react-router";

export function NotFoundScreen() {
	return (
		<div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-y-4">
			<div className="flex items-center gap-2">
				<BrandIcon variant="icon" className="size-10" alt="" aria-hidden="true" />
				<span className="font-semibold text-xl tracking-tight">1story</span>
			</div>

			<Alert>
				<WarningIcon />
				<AlertTitle>
					<Trans>We couldn't find that page</Trans>
				</AlertTitle>
				<AlertDescription>
					<Trans>
						The page you're looking for may have been moved or no longer exists.
					</Trans>
				</AlertDescription>
			</Alert>

			<div className="flex items-center gap-x-2">
				<Link to="/dashboard" className={buttonVariants()}>
					<MagnifyingGlassIcon />
					<Trans>Go to dashboard</Trans>
				</Link>

				<Link to="/" className={buttonVariants({ variant: "secondary" })}>
					<HouseIcon />
					<Trans>Go home</Trans>
				</Link>
			</div>
		</div>
	);
}
