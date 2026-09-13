import type { MessageDescriptor } from "@lingui/core";
import { i18n } from "@lingui/core";
import type { Locale } from "@reactive-resume/utils/locale";
import { appLocaleMap, cvLocaleMap, localeMap } from "@/libs/locale";

const createLocaleOptions = (entries: Array<[string, MessageDescriptor]>) =>
	entries.map(([value, label]) => {
		const name = i18n.t(label);

		return {
			value: value as Locale,
			label: (
				<span className="flex items-center gap-x-2">
					<span className="font-mono text-muted-foreground text-xs">
						{value}
					</span>
					{name}
				</span>
			),
			textValue: name,
			keywords: [name, value.toLowerCase(), label.message].filter(
				(keyword): keyword is string => Boolean(keyword),
			),
		};
	});

/**
 * Full technical locale catalogue retained for the underlying resume engine.
 */
export const getLocaleOptions = () =>
	createLocaleOptions(Object.entries(localeMap));

/**
 * Languages exposed by the 1story application interface in V1.
 */
export const getAppLocaleOptions = () =>
	createLocaleOptions(Object.entries(appLocaleMap));

/**
 * Languages available for final CV documents in 1story V1.
 */
export const getCvLocaleOptions = () =>
	createLocaleOptions(Object.entries(cvLocaleMap));
