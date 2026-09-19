# AI-WORKING-CONTRACT.md

## Status dokumentu

**WERSJA v1 — ZATWIERDZONA PRZEZ UŻYTKOWNICZKĘ**

Ten dokument jest zatwierdzonym kontraktem pracy dla projektu 1story / Reactive Resume. Zbiera obowiązujące zasady pracy oraz mechanizm ochrony tych zasad przed samowolną zmianą przez asystenta.

Obowiązująca ścieżka w repozytorium:

`E:\AGA\reactive-resume\docs\AI-WORKING-CONTRACT.md`

---

# 1. Zasada nadrzędna: brak samowolnych zmian

1. Asystent nie może samodzielnie zmienić, zastąpić, osłabić, rozszerzyć ani obejść żadnej zatwierdzonej zasady, procedury, zakresu projektu ani decyzji architektonicznej.
2. **DEFAULT = NO CHANGE.** Jeżeli istnieje wątpliwość, czy dane działanie zmienia wcześniejszą zasadę, proces, zakres albo kontrakt, obowiązuje dotychczasowa wersja.
3. Każda zmiana zasad wymaga wyraźnej zgody użytkowniczki.
4. Brak odpowiedzi, brak sprzeciwu, wykonanie innego polecenia ani kontynuacja pracy nie oznaczają zgody na zmianę zasad.
5. Asystent może zaproponować zmianę, ale do czasu zatwierdzenia musi traktować ją wyłącznie jako propozycję.
6. Propozycja zmiany zasady powinna być przedstawiona jako:
   - obecna zasada,
   - proponowana zmiana,
   - powód,
   - wpływ na dotychczasowy workflow.
7. Jeżeli dwie zatwierdzone zasady wchodzą ze sobą w konflikt i nie da się ich jednocześnie spełnić, asystent nie wybiera samodzielnie. Zatrzymuje krok i wskazuje konflikt użytkowniczce.
8. Sam plik `AI-WORKING-CONTRACT.md` nie może być zmieniany w ramach zwykłego zadania implementacyjnego. Jego zmiana wymaga osobnej zgody użytkowniczki.

---

# 2. Repozytorium i źródła prawdy

1. Główne repozytorium projektu:
   `E:\AGA\reactive-resume`
2. Główna gałąź robocza:
   `aga-cv-builder`
3. Komercyjny `origin`:
   `https://github.com/mamaogarnie-dotcom/reactive-resume.git`
4. `upstream`:
   `https://github.com/reactive-resume/reactive-resume.git`
5. **Nigdy nie pushować do upstream.**
6. Przed zmianą kodu wymagającą wiedzy o obecnej implementacji należy wykonać source-of-truth audit zamiast zgadywać.
7. Nie wolno opierać implementacji na dawnych założeniach, wcześniejszych opisach ani TODO, jeżeli można sprawdzić aktualny kod.
8. Analiza luki powinna, gdy ma to zastosowanie, przejść ścieżkę:
   `UI -> route/API -> backend/service -> data/schema -> tests`.
9. Nie wolno otwierać ponownie zamkniętego etapu bez nowego konkretnego dowodu.
10. Nie wolno naprawiać TODO mechanicznie tylko dlatego, że istnieje.
11. Nie wolno rozszerzać zakresu V1 bez zgody użytkowniczki.

---

# 3. Zasada pracy krokami

1. **Jeden krok to wiele etapów.**
2. Jeden krok użytkowniczki powinien być realizowany jako jeden możliwie duży, spójny agregat wykonujący wewnętrznie wszystkie potrzebne podetapy.
3. Obowiązuje preferencja:
   **jedna komenda PowerShell na krok**.
4. Nie należy rozbijać jednego logicznego kroku na serię drobnych komend, jeśli bezpiecznie można je połączyć.
5. Jeżeli potrzebny jest nowy plik roboczy lub skrypt:
   - utworzyć nową wersję,
   - od razu uwzględnić cleanup wersji niepotrzebnych,
   - podać sposób uruchomienia,
   - nie pozostawiać bałaganu po starych wersjach.
6. Gdy bezpieczniej jest zmienić kolejność `new file -> cleanup -> run`, można to zrobić, ale tylko z uzasadnionego powodu bezpieczeństwa.
7. Gotowe pliki i komendy mają być kompletne i gotowe do użycia, a nie podawane jako fragmenty wymagające ręcznego składania.

