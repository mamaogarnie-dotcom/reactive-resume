<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# AGENTS.md — 1story

Instrukcje dla agentów AI i developerów pracujących w tym repozytorium.
Stan źródłowy: 2.10.2026 · gałąź `aga-cv-builder` · baseline HEAD `22a6632569d4f00d082f7eb3eb567b1822791fc8`.

Plik ma dwie części:

- **Część A — 1story (produkt, kontrakty, zakres V1, brand, zasady pracy).** Ma pierwszeństwo.
- **Część B — konwencje techniczne monorepo** (pochodzą z upstream Reactive Resume, nadal obowiązują technicznie).

> Ten plik streszcza decyzje. Nie zastępuje dokumentów źródłowych. W razie konfliktu obowiązuje hierarchia z sekcji A2.

---

# Część A — 1story

## A1. Czym jest ten projekt

**1story** to konsumencka aplikacja kariery: użytkownik raz buduje pełną historię zawodową (Master Profile), a potem tworzy z niej CV dopasowane do konkretnych ofert pracy.

- Tagline: „Jedna historia. Wiele możliwości.”
- Nazwa zawsze jako `1story`: małe litery, bez spacji, także na początku zdania.
- Repozytorium jest forkiem **Reactive Resume**. Obecność kodu upstream **nie oznacza**, że funkcja należy do 1story V1.
- `README.md` nadal opisuje Reactive Resume. **Nie traktuj go jako specyfikacji 1story.**
- Wewnętrzne route'y i identyfikatory `/dashboard/cvmate/...` oraz feature `packages/api/src/features/cvmate-build` są celowo zachowane. Nie zmieniaj ich nazw.
- **Nie zgłaszaj issues ani PR do upstream `amruthpillai/reactive-resume`.** Tracker zadań 1story nie jest jeszcze ustalony — zgłaszaj ustalenia w raporcie dla właścicielki projektu.

Główny user journey V1:

```
konto → Master Profile → Create CV → oferta pracy → analiza oferty → dobór treści
→ generowanie/dopasowanie → podgląd → edycja → ATS Checker → My CV → eksport
```

## A2. Hierarchia źródeł prawdy

