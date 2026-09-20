# Finanzplaner-PWA

Private Ein-Nutzer-Finanz-App (AUD, wöchentlicher Rhythmus). Kein Backend, keine Auth. Ziel: installierte PWA auf iPhone + MacBook.
Plan & Phasenstatus: `docs/PLAN.md` – **nur an der freigegebenen Phase arbeiten**, Checkboxen dort pflegen.

## Stack

Vite 8 · React 19 · **TypeScript ~6.0 (gepinnt – TS 7 erst, wenn typescript-eslint es unterstützt; kein `baseUrl`)** · Tailwind v4 (CSS-first, Tokens in `src/styles/tokens.css`) ·
shadcn/ui (Stil `radix-nova`, `src/shared/ui`) · Zustand (nur UI-State) · Dexie 4 + dexie-react-hooks · Recharts 3 (+ react-is) · date-fns 4 · motion (`motion/react`) ·
sonner · lucide-react · zod · vite-plugin-pwa · Vitest + fake-indexeddb + Testing Library · react-router 8 (`react-router`, `react-router/dom`) ·
ESLint 10 + typescript-eslint (nicht Oxlint – wir brauchen `no-restricted-syntax`/-`imports` pro Ordner) · Prettier + `prettier-plugin-tailwindcss` ·
Deployment: Vercel (statisch, Projekt `finance-planner` im Team `jonasworkings-projects`, per Git mit `Jonasworking/finance-planner` verbunden: Push auf `main` = Production, jeder andere Branch = Preview; `vercel.json` enthält den SPA-Rewrite). Paketmanager: npm. Kein `framer-motion`, kein `react-router-dom`, kein `next-themes` (eigener `themeStore`).
`vaul` kommt nur indirekt über den shadcn-Drawer (Radix-Basis nutzt weiterhin vaul) und wird ausschließlich in `shared/components/ResponsiveSheet.tsx` verwendet → dort austauschbar.
Pakete werden pro Phase installiert (Dexie/zod/date-fns → Phase 1, Recharts → Phase 4, vite-plugin-pwa → Phase 6).

## Befehle

`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run test` (einzeln: `npx vitest run src/lib/money.test.ts`) · `npm run test:coverage` (Schwellen für `src/lib`: 90 % Zeilen/Funktionen, 80 % Branches) · `npm run format`
**Jeder Test läuft zweimal** – als Vitest-Projekt `sydney` und `berlin` (`TZ` gesetzt): Kalenderlogik darf weder vom UTC-Offset noch von DST abhängen. Nur eine Zone: `npx vitest run --project sydney`.
Neue shadcn-Komponente: `npx shadcn@latest add <name>` → danach **immer** `npm run ui:fix-imports` (sonst schlägt der Lint fehl, siehe `cn`-Regel).

## Architektur – wo liegt was

- `src/lib` – **gesamte Fachlogik als reine Funktionen**. Kein React, kein Dexie, kein `Date.now()`/`new Date()` ohne Parameter (`today`/`now` reinreichen). Jede Funktion hat Tests (`*.test.ts` daneben). **Die Domänen-Typen liegen hier** (`lib/types.ts`, inkl. `SCHEMA_VERSION`, `PRIMARY_POT_ID`), weil `lib` nicht aus `db` importieren darf.
  Module: `money` · `dates` · `ids` · `expenses` · `budget` · `recurrence` · `savings` (`summarizeWeek`, Topfstände, `pendingWeeks`) · `streak` · `forecast` · `whatif` · `analytics` · `amountInput` (Numpad-Zustandsmaschine) · `tags` (Normalisierung, Autocomplete) · `insights` (strukturiert: `kind` + Daten, Text rendert die UI) · `ledger` (`checkLedgerInvariants`) · `csv` · `backup` (zod-Schema, per Typ-Assertion an `AppData` gekoppelt).
- `src/db` – Dexie-Schema (`schema.ts`), Seeds (`seed.ts`), Repos (`repos/`), `queries.ts` (`loadAppData`), `demo.ts` (12 Demo-Wochen, nur Dev/Tests). **Einziger Ort mit Dexie-Schreibzugriff**; Mehr-Tabellen-Operationen in einer `rw`-Transaktion über `ledgerTables`, darin nur Dexie-`await`s.
  Schreib-API: `repos.expenses.add/update/remove/restore` · `repos.weeks.setIncome/close/reopen` · `repos.pots.create/update/archive/deposit/withdraw/transfer/removeTransaction` · `repos.recurring.create/update/remove/materialize(today)` · `repos.budgets.set(today, …)` · `repos.categories` · `repos.tasks` · `repos.settings` · `repos.backup.export/import/restoreSafetyCopy/wipeAll`. Regelverstöße werfen `DomainError` mit `code` (UI übersetzt den Code).
  **Nadelöhr:** jede Ausgaben-Mutation endet in `writeExpense` (`db/repos/context.ts`) → Funding-Spiegel `fund:<id>` + `syncWeekDerived` für alte UND neue Woche. Nie an `db.expenses` vorbei schreiben.
  Tests: `createRepos(new FinanceDB('name'), fakeClock)` gegen fake-indexeddb; `afterEach` prüft `checkLedgerInvariants(await loadAppData(db))` – bei neuen Repo-Tests beibehalten.
