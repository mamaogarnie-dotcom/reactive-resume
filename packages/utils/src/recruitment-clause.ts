export type RecruitmentClauseScope = "current" | "current_and_future";
export type RecruitmentClauseLanguage = "pl" | "en";

export const recruitmentClauseScopes = [
"current",
"current_and_future",
] as const satisfies readonly RecruitmentClauseScope[];

export const recruitmentClauseLanguages = [
"pl",
"en",
] as const satisfies readonly RecruitmentClauseLanguage[];

const defaultRecruitmentClauses: Record<
RecruitmentClauseScope,
Record<RecruitmentClauseLanguage, string>
> = {
current: {
pl: "Wyrażam zgodę na przetwarzanie moich danych osobowych dla potrzeb niezbędnych do realizacji procesu rekrutacji zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych i w sprawie swobodnego przepływu takich danych oraz uchylenia dyrektywy 95/46/WE (RODO).",
en: "I consent to the processing of my personal data for the purposes necessary to carry out the recruitment process in accordance with Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (GDPR).",
},
current_and_future: {
pl: "Wyrażam zgodę na przetwarzanie moich danych osobowych zawartych w aplikacji dla potrzeb niezbędnych do realizacji obecnego oraz przyszłych procesów rekrutacyjnych zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych i w sprawie swobodnego przepływu takich danych oraz uchylenia dyrektywy 95/46/WE (RODO).",
en: "I consent to the processing of my personal data contained in my application for the purposes necessary to carry out the current and future recruitment processes in accordance with Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (GDPR).",
},
};

export function getDefaultRecruitmentClause(
scope: RecruitmentClauseScope,
language: RecruitmentClauseLanguage,
): string {
return defaultRecruitmentClauses[scope][language];
}

export function resolveRecruitmentClauseContent(
scope: RecruitmentClauseScope,
language: RecruitmentClauseLanguage,
content: string | null | undefined,
): string {
const customContent = content?.trim();

return customContent && customContent.length > 0
? customContent
: getDefaultRecruitmentClause(scope, language);
}

export function resolveRecruitmentClauseLanguage(
targetLanguage: string | null | undefined,
): RecruitmentClauseLanguage {
const normalized = targetLanguage?.trim().toLowerCase() ?? "";

return normalized === "pl" || normalized.startsWith("pl-") ? "pl" : "en";
}