1. **Brand Source of Truth V1** (15.09.2026, status CLOSED) — logo, kolory, typografia, UI, komunikacja.
2. **Kompendium produktu i mapa decyzji** (2.10.2026) — zakres V1, stan techniczny, pozycje #1–#70.
3. **Strategia wzrostu, cennik i plan pilotażu** (2.10.2026) — kierunki K1–K7, pozycje #71–#78, niespójności N1–N6.
4. Docelowe pliki w repo (gdy powstaną): `PRODUCT_SPEC_V1.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `AI_CONTRACT.md`, `AI_DATA_FLOW.md`, `SECURITY_MODEL.md`, `UPSTREAM_FEATURE_MAP.md`, `RELEASE_RUNBOOK.md`, `DECISIONS.md`.

Zasady:

- Plansze i mockupy generowane przez AI to materiał poglądowy, nie źródło wartości produkcyjnych.
- Dokumentacja upstream (`README.md`, `docs/agents/*`) opisuje Reactive Resume — używaj jej tylko jako informacji technicznej, nie produktowej.
- Jeśli wymaganie jest niejasne lub sprzeczne między dokumentami: **zatrzymaj się i zgłoś konflikt**, zamiast zgadywać.
- Zmiana logo, HEX, fontu, skali typografii lub kluczowej zasady UI wymaga aktualizacji Brand SoT.

## A3. Twarde kontrakty (nie wolno ich osłabić)

### Master Profile jest źródłem prawdy

- CV jest pochodną Master Profile, nie niezależną bazą faktów.
- Nie twórz konkurencyjnego źródła faktów w CV.
- Każde CV musi dać się prześledzić do danych/snapshotów Master Profile.

### AI nie wymyśla faktów (hard contract)

AI może: selekcjonować, porządkować, profesjonalizować styl, syntetyzować zaznaczone dowody.

AI **nie może** dodawać: pracodawców, dat, stanowisk, narzędzi, kompetencji, wyników, liczb, certyfikatów ani innych niepotwierdzonych faktów.

- Zachowaj walidacje wartości liczbowych i blokadę niepotwierdzonych wzmocnień (`successful`, `effective`, `proficient`, `advanced`, `excellent`, `strong`, `expert` i podobnych).
- Professional Summary: każde twierdzenie musi mieć bezpośredni dowód w zaznaczonych faktach.
- Professional Headline: bez fikcyjnego stanowiska, seniority i expertise.
- Refaktoryzacja promptów lub walidatorów wymaga testów dowodzących braku nowych faktów.
- Import CV (K1): AI może **ekstrahować** fakty z dokumentów użytkownika, ale każdy fakt trafia do Master Profile dopiero po zatwierdzeniu przez użytkownika.
- Luki (K3): system zadaje otwarte pytanie; **nie podsuwa gotowej odpowiedzi**.

### Granica prywatności AI

Do zewnętrznego providera AI trafiają **wyłącznie** zatwierdzone dane zawodowe niezbędne do danej funkcji.

- Nigdy do AI: imię, nazwisko, e-mail, telefon, LinkedIn URL, adres, zdjęcia (`profile_photo`), referencje (`reference`), nazwy plików, `storageKey`, ID, `createdAt` i inne metadane.
- Allowlista `packages/api/src/features/cvmate-build/ai-source-data.ts` działa **fail-closed** (test: `ai-source-data.test.ts`). Nowe pole nie trafia do AI bez jawnego dopisania i testu.
- **P0 BLOCKER:** `sourceTextSnapshot` (free-text) może zawierać PII wpisane przez użytkownika. Allowlista nazw pól tego nie rozwiązuje — wymagana sanityzacja/redakcja przed promptem.
- Import CV/LinkedIn PDF: przed wysłaniem do AI usuń lub zredaguj nagłówek kontaktowy i obrazy.
- Powierzchnie AI z upstreamu poza `cvmate-build` — m.in. `packages/ai`, zapisane providery AI, authenticated `/agent` workspace, MCP (`packages/mcp`) — muszą zostać zinwentaryzowane w audycie AI callsite'ów (#17) i sklasyfikowane w `UPSTREAM_FEATURE_MAP.md`.
- Każdy nowy callsite modelu AI musi zostać dopisany do `AI_DATA_FLOW.md` i objęty testem payloadu.
- W tekstach prawnych nie pisz „nie wysyłamy do AI żadnych danych osobowych”. Poprawnie: minimalizujemy zakres i nie wysyłamy zbędnych danych identyfikujących/kontaktowych, zdjęć ani referencji.

### Izolacja kont

- Dane ani chwilowy UI flash użytkownika A nie mogą pojawić się u użytkownika B.
- Nie usuwaj ani nie osłabiaj `SessionCacheGuard` (czyszczenie authenticated query cache przy zmianie user ID).
- Każdy endpoint zasobu musi odrzucać dostęp do zasobów innego użytkownika. Dla procedur uwierzytelnionych używaj `protectedProcedure` (część B).

### Auth

- **Google Login jest chroniony.** Nie przebudowuj go podczas ogólnego cleanupu bez konkretnego powodu.
- Beta: rejestracja e-mail bez obowiązkowej weryfikacji (`FLAG_REQUIRE_EMAIL_VERIFICATION`). Przed sprzedażą weryfikacja musi działać end-to-end.
- Reset hasła: UI, route `/auth/forgot-password` i backend `sendResetPassword` muszą mieć identyczną semantykę. Obecnie są niespójne (#24).
- Better Auth daje szerszy surface (passkey, 2FA, OAuth, API auth, linking) — nie włączaj nowych mechanizmów bez decyzji (#68).

## A4. Zakres V1

| Obszar | Decyzja |
| --- | --- |
| Master Profile, Create CV (z ofertą i ręcznie bez AI), analiza oferty, rekomendacje, tailored content | KEEP |
| Tryb ręczny bez AI | KEEP — nie może generować żadnego zewnętrznego requestu AI |
| My CV: All / Ready / Drafts / Favorites / Trash | KEEP — **nie dodawaj statusu Sent** (należy do przyszłego Application Trackera) |
| ATS Checker | KEEP |
| Eksport PDF (`packages/pdf`) i DOCX (`packages/docx`) | KEEP — eksport zgodny z podglądem |
| 1 vs 2 strony CV | Bez mechanicznego „zawsze 1 strona”; ważne dowody nie są usuwane dla limitu |
| Języki UI i CV | Tylko PL/EN, domyślnie PL. Szeroki `localeMap` upstream zostaje wewnętrznie, nie eksponuj go |
| Motyw | Light-only. Nie przywracaj kontroli dark mode w UI; infrastruktura może zostać |
| API Keys, Integrations, wybór providera AI, `/agent` workspace | HIDE przed zwykłym użytkownikiem |
| Cover Letters | LATER / ADAPT, P2 — adaptuj istniejący moduł, nie pisz od zera |
| Applications / tracker | LATER / ADAPT, P4 — nie eksponuj w launchu |
| Upstream marketing (rxresu.me, testimoniale) | REMOVE / REPLACE, jeśli widoczne |
| Licencja MIT / atrybucja upstream | KEEP — nie usuwaj |

Zasady ukrywania (HIDE):

- Ukrycie musi objąć **sidebar, Command Palette i direct routes**. Samo usunięcie pozycji z menu nie wyłącza funkcji.
- Dla każdej ukrytej funkcji zachowanie direct route ma być świadome i przetestowane.
- Dane z modułów pobocznych (Cover Letters, Applications) nadal muszą trafiać do account export.

## A5. Brand i UI w kodzie

**W komponentach używaj semantic tokens, nie ręcznie kopiowanych HEX.**

| Token | HEX | Zastosowanie |
| --- | --- | --- |
| `bg-page` | `#F5F8F2` | Główne tło |
| `bg-surface` | `#FCFDFB` | Karty, formularze, modale |
| `bg-soft-green` | `#EEF3E8` | Pomocnicze surface |
| `bg-lavender` | `#E2C5E7` | Tło sekcji/badge |
| `text-primary` | `#3C4F27` | Główny tekst |
| `text-secondary` | `#66705F` | Tekst pomocniczy |
| `action-primary` | `#4E6B35` | CTA, aktywne elementy, ikony |
| `action-primary-hover` | `#425C2D` | Hover |
| `action-primary-pressed` | `#374D26` | Pressed |
| `accent-brand` | `#DE6E17` | Litera „s”, detal marki — **nie dla małego tekstu** |
| `accent-purple` | `#A878AA` | Dekoracja — **nie jako tekst na lawendzie** |
| `text-purple-accessible` | `#734A75` | Tekst na `bg-lavender` |
| `border-subtle` | `#D9E2D2` | Separatory dekoracyjne |
| `border-control` | `#7E8B76` | Inputy, kontrolki |
| `border-focus` | `#4E6B35` | Focus 2 px |
| `success` / `success-bg` | `#2B7556` / `#E7F3ED` | |
| `warning` / `warning-bg` | `#9B6100` / `#FFF1D6` | |
| `error` / `error-bg` | `#B84444` / `#FBEAEA` | |
| `info` / `info-bg` | `#366A9F` / `#E8F0F8` | |
| `disabled-bg` / `disabled-text` | `#E8ECE5` / `#7A8474` | |

> **Uwaga (N1):** Kompendium, sekcja 9, błędnie nazywa `#3C4F27` „głównym zielonym”. Primary/CTA to **`#4E6B35`**. `#3C4F27` to wyłącznie `text-primary`.

Reguły:

- Typografia: UI/body **Source Sans 3**; H1/H2 i marketing **DM Serif Display**. Wagi 400 + 600 (700 tylko wyjątkowo).
- Skala: H1 48, H2 36, H3 28, body 18, body pomocniczy 16, button/label 16, small 14 (tylko informacje drugorzędne); line-height body 1,5–1,6.
- Sentence case w UI.
- Radius: input 10, button 10–12, card 12, modal 14; pill tylko badge/status.
- Prawie bez cieni (tylko modal/dropdown). Bez gradientów.
- Ikony: rounded outline 1,5–2 px, glyph zawsze `#4E6B35`.
- Spacing: baza 4 px (4, 8, 12, 16, 24, 32, 48, 64…).
- Pomarańczowy nigdy jako podstawowe CTA.
- Focus 2 px bez zmiany rozmiaru komponentu.
- Znaczenie nigdy wyłącznie kolorem; błąd = kolor + komunikat/ikona.
- WCAG AA jako twarde minimum. Przy konflikcie estetyka vs dostępność: zachowaj kierunek, zmień wartość techniczną.
- Logo: nie rekonstruuj zwykłym fontem, nie rozciągaj, nie zmieniaj kolorów. Pełny wordmark od 48 px wysokości; 32–47 px symbol „s”; favicon 16 px ma osobny wariant.

Ton komunikacji w UI:

- Na „Ty”, ciepły profesjonalizm, prosto i konkretnie, bez coachingu, hype'u i presji.
- Komunikaty systemowe: najpierw co się stało i co użytkownik może zrobić.
- Preferowane słowa: historia zawodowa, doświadczenie, dopasowanie, oferta pracy, wybierz, uporządkuj, uzupełnij, dopasuj, sprawdź, zapisz, gotowe.

## A6. Zasady pracy w repozytorium

### Komunikacja agenta

- Raporty pełne i jednoznaczne: co zmieniono, co zweryfikowano, czego nie zweryfikowano, ile kroków zostało.
- Zawsze podawaj SHA, na którym opierasz ocenę.

### Zanim coś zmienisz

- Najpierw ustal źródło prawdy i stan obecny (read-only diagnoza), dopiero potem zmieniaj.
- Sprawdź `git status --short`; nie cofaj plików, których nie dotykasz.
- Przy problemie, który przetrwał kilka poprawek: analizuj cały mechanizm, nie dokładaj kolejnej wąskiej łaty.
- Lokalny HEAD nie jest automatycznie tym, co działa na produkcji (`1story.pl`). Production deployed SHA wymaga osobnej weryfikacji.

### Czego nie robić

- Nie używaj `git reset --hard` ani innych destrukcyjnych operacji na historii bez wyraźnej zgody.
- Nie edytuj `.env`, `.env.local` ani sekretów bez wyraźnego polecenia.
- Nie edytuj ręcznie wygenerowanego `routeTree.gen.ts`.
- Nie twórz kopii plików typu `V2`, `V3`, `FINAL`, `NEW`. Zmieniaj pliki kanoniczne.
- Nie zmieniaj ustalonych reguł projektu ani kontraktów bez wyraźnej akceptacji.
- Nie hardcoduj cen, limitów ani okresów pakietów — mają być konfigurowalne (#62).
- Nie dodawaj zależności od zewnętrznego AI w ścieżkach, które mają działać bez AI.
- Nie uruchamiaj `pnpm check` bez uprzedzenia — jest write-capable (część B, Gotchas).

### Jak dostarczać zmiany

- Wąski zakres: jedna logiczna zmiana na raz, z jasnym kryterium DONE.
- Przy zmianie istniejącego pliku dostarczaj pełną treść pliku, nie fragmenty.
- Każda zmiana w obszarach z sekcji A3 wymaga testu regresji.
- Po zmianie: typecheck i testy dotkniętych pakietów (`pnpm --filter <pakiet> typecheck|test`), a przed release pełne `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec turbo boundaries` na tym samym SHA.

## A7. Otwarte blokery P0 (stan na 2.10.2026)

Dopóki którykolwiek jest otwarty, aplikacja **nie jest gotowa do sprzedaży**.

- [ ] #15–#17 — AI data flow: `sourceTextSnapshot`, pełny audyt tailored-content, inwentaryzacja wszystkich AI callsite'ów (w tym `/agent`, MCP, `packages/ai`).
- [ ] #18 — potwierdzenie providera/modelu AI na produkcji.
- [ ] #24 — spójność resetu hasła (UI / route / backend).
- [ ] #26 — E2E izolacji cache: User A → logout → User B oraz A → B w jednej karcie.
- [ ] #27 — backendowa izolacja zasobów (próby cross-user dla każdego typu zasobu).
- [ ] #2 — regresja edycji Master Profile po commicie `fix(cvmate): confirm master profile changes`.
- [ ] #29–#31 — polityka prywatności zgodna z implementacją (hasło = kryptograficzny hash, nie „zaszyfrowane”; opis danych AI; retencja backupów).
- [ ] #32–#33 — account export i account delete na pełnym koncie.
- [ ] #52–#54 — pełny quality gate i E2E głównego flow na aktualnym SHA; eksport PDF.
- [ ] #57–#59 — production deployed SHA, runbook release/rollback, przetestowany restore.
- [ ] #63 — transactional email (verification, reset) przed sprzedażą. Bez SMTP e-maile trafiają tylko do logów (część B, Gotchas).

## A8. Kierunki zatwierdzone po V1 (K1–K7)

Realizuj dopiero po zamknięciu odpowiednich P0.

| # | Kierunek | Priorytet | Ograniczenia |
| --- | --- | --- | --- |
| K1 / #71 | Import CV i LinkedIn PDF do Master Profile (sprawdź reuse `packages/import`) | P1, przed pilotażem | Redakcja kontaktu i obrazów przed AI; zatwierdzanie każdego faktu |
| K2 / #72 | Źródło każdego zdania w UI | P1, przed pilotażem | Każdy punkt z AI ma klikalne źródło w Master Profile |
| K3 / #73 | Luki jako pytania | P1, w pilotażu | Pytanie otwarte, bez podsuwania odpowiedzi |
| K4 / #74 | Archiwum kariery (przypomnienia) | P2 | Opt-in, wypisanie jednym kliknięciem |
| K5 / #75 | Cennik pakietowy „Bez pułapek subskrypcyjnych” | P1, przed płatnym pilotażem | Domyślnie bez auto-odnawiania; ceny i limity w konfiguracji |
| K6 / #76 | Panel doradcy B2B2C | P2 | Osobna, odwoływalna zgoda klienta; brak mieszania danych |
| K7 / #77 | List motywacyjny z Master Profile | P2 | Adaptacja istniejącego modułu; ten sam kontrakt grounding |

Reguły „Bez pułapek subskrypcyjnych” do implementacji:

1. Brak domyślnego auto-odnawiania; pakiet wygasa.
2. Brak triali zamieniających się w subskrypcję.
3. Cena brutto widoczna przed płatnością.
4. Przypomnienie przed końcem pakietu i przedłużenie jednym kliknięciem.
5. Master Profile, pobrane CV i eksport konta dostępne po wygaśnięciu pakietu.
6. Darmowy PDF bez znaku wodnego.
7. Auto-odnowienie tylko jako świadomy wybór użytkownika, łatwe do wyłączenia.

## A9. Znane niespójności dokumentacji (#78)

| # | Problem | Obowiązująca interpretacja dla kodu |
| --- | --- | --- |
| N1 | Kompendium §9: „główny zielony #3C4F27” | Primary = `#4E6B35`; `#3C4F27` = `text-primary` |
| N2 | Mapa decyzji #41: „brak Brand SoT” | Brand SoT V1 obowiązuje (CLOSED 15.09.2026) |
| N3 | Kompendium §4: „użytkownik sam wpisuje fakty” | Dopuszczalna ekstrakcja AI z dokumentów użytkownika z zatwierdzeniem każdego faktu (K1) |
| N4 | Import CV a granica prywatności | Import podlega tej samej redakcji co `sourceTextSnapshot` |
| N5 | Mapa decyzji #43: Cover Letters P4 | Obecnie P2 (K7) |
| N6 | Brand SoT: jedno CTA „Zbuduj swoją historię zawodową” | Główne CTA bez zmian; drugie CTA „Zacznij od swojego CV” wymaga aktualizacji Brand SoT |

## A10. Definicja „gotowe do sprzedaży”

Funkcjonalne CV + bezpieczne konto + kontrolowany AI data flow + odzyskiwalne dane + powtarzalny release.
Brak któregokolwiek z tych elementów oznacza, że produkt nadal jest betą.

---

# Część B — Technical conventions (from upstream Reactive Resume)

<!-- graphify-begin -->

## Agent skills

- Domain docs use a multi-context layout. See `docs/agents/domain.md` (upstream content — technical reference only; product rules are in Part A).

## Overview

1story is built on the Reactive Resume pnpm monorepo (Turborepo) with two deployable apps: `apps/web` (TanStack Start / React 19 / Vite) and `apps/server` (Hono / Node.js). The production Docker image runs a single Node.js process on port 3000; `apps/server` mounts the API/auth/MCP/static routes and serves the built web app.

Internal packages are source-consumed through `package.json` export maps pointing at `src` files. Do not assume package-local `dist` output exists unless a package explicitly adds it.

Prerequisites: **Node.js 24** (matches Dockerfile `ARG NODE_VERSION=24`), **pnpm 11.21.0** ([install guide](https://pnpm.io/installation)), and **Docker** for PostgreSQL (`sudo dockerd &` if the daemon isn't running).

## Ownership map

Where each concern lives, and where new code for it goes:

| Area | Owner |
|------|-------|
| Web routes, loaders, user-facing workflows | `apps/web/src/routes`, `apps/web/src/features` (file-based; never hand-edit `routeTree.gen.ts`) |
| Server HTTP routes/adapters, startup checks, static handlers, MCP transport, OpenAPI/well-known | `apps/server/src/{http,rpc,mcp,openapi,static,startup}` |
| Authenticated API contracts + business logic | `packages/api/src/features/*` (oRPC routers, DTOs, rate limiting; aggregated at `@reactive-resume/api/routers` for `/api/rpc`) |
| Auth | `packages/auth` (Better Auth config/helpers/types; `apps/server/src/http/auth.ts` delegates to `auth.handler`) |
| DB client + schema | `packages/db` (Drizzle; migrations at repo root `migrations/`) |
| Server env validation | `packages/env` (auto-loads root `.env`) |
| Resume/page/template Zod schemas | `packages/schema` |
| Pure resume-domain behavior (no DB/HTTP/DOM/renderer deps) | `packages/resume` (JSON Patch helpers, social-network icons) |
| Resume PDF rendering | `packages/pdf` (React PDF document, font registration, template primitives, browser/server adapters) |
| PDF.js viewer/canvas UI | `apps/web/src/features/resume` — never in `packages/pdf` |
| DOCX export | `packages/docx` |
| MCP tools/prompts/resources/server-card | `packages/mcp` |
| Generic UI primitives + hooks | `packages/ui` (Base UI/shadcn-style); workflow-specific UI stays in the owning web feature |
| Focused support surfaces | `packages/fonts`, `packages/email`, `packages/import`, `packages/ai`, `packages/utils`, `packages/config` — prefer existing exports over cross-package shortcuts |
| Dev-only scripts | `tooling/`, not `packages/`, so packages only hold runtime-bundled code |

Narrow cross-cutting helpers go in `packages/utils` only after checking no domain package is a better owner. Specifically: resume JSON Patch behavior belongs in `@reactive-resume/resume/patch` and DOCX builders in `@reactive-resume/docx` — not in `@reactive-resume/utils`.

## Web app conventions

- `apps/web/src/router.tsx` initializes router context with `queryClient`, `orpc`, `theme`, `locale`, `session`, and `flags`. Reuse route context instead of refetching these ad hoc.
- Builder shell: `apps/web/src/routes/builder/$resumeId`. Its nested preview route is client-only (`ssr: false`); the public resume route `apps/web/src/routes/$username/$slug.tsx` uses `ssr: "data-only"`.
- Browser-only preview code: `apps/web/src/features/resume/preview`. Public PDF viewer: `apps/web/src/features/resume/public`. Keep PDF.js/canvas/browser APIs out of SSR paths.
- Isomorphic oRPC client: `apps/web/src/libs/orpc/client.ts` — server calls use an in-process router client, browser calls use `/api/rpc` with credentials included.
- For React components with explicit props, use a named props type (e.g. `type FooProps = {...}` with `function Foo(props: FooProps)`) rather than inline object annotations, especially with more than one field or with generics.

## Package boundaries

`pnpm exec turbo boundaries` is the executable check. Rules:

- Workspace deps go through package names and export maps. Never import another workspace's `src` tree via repo paths, `@reactive-resume/*/src/*`, or TS path aliases.
- Workspace `turbo.json` files declare coarse tags: `app:web`, `app:server`, `runtime:server` (server-only packages: API/auth/db/env/email/MCP), `runtime:browser` (browser-only shared UI), `runtime:universal` (environment-neutral domain packages), plus `role:domain|infra|adapter|api|rendering|tooling` for intent.
- Runtime-specific code lives behind explicit export subpaths (`@reactive-resume/pdf/browser`, `@reactive-resume/pdf/server`, `@reactive-resume/env/server`). Keep root exports environment-neutral unless the package is intentionally server-only.
- Wildcard exports are allowed only for leaf libraries with an intentionally file-like surface — currently `@reactive-resume/ui/components/*`, `@reactive-resume/ui/hooks/*`, and schema resume model files. Prefer explicit exports for packages owning runtime behavior.
- Prefer `protectedProcedure` from `packages/api/src/context.ts` for authenticated procedures. Expose only intentional public surfaces through `packages/api/package.json`.
- Shared PDF section filtering: `packages/pdf/src/templates/shared/filtering.ts`. Template-specific visual exceptions stay in the owning template directory unless multiple templates need the behavior. `packages/pdf/src/hooks/use-register-fonts.ts` owns font registration, standard PDF fonts, CJK fallback stacks, and global hyphenation.

Multi-place changes:

- **Resume data shape**: `packages/schema/src/resume/*` first, then API DTOs, importers, PDF rendering, and web forms consuming it.
- **New template**: `packages/schema/src/templates.ts`, `packages/pdf/src/templates/index.ts`, source under `packages/pdf/src/templates/<name>/`, and previews under `apps/web/public/templates/{jpg,pdf}`.
- **New DB column/table**: `packages/db/src/schema/*`, then `dotenvx run -f .env.local -- pnpm db:generate`.
- **New env var**: `packages/env/src/server.ts` **and** the `globalEnv` array in `turbo.json`. Turborepo 2.x strict env mode filters out unlisted vars, so the variable will be `undefined` in child processes at runtime even when correctly set in the OS/container environment.

## Environment and database

Copy `.env.example` to `.env.local`. Three required vars: `APP_URL` (default `http://localhost:3000`), `DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/postgres`), `AUTH_SECRET` (any non-empty string).

- **S3/SeaweedFS optional.** If `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_BUCKET` are all set, the app uses S3-compatible storage. `.env.example` ships SeaweedFS defaults, so either start the `seaweedfs` compose service or comment those vars out to use local filesystem storage under `<workspace>/data`. `LOCAL_STORAGE_PATH` must be absolute when set.
- **`REDIS_URL` and `ENCRYPTION_SECRET`** are optional for core resume flows but both required for saved AI providers and the authenticated `/agent` workspace. Host-run dev uses `REDIS_URL=redis://localhost:6379`; the container-run app uses `redis://redis:6379`.
- **`drizzle-kit` (used by `pnpm db:migrate`) reads `DATABASE_URL` from `process.env` directly** — it does not auto-load `.env`. Run migration commands through `dotenvx`.
- The production server auto-runs migrations at startup before serving traffic, so manual `pnpm db:migrate` is mainly for first setup, migration debugging, or applying migrations without starting the app.

## Commands

Prefix dev servers and migration commands with `dotenvx run -f .env.local --`. Tests, typechecks, linters, boundary checks, and `pnpm build` do not need it; if one fails on a missing env var, rerun it with the prefix.

```
sudo docker compose -f compose.dev.yml up -d postgres                                    # DB only
sudo docker compose -f compose.dev.yml up -d postgres redis seaweedfs seaweedfs_create_bucket   # full infra
dotenvx run -f .env.local -- pnpm dev            # port 3000 (dev:web for web only)
dotenvx run -f .env.local -- pnpm db:generate    # db:migrate to apply
pnpm check                                       # Biome — WRITE-CAPABLE (--write --unsafe)
pnpm test | pnpm typecheck | pnpm build | pnpm exec turbo boundaries
```

Prefer package filters over repo-wide runs, e.g. `pnpm --filter web typecheck`, `pnpm --filter @reactive-resume/pdf test`. Vitest paths are package-relative under `pnpm --filter <package> test -- <path>`.

## Gotchas

- Email sending needs SMTP config; without it emails are logged to console. Dev still works — verification links appear in server logs.
- `lefthook.yml` pre-commit runs `biome check` on staged files. Run `pnpm check` before committing.
- `pnpm check` is write-capable. Call that out when using it, and use narrower Biome commands for a non-mutating inspection.
- Biome: tabs, double quotes, line width 120, organized import groups, sorted Tailwind classes for `clsx`, `cva`, `cn`.
- Most packages typecheck with `tsgo --noEmit` and test with `vitest run --passWithNoTests`.
- There may be unrelated local edits in the worktree. Check `git status --short` first; do not revert files you did not touch.
