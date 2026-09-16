import { BrandIcon } from "@reactive-resume/ui/components/brand-icon";
import { Outlet } from "@tanstack/react-router";

export function AuthLayout() {
	return (
		<div className="fade-in-0 slide-in-from-top-4 mx-auto flex h-svh w-dvw max-w-sm animate-in flex-col justify-center gap-y-6 px-4 xs:px-0 duration-300 ease-(--ease-out-strong)">
			<div className="mb-4 flex items-center justify-center gap-2 self-center">
				<BrandIcon variant="icon" className="size-10" alt="" aria-hidden="true" />
				<span className="font-semibold text-2xl tracking-tight">1story</span>
			</div>

			<Outlet />
		</div>
	);
}
