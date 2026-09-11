import type { Locale } from "@reactive-resume/utils/locale";
import { isLocale } from "@reactive-resume/utils/locale";
import { getCookie } from "../http/headers";

const defaultRequestLocale: Locale = "pl-PL";

export function getRequestLocale(request: Request): Locale {
	const locale = getCookie(request, "locale");
	return isLocale(locale) ? locale : defaultRequestLocale;
}