---

# 4. Raportowanie i schowek

1. Skrypt diagnostyczny, audytowy lub implementacyjny powinien generować pełny raport.
2. Raport wyświetlany w terminalu i raport kopiowany do schowka powinny być **identyczne**.
3. Nie wolno samodzielnie zmieniać kontraktu schowka, np. przez wprowadzanie dodatkowych markerów, pre-markerów albo innego zachowania, bez osobnej zgody użytkowniczki.
4. Jeżeli błąd nastąpi na etapie parsera PowerShell przed uruchomieniem skryptu, należy traktować to jako błąd harnessu/skryptu, a nie jako dowód zmiany repozytorium.
5. Po błędzie parsera nie wolno zakładać, że instrukcje skryptu, w tym `Set-Clipboard`, zostały wykonane.
6. Raport ma zawierać wystarczający stan końcowy, aby rozróżnić:
   - sukces produktu,
   - błąd produktu,
   - błąd testu,
   - błąd skryptu/harnessu,
   - błąd środowiska.

---

# 5. PowerShell 5.1

1. Środowisko użytkowniczki:
   **Windows PowerShell 5.1**.
2. Generowane pliki `.ps1` powinny być ASCII-only wszędzie, gdzie to praktyczne.
3. Generowane pliki `.ps1` powinny mieć UTF-8 BOM:
   `EF BB BF`.
4. Przed przekazaniem skryptu należy sprawdzić ryzyko:
   - niezbalansowanych pojedynczych apostrofów,
   - angielskich apostrofów wewnątrz pojedynczo cytowanych stringów,
   - znaków nie-ASCII mogących zostać źle zinterpretowanych przez PowerShell 5.1.
5. Nie używać nazwy funkcji `H`, ponieważ koliduje z aliasem PowerShell.
6. Dla natywnych poleceń źródłem prawdy o powodzeniu jest `$LASTEXITCODE`.
7. Preferować:
   - `[System.IO.File]::ReadAllText`,
   - `[System.IO.File]::ReadAllBytes`,
   - `ConvertFrom-Json`.
8. Unikać kruchego quoting i zbędnego `node -e`.
9. Błąd parse-time oznacza, że żadne instrukcje skryptu nie zostały wykonane.
10. Po błędzie nie wykonywać automatycznego resetu repozytorium.

---

# 6. Git — zasady bezpieczeństwa

1. Przed mutacją repo należy ustalić:
   - repo,
   - branch,
   - HEAD,
   - tracking ref,
   - origin,
   - stan worktree.
2. Dla kroków wymagających konkretnego baseline należy stosować guard SHA.
3. Przed push należy sprawdzić faktyczny stan zdalnej gałęzi, a nie tylko lokalny tracking.
4. Nie wykonywać:
   - `force push`,
   - automatycznego resetu,
   - automatycznego unstage po nieudanym kroku,
   - destrukcyjnego cleanupu bez dowodu.
5. Po niepowodzeniu najpierw wykonać audit aktualnego stanu.
6. Należy rozróżniać błąd harnessu od błędu produktu.
7. Po materialnych zmianach wykonać odpowiednią walidację, a następnie `git diff --check`.
8. Staging ma być kontrolowany i obejmować wyłącznie zatwierdzony zakres plików.
9. Commit może powstać dopiero po przejściu wymaganej walidacji.
10. Push może nastąpić dopiero po commit i ponownym guarded check.
11. Nigdy nie pushować do upstream.
12. Nie tworzyć ani nie pushować tagów `v*` przed etapem produkcyjnym.
13. Nie uruchamiać odziedziczonego release workflow przed produkcją.

---

# 7. Hooki i commit bez hostowego Node/pnpm

1. Host obecnie nie ma rozwiązywalnego Node/pnpm.
2. `commit --no-verify` jest dopuszczalny wyłącznie wtedy, gdy wcześniej w Dockerze wykonano równoważne kontrole hooków.
3. Hook pre-commit obejmuje:
   - kontrolę conflict markerów,
   - `pnpm biome check --write --unsafe --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}`.
4. Hook commit-msg obejmuje:
   - `pnpm commitlint --edit {1}`.
