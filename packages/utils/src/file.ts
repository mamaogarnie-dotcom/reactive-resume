import { slugify } from "./string";

function formatExportTimestamp(date: Date) {
	const pad = (value: number, length = 2) => value.toString().padStart(length, "0");

	return [
		date.getFullYear(),
		"-",
		pad(date.getMonth() + 1),
		"-",
		pad(date.getDate()),
		"_",
		pad(date.getHours()),
		"-",
		pad(date.getMinutes()),
		"-",
		pad(date.getSeconds()),
		"-",
		pad(date.getMilliseconds(), 3),
	].join("");
}

export function generateFilename(prefix: string, extension?: string, exportedAt?: Date) {
	const name = slugify(prefix);
	const timestamp = exportedAt && !Number.isNaN(exportedAt.getTime()) ? `_${formatExportTimestamp(exportedAt)}` : "";

	return `${name}${timestamp}${extension ? `.${extension}` : ""}`;
}

export function downloadWithAnchor(blob: Blob, filename: string) {
	const a = document.createElement("a");
	const url = URL.createObjectURL(blob);

	a.href = url;
	a.rel = "noopener";
	a.download = filename;

	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);

	setTimeout(() => URL.revokeObjectURL(url), 5000);
}