- `src/features/<name>` – UI + Hooks. Ein `useLiveQuery`-Querier pro Screen (Lese-Funktionen in `db/queries.ts`: `loadExpensesOfWeek`, `loadExpenseFormData`, `loadCategories`); `undefined` = lädt, `null` = nicht gefunden. Cross-Feature-Importe nur über `index.ts`.
  Liefert eine Abfrage zu einer wechselnden ID (z. B. Bearbeiten-Sheet), gehört die ID ins Ergebnis – `useLiveQuery` hält nach dem Wechsel kurz die alte Antwort.
  `repos.backup` wird lazy geladen (zod + Ledger ≈ 28 KB gzip in eigenem Chunk) – Backup-Code nie statisch in den Startpfad importieren.
- `src/shared` – `ui/` (shadcn, generiert), `components/`, `hooks/`, `stores/`, `lib/utils.ts`. Importiert nie aus `features`. Darf `src/lib` importieren.
- `src/app` – Router, Provider, Shell (`AppShell`, `BottomTabs`, `Sidebar`, `MorePage`), Dev-Styleguide `/dev/tokens` (nur Dev-Build). Features importieren nie aus `app`.
- Die Schichtenregeln sind in `eslint.config.js` erzwungen (inkl. Datums-/Uhr-Verbote); Ordner-Configs **ersetzen** die Regel, daher neue Verbote dort überall ergänzen.
- **`cn` immer aus `@/shared/lib/utils`** – nie das nackte Paket `"cn"`: nur die konfigurierte Variante kennt unsere Schriftgrößen (`text-display|h1|h2|body|label|caption`); sonst verwirft der Merger sie neben Textfarben. Neue `--text-*`-Tokens dort nachtragen (Test: `shared/lib/utils.test.ts`).
- Seiten nutzen `<Page title=…>` (Sticky-Glas-Header + Content-Spalte); Buttons auf Touch-Screens `size="touch"` / `"icon-touch"` (44 px).
- Shared-Bausteine: `Money` · `GlassCard` · `ProgressRing` · `ResponsiveSheet` · `Numpad` (Betrag ist Text, kein `<input>`; Tasten auf `pointerdown`) · `SwipeRow` (Wisch = löschen, kurzer Wisch = Button zeigen; **schluckt den Klick nach einem Drag** – sonst öffnet der Wisch die Zeile) · `TagInput` · `CategoryIcon` + `shared/lib/categoryStyle.ts` (Icon-Registry und Farbklassen als vollständige Strings – nie `bg-${color}` bauen) · `errorMessage(error)` für `DomainError`-Codes.
- Sheets mit Formular: Formular per „Session"-Zähler keyen, der beim **Öffnen** hochzählt (`uiStore.quickAddSession`/`editSession`) – nicht am `open`-Flag, sonst springt der Inhalt während der Schließ-Animation. Ein Sheet ohne Inhalt nie offen lassen: ein Modal-Overlay blockiert alles darunter, auch den Undo-Toast.
- Löschen fragt nie vorher nach, sondern bietet „Rückgängig" im Toast (`deleteExpenseWithUndo`).
- Komponenten berechnen nichts Fachliches selbst – fehlt Logik, kommt sie nach `lib` (mit Test). „Heute" kommt aus `useToday()`.

## Domänenregeln

