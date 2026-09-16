import { cn } from "@reactive-resume/utils/style";

type Props = React.ComponentProps<"img"> & {
variant?: "logo" | "icon";
};

const brandSources = {
logo: "/logo/light.svg",
icon: "/icon/light.svg",
} as const;

export function BrandIcon({
variant = "logo",
className,
alt = "1story",
...props
}: Props) {
return (
<img
src={brandSources[variant]}
alt={alt}
className={cn(
variant === "logo" ? "h-12 w-auto" : "size-10",
className,
)}
{...props}
/>
);
}