5. Commitlint w Dockerze powinien używać:
   - mount `.git` do `/app/.git,readonly`,
   - `GIT_CONFIG_COUNT=1`,
   - `GIT_CONFIG_KEY_0=safe.directory`,
   - `GIT_CONFIG_VALUE_0=/app`,
   - workdir `/app`,
   - bezpośredniego `pnpm commitlint --edit /tmp/COMMIT_EDITMSG`.

---

# 8. Zakaz root `pnpm check`

1. Nie uruchamiać root:
   `pnpm check`
2. Powód:
   rootowy skrypt wykonuje mutujące:
   `biome check --write --unsafe`.
3. Walidacje mają być wykonywane świadomie i celowanie, bez niekontrolowanych zmian całego repo.

---

# 9. Docker i toolchain

1. Dla czystych walidacji używać Docker-native toolchain.
2. Bazowy kierunek:
   - Node 24 bookworm slim,
   - pnpm 12.3.4,
   - git,
   - ca-certificates,
   - python3,
   - make,
   - g++.
3. Repo można kopiować do tymczasowego obrazu.
4. Dla instalacji dopuszczalny jest tymczasowy `git init`, po czym tymczasowe `.git` należy usunąć.
5. `package.json` pin:
   `pnpm@12.3.4`.
6. `Dockerfile.dev` z dawnym ARG pnpm 11.21 jest traktowany jako historycznie nieaktualny wobec aktualnego pinu.
7. Dla Biome/Git przy mountowaniu repo:
   - `.git` montować read-only,
   - zapewnić `.gitignore`,
   - respektować `biome.json` z VCS git i `useIgnoreFile:true`.
8. Docker context ma korzystać z lokalnego desktop-linux endpoint:
   `npipe:////./pipe/dockerDesktopLinuxEngine`.
9. Wymagany lokalny endpoint powinien pasować do `^npipe://`.

---

# 10. E2E i zasoby tymczasowe

1. Dla izolowanych E2E nie używać ponownie ani nie restartować istniejącego dev stacka.
2. Używać unikalnych tymczasowych:
   - obrazów,
   - sieci,
   - kontenerów,
   - bazy PostgreSQL 17.
3. Tymczasowa baza nie powinna publikować hostowego portu, jeśli nie jest to potrzebne.
4. Migracje testować na disposable DB.
5. Cleanup ma usuwać wyłącznie zasoby utworzone dla konkretnego kroku/tokena.
6. Nie używać destrukcyjnego globalnego cleanupu.
7. Nie używać `--remove-orphans` bez konkretnej potrzeby i zgody.
8. Nie usuwać volume bez konkretnej potrzeby i zgody.
9. Nie restartować ani nie usuwać istniejących usług bez konkretnego powodu.

---

# 11. Walidacja po zmianach

Zakres walidacji ma odpowiadać zmianie, ale dla istotnych zmian V1 preferowany łańcuch obejmuje:

1. kontrolę markerów/zakresu zmian,
2. Biome dla dokładnego zakresu,
3. targeted tests,
4. odpowiedni typecheck,
5. production build,
6. `git diff --check`,
7. disposable migration/schema validation, jeżeli zmiana dotyka obszaru zależnego od DB,
8. odpowiedni E2E,
9. hook-equivalent checks,
10. dokładny staging,
11. commit,
12. guarded push,
13. finalną kontrolę:
    - HEAD,
    - tracking,
    - actual remote,
    - clean worktree.

Nie należy wykonywać ciężkich walidacji „dla zasady”, jeśli nie mają związku ze zmianą, ale nie wolno też pomijać testów koniecznych dla danego kontraktu.

---

# 12. Zasady recovery po błędzie

1. Nie wykonywać automatycznego `git reset`.
2. Nie wykonywać automatycznego `git restore`.
3. Nie wykonywać automatycznego unstage.
4. Nie kasować zmian tylko dlatego, że test lub skrypt się nie udał.
5. Najpierw ustalić:
   - czy skrypt w ogóle wystartował,
   - co zdążył zmienić,
   - co jest staged,
   - aktualny HEAD,
   - aktualny remote,
   - czy błąd był parser/runtime/product/test/environment.
6. Naprawa ma wynikać z dowodu.
7. Nie uruchamiać ponownie dużego skryptu implementacyjnego w ciemno po częściowym wykonaniu.
8. Jeżeli potrzebny jest recovery script, powinien być oparty na aktualnym stanie repo, a nie na założeniu, że poprzedni krok niczego nie zrobił.

---

# 13. V1 — zamknięty zakres produktu

