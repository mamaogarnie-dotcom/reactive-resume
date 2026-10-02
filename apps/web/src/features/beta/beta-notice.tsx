export function BetaNotice() {
	return (
		<div
			role="note"
			className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-amber-900 text-xs dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
		>
			Wersja testowa: nie wpisuj prawdziwych danych osobowych (np. PESEL, dane o zdrowiu). Dane mogą zostać usunięte po
			zakończeniu testów.{" "}
			<a href="/privacy" className="font-medium underline underline-offset-2">
				Polityka prywatności
			</a>
		</div>
	);
}
