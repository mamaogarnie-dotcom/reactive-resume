function validDate(year: number, month: number, day: number) {
const parsed = new Date(Date.UTC(year, month - 1, day));

return (
parsed.getUTCFullYear() === year &&
parsed.getUTCMonth() === month - 1 &&
parsed.getUTCDate() === day
);
}

function pad(value: number) {
return String(value).padStart(2, "0");
}

export function normalizeFlexibleDate(value: string): string | null {
const trimmed = value.trim();

if (!trimmed) return "";

if (/^\d{4}$/.test(trimmed)) {
return trimmed;
}

let match = trimmed.match(/^(\d{4})[./-](\d{1,2})$/);

if (match) {
const year = Number(match[1]);
const month = Number(match[2]);

if (month < 1 || month > 12) return null;

return `${year}-${pad(month)}`;
}

match = trimmed.match(/^(\d{1,2})[./-](\d{4})$/);

if (match) {
const month = Number(match[1]);
const year = Number(match[2]);

if (month < 1 || month > 12) return null;

return `${year}-${pad(month)}`;
}

match = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);

if (match) {
const year = Number(match[1]);
const month = Number(match[2]);
const day = Number(match[3]);

if (!validDate(year, month, day)) return null;

return `${year}-${pad(month)}-${pad(day)}`;
}

match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

if (match) {
const day = Number(match[1]);
const month = Number(match[2]);
const year = Number(match[3]);

if (!validDate(year, month, day)) return null;

return `${year}-${pad(month)}-${pad(day)}`;
}

return null;
}

export function withoutDay(value: string): string {
const normalized = normalizeFlexibleDate(value);

if (normalized === null) return value.trim();

const fullDate = normalized.match(/^(\d{4}-\d{2})-\d{2}$/);

return fullDate ? fullDate[1] : normalized;
}