V1 1story obejmuje:

1. **Master Profile** jako trwałą bazę kariery.
2. Kategorie:
   - doświadczenie,
   - projekty,
   - obowiązki/fakty,
   - osiągnięcia,
   - edukacja wybierana do CV,
   - certyfikaty,
   - kursy,
   - narzędzia/oprogramowanie,
   - wolontariat,
   - referencje,
   - nagrody,
   - zainteresowania.
3. Pola w dużej mierze opcjonalne.
4. Braki mają być sygnalizowane ostrzeżeniami zamiast sztucznego wymuszania danych tam, gdzie nie jest to konieczne.
5. UX dodawania prostych pozycji ma pozostać szybki, np. jedna linia + `Dodaj`.
6. `ExperienceFact`:
   - responsibility,
   - achievement,
   - unspecified.
7. Onboarding V1:
   - wyłącznie ręczne wpisywanie,
   - bez importu do Master Profile,
   - bez AI w bazie profilu.
8. AI pojawia się dopiero przy tworzeniu CV.
9. Tworzenie CV do oferty obejmuje:
   - wklejenie treści oferty,
   - upload obsługiwanych plików/obrazów,
   - analizę oferty,
   - wybór treści,
   - szybkie dodawanie nowych faktów do Master Profile,
   - wykrywanie luk,
   - propozycje AI dla luk bez automatycznego tworzenia faktów,
   - możliwość dodawania prawdziwego evidence,
   - preview,
   - rekomendację projektu,
   - możliwość zmiany projektu.
10. Podsumowanie zawodowe jest generowane od nowa.
11. `Moje CV`:
    - Wszystkie,
    - Gotowe,
    - Wersje robocze,
    - Ulubione,
    - Kosz.
12. Nie ma statusu `Wysłane`.
13. Dwie standardowe klauzule mają pozostać dostępne i przełączalne zgodnie z obecną implementacją.
14. Eksport:
    - PDF,
    - DOCX.
15. Nie dodawać nowych rodzin funkcji do V1 bez zgody.

Poza V1 pozostają m.in.:

- listy motywacyjne,
- trening rozmów kwalifikacyjnych,
- rozmowy głosowe,
- tracker aplikacji,
- Archiwum Kariery,
- przypomnienia o dokumentach,
- pakiety dokumentów,
- bank historii STAR,
- dziennik kariery,
- historia wersji Master Profile,
- porównywanie ofert.

---

# 14. Branding — decyzje zamknięte

1. V1 udostępnia tylko jasny motyw.
2. Infrastruktura dark mode może pozostać w kodzie na przyszłość, ale dark mode nie jest oferowany użytkownikowi w V1.
3. Ustalony kierunek marki:
   - jasny,
   - ciepły,
   - kolorowy,
   - przytulny,
   - profesjonalny,
   - bez dominacji czerni i szarości.
4. Ustalona paleta:
   - green `#4E6B35`,
   - orange `#DE6E17`,
   - page `#F5F8F2`,
   - surface `#FCFDFB`,
   - soft green `#EEF3E8`,
   - lavender `#E2C5E7`,
   - primary text `#3C4F27`,
   - secondary `#66705F`,
   - purple `#734A75`,
   - border `#D9E2D2`,
   - focus `#4E6B35`.
5. Fonty:
   - Source Sans 3,
   - DM Serif Display używany oszczędnie.
6. Branding i podstawowy kierunek językowy są traktowane jako zamknięte, chyba że pojawi się nowa decyzja użytkowniczki.

---

# 15. Migracje

1. Używać natywnego mechanizmu migracji projektu.
2. Nie edytować ręcznie istniejącej zatwierdzonej migracji:
   `migrations/20260915221521_violet_major_mapleleaf/`
3. Nowa migracja powstaje tylko wtedy, gdy rzeczywista zmiana danych/schema tego wymaga.
4. Nie tworzyć migracji „na zapas”.
5. Jeżeli audit potwierdza brak potrzeby migracji, nie dodawać zmian schematu tylko po to, aby przechować stan, który może być bezpiecznie transient.

---

# 16. Deployment i release — odłożone

1. Deployment pozostaje odłożony do końcowego etapu przed testerami.
2. Do tego czasu nie:
   - wybierać ani kupować domeny,
   - wybierać hostingu,
   - konfigurować SMTP/DNS/TLS,
   - generować produkcyjnych sekretów,
   - uruchamiać produkcji,
   - tworzyć release tagów,
   - uruchamiać odziedziczonego release workflow.
