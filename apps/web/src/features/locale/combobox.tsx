import { useLingui } from "@lingui/react";
import type { SingleComboboxProps } from "@/components/ui/combobox";
import { Combobox } from "@/components/ui/combobox";
import { changeLocale } from "@/libs/locale";
import { getAppLocaleOptions } from "./locale-options";

type Props = Omit<SingleComboboxProps, "options" | "value" | "onValueChange">;

export function LocaleCombobox(props: Props) {
	const { i18n } = useLingui();

	return (
		<Combobox
			showClear={false}
			defaultValue={i18n.locale}
			options={getAppLocaleOptions()}
			onValueChange={changeLocale}
			{...props}
		/>
	);
}
