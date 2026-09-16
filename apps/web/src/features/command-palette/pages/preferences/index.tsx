import { Trans } from "@lingui/react/macro";
import { TranslateIcon } from "@phosphor-icons/react";
import { CommandItem } from "@reactive-resume/ui/components/command";
import { useCommandPaletteStore } from "../../store";
import { BaseCommandGroup } from "../base";
import { LanguageCommandPage } from "./language";

export function PreferencesCommandGroup() {
const pushPage = useCommandPaletteStore((state) => state.pushPage);

return (
<>
<BaseCommandGroup heading={<Trans>Preferences</Trans>}>
<CommandItem onSelect={() => pushPage("language")}>
<TranslateIcon />
<Trans>Change language to…</Trans>
</CommandItem>
</BaseCommandGroup>

<LanguageCommandPage />
</>
);
}