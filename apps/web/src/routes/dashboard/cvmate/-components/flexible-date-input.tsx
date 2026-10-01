import { t } from "@lingui/core/macro";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Input } from "@reactive-resume/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@reactive-resume/ui/components/popover";
import { normalizeFlexibleDate } from "./flexible-date";

type FlexibleDateInputProps = {
ariaLabel: string;
placeholder: string;
value: string;
disabled?: boolean;
className?: string;
onChange: (value: string) => void;
};

type PickerView = "months" | "days";

const pad = (value: number) => String(value).padStart(2, "0");

function canonicalParts(value: string) {
const normalized = normalizeFlexibleDate(value);

if (!normalized) {
return {
year: new Date().getFullYear(),
month: null as number | null,
day: null as number | null,
};
}

const [yearText, monthText, dayText] = normalized.split("-");

return {
year: Number(yearText),
month: monthText ? Number(monthText) : null,
day: dayText ? Number(dayText) : null,
};
}

function daysInMonth(year: number, month: number) {
return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function mondayFirstOffset(year: number, month: number) {
const sundayFirst = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
return (sundayFirst + 6) % 7;
}

export function FlexibleDateInput({
ariaLabel,
placeholder,
value,
disabled = false,
className,
onChange,
}: FlexibleDateInputProps) {
const initial = canonicalParts(value);

const [open, setOpen] = useState(false);
const [view, setView] = useState<PickerView>("months");
const [year, setYear] = useState(initial.year);
const [month, setMonth] = useState<number | null>(initial.month);

const normalizedCurrent = normalizeFlexibleDate(value);

const selectedMonth =
normalizedCurrent && /^\d{4}-\d{2}(?:-\d{2})?$/.test(normalizedCurrent)
? Number(normalizedCurrent.slice(5, 7))
: null;

const selectedDay =
normalizedCurrent && /^\d{4}-\d{2}-\d{2}$/.test(normalizedCurrent)
? Number(normalizedCurrent.slice(8, 10))
: null;

const selectedYear =
normalizedCurrent && /^\d{4}/.test(normalizedCurrent)
? Number(normalizedCurrent.slice(0, 4))
: null;

const monthLabels = useMemo(
() =>
Array.from({ length: 12 }, (_, index) =>
new Intl.DateTimeFormat(undefined, {
month: "short",
timeZone: "UTC",
})
.format(new Date(Date.UTC(2024, index, 1)))
.replace(".", ""),
),
[],
);

const weekdayLabels = useMemo(
() =>
Array.from({ length: 7 }, (_, index) =>
new Intl.DateTimeFormat(undefined, {
weekday: "short",
timeZone: "UTC",
})
.format(new Date(Date.UTC(2024, 0, index + 1)))
.replace(".", ""),
),
[],
);

const normalizeTypedValue = () => {
const normalized = normalizeFlexibleDate(value);

if (normalized !== null && normalized !== value) {
onChange(normalized);
}
};

const initializePicker = () => {
const parsed = canonicalParts(value);

setYear(parsed.year);
setMonth(parsed.month);
setView("months");
};

const handleOpenChange = (nextOpen: boolean) => {
if (nextOpen) initializePicker();
setOpen(nextOpen);
};

const chooseYearOnly = () => {
onChange(String(year));
setOpen(false);
};

const chooseMonth = (nextMonth: number) => {
setMonth(nextMonth);
setView("days");
};

const chooseMonthOnly = () => {
if (!month) return;

onChange(`${year}-${pad(month)}`);
setOpen(false);
};

const chooseDay = (day: number) => {
if (!month) return;

onChange(`${year}-${pad(month)}-${pad(day)}`);
setOpen(false);
};

const dayCount = month ? daysInMonth(year, month) : 0;
const dayOffset = month ? mondayFirstOffset(year, month) : 0;

return (
<div className={`flex min-w-0 items-center gap-2 ${className ?? ""}`.trim()}>
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

<Popover open={open} onOpenChange={handleOpenChange}>
<PopoverTrigger
type="button"
disabled={disabled}
aria-label={t`Choose date`}
className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:border-primary/60 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50"
>
<CalendarBlankIcon />
</PopoverTrigger>

<PopoverContent
align="start"
sideOffset={6}
className="w-72 gap-3 rounded-card border border-border bg-[#F5F8F2] p-3"
>
{view === "months" ? (
<>
<div className="grid grid-cols-[36px_1fr_36px] items-center gap-2">
<button
type="button"
aria-label={t`Previous year`}
className="flex size-9 items-center justify-center rounded-md border border-border bg-background text-lg hover:border-primary/60"
onClick={() => setYear((current) => current - 1)}
>
‹
</button>

<div className="rounded-md border-2 border-[#3C4F27] bg-background px-3 py-2 text-center font-semibold text-base">
{year}
</div>

<button
type="button"
aria-label={t`Next year`}
className="flex size-9 items-center justify-center rounded-md border border-border bg-background text-lg hover:border-primary/60"
onClick={() => setYear((current) => current + 1)}
>
›
</button>
</div>

<div className="grid grid-cols-3 gap-2">
{monthLabels.map((label, index) => {
const monthNumber = index + 1;
const selected =
selectedYear === year && selectedMonth === monthNumber;

return (
<button
key={monthNumber}
type="button"
className={
selected
? "rounded-md border-2 border-[#A878AA] bg-[#E2C5E7]/35 px-2 py-2 font-medium text-[#A878AA]"
: "rounded-md border border-transparent px-2 py-2 font-medium hover:border-[#3C4F27]/50 hover:bg-background"
}
onClick={() => chooseMonth(monthNumber)}
>
<span className="capitalize">{label}</span>
</button>
);
})}
</div>

<button
type="button"
className="w-full rounded-md border border-[#3C4F27] bg-background px-3 py-2 font-medium text-[#3C4F27] hover:border-2"
onClick={chooseYearOnly}
>
{t`Do not provide month`}
</button>
</>
) : (
<>
<div className="grid grid-cols-[36px_1fr] items-center gap-2">
<button
type="button"
aria-label={t`Back to month selection`}
className="flex size-9 items-center justify-center rounded-md border border-border bg-background text-lg hover:border-primary/60"
onClick={() => setView("months")}
>
‹
</button>

<div className="rounded-md border-2 border-[#3C4F27] bg-background px-3 py-2 text-center font-semibold text-base">
<span className="capitalize">
{month ? monthLabels[month - 1] : ""}
</span>{" "}
{year}
</div>
</div>

<div className="grid grid-cols-7 gap-1 text-center">
{weekdayLabels.map((label) => (
<div
key={label}
className="py-1 font-medium text-muted-foreground text-xs capitalize"
>
{label}
</div>
))}

{Array.from({ length: dayOffset }, (_, index) => (
<div key={`empty-${index}`} />
))}

{Array.from({ length: dayCount }, (_, index) => {
const day = index + 1;
const selected =
selectedYear === year &&
selectedMonth === month &&
selectedDay === day;

return (
<button
key={day}
type="button"
className={
selected
? "flex size-8 items-center justify-center rounded-md border-2 border-[#A878AA] bg-[#E2C5E7]/35 font-medium text-[#A878AA]"
: "flex size-8 items-center justify-center rounded-md border border-transparent hover:border-[#3C4F27]/50 hover:bg-background"
}
onClick={() => chooseDay(day)}
>
{day}
</button>
);
})}
</div>

<button
type="button"
className="w-full rounded-md border border-[#3C4F27] bg-background px-3 py-2 font-medium text-[#3C4F27] hover:border-2"
onClick={chooseMonthOnly}
>
{t`Do not provide day`}
</button>
</>
)}
</PopoverContent>
</Popover>
</div>
);
}