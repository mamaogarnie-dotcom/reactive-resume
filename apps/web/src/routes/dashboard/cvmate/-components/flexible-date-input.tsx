import { t } from "@lingui/core/macro";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
import { normalizeFlexibleDate, withoutDay } from "./flexible-date";

type FlexibleDateInputProps = {
ariaLabel: string;
placeholder: string;
value: string;
disabled?: boolean;
className?: string;
onChange: (value: string) => void;
};

export function FlexibleDateInput({
ariaLabel,
placeholder,
value,
disabled = false,
className,
onChange,
}: FlexibleDateInputProps) {
const datePickerRef = useRef<HTMLInputElement>(null);
const monthPickerRef = useRef<HTMLInputElement>(null);
const [omitDay, setOmitDay] = useState(/^\d{4}-\d{2}$/.test(value));

const datePickerValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

const monthPickerValue = /^\d{4}-\d{2}$/.test(value)
? value
: /^\d{4}-\d{2}-\d{2}$/.test(value)
? value.slice(0, 7)
: "";

const openNativePicker = (picker: HTMLInputElement | null) => {
if (!picker || disabled) return;

try {
picker.showPicker();
} catch {
picker.click();
}
};

const normalizeTypedValue = () => {
const normalized = normalizeFlexibleDate(value);

if (normalized !== null && normalized !== value) {
onChange(normalized);
}
};

return (
<div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`.trim()}>
<div className="flex min-w-0 items-center gap-2">
<Input
className="min-w-0 flex-1"
aria-label={ariaLabel}
maxLength={10}
placeholder={placeholder}
value={value}
disabled={disabled}
onChange={(event) => onChange(event.target.value)}
onBlur={normalizeTypedValue}
/>

<Button
type="button"
size="icon"
variant="outline"
className="shrink-0"
aria-label={omitDay ? t`Choose month from calendar` : t`Choose full date from calendar`}
disabled={disabled}
onClick={() =>
openNativePicker(omitDay ? monthPickerRef.current : datePickerRef.current)
}
>
<CalendarBlankIcon />
</Button>
</div>

<Button
type="button"
size="sm"
variant="outline"
disabled={disabled}
aria-pressed={omitDay}
className={
omitDay
? "w-fit border-2 border-[#A878AA] bg-[#E2C5E7]/30 text-[#A878AA] hover:bg-[#E2C5E7]/40"
: "w-fit"
}
onClick={() => {
const next = !omitDay;

setOmitDay(next);

if (next && value) {
onChange(withoutDay(value));
}
}}
>
{t`Do not provide day`}
</Button>

<p className="text-muted-foreground text-xs">
{t`You can type a year, month and year, or a full date. Dots, slashes and hyphens are accepted.`}
</p>

<input
ref={datePickerRef}
type="date"
tabIndex={-1}
aria-hidden="true"
className="sr-only"
value={datePickerValue}
disabled={disabled}
onChange={(event) => {
if (event.target.value) {
onChange(event.target.value);
}
}}
/>

<input
ref={monthPickerRef}
type="month"
tabIndex={-1}
aria-hidden="true"
className="sr-only"
value={monthPickerValue}
disabled={disabled}
onChange={(event) => {
if (event.target.value) {
onChange(event.target.value);
}
}}
/>
</div>
);
}