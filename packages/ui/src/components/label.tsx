import type * as React from "react";
import { cn } from "@reactive-resume/utils/style";

function Label({ className, htmlFor, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: label is a generic component
		<label
			htmlFor={htmlFor}
			data-slot="label"
			className={cn(
				"flex select-none items-center gap-2 font-medium text-base leading-none peer-disabled:cursor-not-allowed peer-disabled:text-disabled-foreground peer-disabled:opacity-100 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-disabled-foreground group-data-[disabled=true]:opacity-100",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
