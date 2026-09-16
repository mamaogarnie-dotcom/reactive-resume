import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { SignOutIcon, TranslateIcon } from "@phosphor-icons/react";
import type { AuthSession } from "@reactive-resume/auth/types";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuGroup,
DropdownMenuItem,
DropdownMenuRadioGroup,
DropdownMenuRadioItem,
DropdownMenuSeparator,
DropdownMenuSub,
DropdownMenuSubContent,
DropdownMenuSubTrigger,
DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { toast } from "@reactive-resume/ui/components/toast";
import { useRouter } from "@tanstack/react-router";
import { useIsClient } from "usehooks-ts";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";
import { appLocaleMap, changeLocale } from "@/libs/locale";

type Props = {
children: ({
session,
}: {
session: AuthSession;
}) => React.ComponentProps<typeof DropdownMenuTrigger>["render"];
};

export function UserDropdownMenu({ children }: Props) {
const isClient = useIsClient();
const router = useRouter();
const { i18n } = useLingui();
const { data: session } = authClient.useSession();

const handleLogout = async () => {
const toastId = toast.add({
type: "loading",
description: t`Signing out...`,
});

await authClient.signOut({
fetchOptions: {
onSuccess: () => {
toast.close(toastId);
void router.invalidate();
},
onError: ({ error }) => {
toast.add({
type: "error",
description: getReadableErrorMessage(
error,
t({
comment: "Fallback toast when signing out fails",
message: "Failed to sign out. Please try again.",
}),
),
id: toastId,
});
},
},
});
};

if (!isClient) return null;
if (!session?.user) return null;

return (
<DropdownMenu>
<DropdownMenuTrigger
render={children({ session: session as AuthSession })}
/>

<DropdownMenuContent align="start" side="top">
<DropdownMenuGroup>
<DropdownMenuSub>
<DropdownMenuSubTrigger>
<TranslateIcon />
<Trans comment="Menu item that opens language selection submenu">
Language
</Trans>
</DropdownMenuSubTrigger>

<DropdownMenuSubContent className="max-h-[400px] overflow-y-auto">
<DropdownMenuRadioGroup
value={i18n.locale}
onValueChange={changeLocale}
>
{Object.entries(appLocaleMap).map(([value, label]) => (
<DropdownMenuRadioItem key={value} value={value}>
{i18n.t(label)}
</DropdownMenuRadioItem>
))}
</DropdownMenuRadioGroup>
</DropdownMenuSubContent>
</DropdownMenuSub>
</DropdownMenuGroup>

<DropdownMenuSeparator />

<DropdownMenuItem onClick={handleLogout}>
<SignOutIcon />
<Trans comment="User menu action to sign out of current account">
Sign out
</Trans>
</DropdownMenuItem>
</DropdownMenuContent>
</DropdownMenu>
);
}