- Geld = Integer-Cents (`…Cents`); Anzeige nur über `formatAUD` / `<Money>` → `A$1.600,00`. EUR nur Anzeige (`Settings.eurRate`).
- Kalendertage = lokale `YYYY-MM-DD`-Strings, nur über `lib/dates.ts`. **Verboten:** `new Date('YYYY-MM-DD')`, `toISOString().slice(0,10)`, Millisekunden-Arithmetik. Wochenstart fix **Montag**; `Week.id` = weekStart.
- Jede Zeile: `id`, `createdAt`, `updatedAt`, `deletedAt` (Soft-Delete; Lesezugriffe filtern Tombstones). Sync-fähig halten.
- Deterministische IDs: `pot:primary`, `cat:<slug>`, `auto:<weekStart>`, `fund:<expenseId>`, `tr:<id>:out|in`, `rec:<recurringId>:<date>`.
- Wochenkennzahlen immer aus Rohdaten (`lib/savings.summarizeWeek`), keine Snapshots. Jede Mutation läuft durchs Repo-Nadelöhr → `syncWeekDerived` für alle betroffenen abgeschlossenen Wochen (alt + neu).
- Topf-finanzierte Ausgaben (`fundedByPotId`) zählen nicht zu Budget, Streak, Wochen-Sparsumme. Topfstand = Summe vorzeichenbehafteter Buchungen.
- Budget ist „gültig ab" (`resolveBudget`), geschrieben wird nur mit `id = aktuelle Woche`. Monats-KPIs = Donnerstags-Regel, nur abgeschlossene Wochen.
- Recurring: `bulkGet`-Filter + `bulkAdd`, nie `bulkPut`. Wipe = `db.delete()` + Reload. Nach Import: `checkLedgerInvariants` + Reload.
- Dexie: ausgelieferte Version nie ändern → neue `version(n+1)` + `upgrade` + Migrationstest; `SCHEMA_VERSION` + `migrateBackup` mitziehen.

## Konventionen

- Komponenten `PascalCase.tsx`, eine pro Datei, Named Exports; Hooks `useXyz.ts`; lib/Repos `camelCase.ts`; Tests `*.test.ts(x)` neben der Quelle.
- Suffixe: `…Page` (Route), `…Sheet` (Bottom-Sheet/Dialog), `…Card`, `…List`/`…Row`. Props-Typ `XyzProps`. Kein `any`, kein Default-Export (außer lazy Routen).
- UI-Texte Deutsch, Code/Kommentare/Commits Englisch.
- **Keine unsichtbaren Sonderzeichen als Literal** (BOM, geschütztes Leerzeichen, U+FFFF …) und keine `\u…`-Escapes über Schreib-Tools – die werden beim Schreiben still in das echte Zeichen verwandelt. Stattdessen `String.fromCharCode(0xfeff)` bzw. `Dexie.minKey/maxKey`. Prüfen: `LC_ALL=C grep -rln $'\xEF\xBB\xBF\|\xC2\xA0\|\xEF\xBF\xBF' src`.
- Test-Fixtures: `src/test/fixtures.ts` (`makeExpense`, `makeWeek`, `makeTx`, … mit festem `NOW`).
- Commits: Conventional Commits mit Feature-Scope – `feat(expenses): quick-add sheet`, `fix(lib): clamp monthly recurrence`, `test(db): closeWeek idempotency`, `chore: …`. Klein & thematisch; Logik und Test im selben Commit; vorher typecheck + lint + test grün. Branch pro Phase `phase-N-kurzname`. **Push nach `origin` ist generell freigegeben** (seit 2026-09-20); `main` wird erst nach Abnahme einer Phase per Fast-Forward aktualisiert und gepusht.

## Design

Dark = Default, Light via `[data-theme='light']`. Tokens **nur** aus `tokens.css` (keine Hex-Werte in Komponenten):
bg `#0B0C0F` · surface-1/2/3 `#14161A/#1B1E24/#252932` · fg `#F5F6F8` · fg-muted `#9AA1AE` ·
**saved/Mint `#3EE0A8`** (auch Primary-CTA) · **spent/Coral `#FF6F61`** · **income/Periwinkle `#8AA4FF`** · warning `#FFB84D` · danger `#FF5A52` · `cat-1…10`.
Radien 10/14/20 (Card)/28 (Sheet) · 4-px-Raster, Seitenrand 16/32 px · Touch-Ziel ≥ 44 px · Inter Variable, Beträge immer `tabular-nums`, Display 44/48-700.
Mobile-first: BottomTabs < `lg`, Sidebar ≥ `lg`; `ResponsiveSheet` statt Modals; Shell = Grid + innerer Scroller (kein `position: fixed`), Safe-Areas, `100dvh`; Inputs ≥ 16 px; Numpad-Betrag ist kein `<input>`.
Motion: Springs aus `shared/motion.ts` (`snappy`/`soft`/`bouncy`), `whileTap scale .97`, `reducedMotion="user"`. Glas nur für Tab-Bar/Sticky-Header/Sheet-Griff.
Listen: Swipe-to-delete immer mit Undo-Toast. Ladezustände: Skeletons, nie Spinner-Seiten. Vor Chart-Code den `dataviz`-Skill laden.
