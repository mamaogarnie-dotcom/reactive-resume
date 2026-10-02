import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
	component: PrivacyPage,
	head: () => ({ meta: [{ title: "Polityka prywatności | 1story" }] }),
});

function PrivacyPage() {
	return (
		<main className="mx-auto max-w-2xl space-y-6 px-4 py-10 text-sm leading-relaxed">
			<h1 className="font-semibold text-2xl tracking-tight">Polityka prywatności 1story (wersja testowa)</h1>
			<p className="text-muted-foreground">Ostatnia aktualizacja: 2 października 2026.</p>

			<section className="space-y-2">
				<h2 className="font-semibold text-base">Administrator danych</h2>
				<p>
					Administratorem danych jest Agnieszka Płocidem. Kontakt w sprawach danych osobowych:{" "}
					<a href="mailto:biuro.1story@gmail.com" className="underline underline-offset-2">
						biuro.1story@gmail.com
					</a>
					.
				</p>
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold text-base">Wersja testowa</h2>
				<p>
					1story jest w fazie testów. Nie wpisuj prawdziwych danych osobowych, zwłaszcza numeru PESEL, danych o zdrowiu
					ani dokumentów. Rejestracja nie wymaga potwierdzenia adresu e-mail, dlatego nie podawaj cudzego adresu. Dane
					testowe mogą zostać usunięte po zakończeniu testów.
				</p>
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold text-base">Jakie dane przetwarzamy</h2>
				<ul className="list-disc space-y-1 ps-5">
					<li>dane konta: adres e-mail, nazwa użytkownika, hasło (przechowywane w postaci zaszyfrowanej),</li>
					<li>przy logowaniu przez Google: podstawowe dane profilu konta Google,</li>
					<li>dane, które sam wpisujesz: profil zawodowy, treść CV, oferty pracy i listy motywacyjne,</li>
					<li>dane techniczne: adres IP, ciasteczka sesji niezbędne do logowania, logi błędów.</li>
				</ul>
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold text-base">Cel i podstawa prawna</h2>
				<p>
					Dane przetwarzamy, aby świadczyć usługę tworzenia CV (art. 6 ust. 1 lit. b RODO) oraz dla bezpieczeństwa i
					testowania aplikacji (art. 6 ust. 1 lit. f RODO).
				</p>
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold text-base">Odbiorcy danych</h2>
				<ul className="list-disc space-y-1 ps-5">
					<li>OVHcloud: hosting serwera (Warszawa, Polska),</li>
					<li>Google: logowanie kontem Google,</li>
					<li>
						Groq (siedziba w USA): dostawca funkcji AI. Treść, którą wysyłasz do funkcji AI (dane zawodowe: stanowiska,
						osiągnięcia, umiejętności, wykształcenie i treść ofert; bez danych kontaktowych, zdjęcia i referencji),
						trafia do tego dostawcy tylko wtedy, gdy z nich korzystasz.
					</li>
				</ul>
				<p>
					Dane wysyłane do funkcji AI mogą być przetwarzane poza Europejskim Obszarem Gospodarczym. Nie wpisuj w nich
					danych wrażliwych.
				</p>
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold text-base">Jak długo przechowujemy dane</h2>
				<p>
					Do usunięcia konta. Kopie zapasowe przechowujemy do 14 dni (zrzuty bazy danych) oraz do 7 dni (migawki
					serwera).
				</p>
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold text-base">Twoje prawa</h2>
				<p>
					Możesz żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przeniesienia oraz
					wnieść sprzeciw. Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych.
				</p>
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold text-base">Usunięcie konta i kopia danych</h2>
				<p>
					Konto wraz z danymi możesz usunąć w ustawieniach konta. Możesz też napisać na adres e-mail podany wyżej. W tej
					samej wiadomości możesz poprosić o kopię swoich danych.
				</p>
			</section>
		</main>
	);
}