3. Zamknięta architektura produkcyjna:
   - project `one_story_prod`,
   - PostgreSQL 17,
   - app,
   - bez Redis,
   - bez SeaweedFS,
   - app data jako named volume,
   - app na `127.0.0.1:3000`,
   - Postgres bez hostowego portu,
   - prywatne zewnętrzne `.env.production`.
4. Reverse proxy/TLS są odłożone.
5. Późniejszy launch testerów:
   - provider research,
   - domain/DNS,
   - VPS,
   - proxy/TLS,
   - SMTP,
   - env,
   - migration,
   - deploy,
   - smoke,
   - testers.

---

# 17. Zamknięte etapy i baseline projektu

1. Zamknięte elementy nie są otwierane bez dowodu.
2. Zamknięte:
   - branding V1,
   - localization/language baseline,
   - RC techniczny,
   - DEV migration,
   - DEPLOY-1,
   - V1-GAP-1,
   - V1-GAP-2,
   - V1-GAP-3.
3. V1-GAP-4 jest obsługiwany jako osobny etap i nie może niepotrzebnie przebudowywać GAP-1/2/3.
4. Ostatni znany zamknięty baseline przed V1-GAP-4:
   `f6452712ee9b668d9c1168679fa1e2c009dc7f5d`
5. Poprzednie zamknięte baseline:
   - GAP-2: `1867ba5328f8fcc28b199b240cf4316982c6176b`
   - GAP-1: `f1ab64ebf99d932c1304ee2ba01014548ac1332f`

---

# 18. Styl pracy z użytkowniczką

1. Odpowiedzi mają być konkretne, techniczne i bez lania wody.
2. Przy zmianach plików preferowane są kompletne gotowe wersje zamiast fragmentów.
3. Nie prosić o serię ręcznych diagnostyk, jeżeli można bezpiecznie zrobić jeden agregatowy audit.
4. Nie zadawać zbędnych pytań, jeśli bezpieczny read-only audit może ustalić odpowiedź.
5. Nie dramatyzować problemów.
6. Nie zakładać sukcesu bez dowodu.
7. Nie zakładać porażki produktu, jeżeli fakty wskazują na błąd harnessu.
8. Nie deklarować zamknięcia etapu bez walidacji właściwej dla tego etapu.

---

# 19. Kontrola kontraktu przed dużym krokiem

Przed przygotowaniem większego skryptu, migracji, commitu, pushu lub zmiany architektury asystent powinien sprawdzić, czy plan:

1. nie zmienia obowiązujących zasad bez zgody,
2. nie rozszerza V1,
3. nie otwiera zamkniętego etapu bez dowodu,
4. nie używa zabronionej komendy lub workflow,
5. respektuje jedną komendę / jeden agregat,
6. respektuje cleanup plików roboczych,
7. respektuje zasady Git i remote,
8. respektuje ustalony toolchain,
9. ma odpowiednią walidację,
10. nie wprowadza nowego deployment/release work przed jego etapem.

Jeżeli którykolwiek punkt jest niepewny, domyślnie obowiązuje **NO CHANGE**.

---

# 20. Procedura zmiany kontraktu

Każda zmiana kontraktu powinna mieć osobną decyzję użytkowniczki.

Minimalny format propozycji:

```text
PROPOZYCJA ZMIANY KONTRAKTU

Obecna zasada:
...

Proponowana zmiana:
...

Powód:
...

Wpływ:
...

Status:
OCZEKUJE NA ZATWIERDZENIE
```

Bez wyraźnego zatwierdzenia status pozostaje `OCZEKUJE NA ZATWIERDZENIE`.

---

# 21. Zasada końcowa

**Asystent wykonuje zatwierdzony plan, a nie samodzielnie redefiniuje sposób pracy.**

Gdy pojawia się potencjalnie lepszy sposób techniczny, można go zaproponować, ale nie wolno automatycznie zastępować nim wcześniejszej decyzji użytkowniczki.

---

## Approval

Status: **APPROVED**

Zatwierdzono przez użytkowniczkę: **2026-09-19**

Dokument obowiązuje jako stały kontrakt pracy dla projektu 1story od momentu jego zaakceptowania przez użytkowniczkę.
