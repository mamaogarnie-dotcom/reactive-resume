import { ReadCvLogoIcon } from "@phosphor-icons/react";
import { Spinner } from "@reactive-resume/ui/components/spinner";

export function LoadingScreen() {
	return (
		<div className="fixed inset-0 z-50 flex h-svh w-svw flex-col items-center justify-center gap-y-6 bg-background">
			<div className="flex items-center gap-2">
				<ReadCvLogoIcon className="size-10" />
				<span className="font-semibold text-xl tracking-tight">CVMate</span>
			</div>

			<Spinner className="size-6" />
		</div>
	);
}
