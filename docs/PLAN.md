# Phasenstatus

> Arbeitskopie des am 2026-09-20 freigegebenen Plans. Jede Phase startet erst nach ausdrücklicher Freigabe durch den Nutzer. Checkboxen nach Abschluss einer Phase pflegen; Abweichungen vom Plan hier unter der jeweiligen Phase notieren.

- [x] Plan freigegeben (2026-09-20)
- [x] `CLAUDE.md` + `docs/PLAN.md` angelegt
- [x] Offene Fragen §6 beantwortet (unbeantwortet = Annahme gilt) — beantwortet: 1 (Radix), 3 (selbstständig committen, `main`, Push nur auf Ansage), 10 (Inter self-hosted), 2 (Minus-Woche negativ buchen), 6 (alle Kategorien zählen; 10 Start-Kategorien wie vorgeschlagen), 4 (Onboarding fragt nach Startguthaben → Einzahlung in „Nur gespart"), 5 (Lohn zählt für die Woche, die abgeschlossen wird – nicht für die Auszahlungswoche), 9 (Vercel schon ab Phase 2; braucht vom Nutzer ein privates GitHub-Repo + Vercel-Login; Preview-URLs = Wegwerf-Daten), 7 (keine Topf-Automatik in v1), 8 („Finanzplaner" mit Mint-Ring-Icon) — **alle beantwortet**
- [x] **Phase 0** – Setup, Tokens, Layout-Shell — abgeschlossen 2026-09-20 (Branch `phase-0-setup`, in `main`), Notizen unten
- [x] **Phase 1** – Datenmodell, Kernlogik, Tests — abgeschlossen und abgenommen 2026-09-20 (Branch `phase-1-data-logic`, in `main`), Notizen unten
- [ ] **Phase 2** – Einkommen & Ausgaben — vom Nutzer in zwei Teile geteilt:
  - [x] **2a** – QuickAdd-Sheet mit Numpad, Ausgabenliste mit Swipe-to-delete + Undo, Bearbeiten-Sheet, Kategorienverwaltung, Tags mit Autocomplete, Vercel-Anbindung — fertig 2026-09-20 (Branch `phase-2a-expenses`), _wartet auf Abnahme – Nutzer testet am iPhone; Merge nach `main` erst nach ausdrücklicher Abnahme_, Notizen unten
  - [ ] **2b** – Daueraufträge (UI + Materialisierung beim App-Start), „Woche abschließen", Onboarding (inkl. Startguthaben), Dashboard v1 — _wartet auf Freigabe_
- [ ] **Phase 3** – Budget & Spartöpfe
- [ ] **Phase 4** – Analyse & Charts
- [ ] **Phase 5** – Tasks, Insights, Was-wäre-wenn
- [ ] **Phase 6** – PWA, Export, Polish
- [ ] Phase 7 (optional) – Sync

## Phase 0 – Ergebnis & Abweichungen vom Plan

**DoD geprüft:** typecheck · lint · 23 Tests · build grün · Shell bei 390×844 und 1440×900 ohne horizontales Scrollen · Dark/Light ohne Flash (getestet mit blockiertem App-Bundle: `data-theme`, Hintergrund und `theme-color` stehen vor dem ersten Paint, auch für „System") · `/dev/tokens` zeigt Farben, Typo, Radien, Beträge, Buttons, Card, Ring, Glas, Sheet, Toast · `formatAUD`-Tests · Konsole fehlerfrei. Lint-Regeln per Negativtest bewiesen (8 absichtliche Verstöße → 8 Fehler).

- **Browser-Prüfung:** Die Chrome-Erweiterung war nicht verbunden → Screenshots/Metriken stattdessen mit lokalem Headless-Chrome (puppeteer-core im Scratchpad, nicht im Projekt). Echtes iPhone-Rendering (Safe-Areas, Blur) ist damit **nicht** geprüft → erster Gerätetest sobald eine HTTPS-URL steht (§6 Frage 9).
- **Linter:** ESLint + typescript-eslint statt Oxlint (Template-Option `--eslint`), weil Schichtenregeln pro Ordner und `no-restricted-syntax` gebraucht werden.
- **`vaul` ist doch dabei:** Mit Radix-Basis baut shadcn den Drawer weiterhin auf vaul (Base-UI-Drawer nur bei `-b base`). Funktioniert mit React 19; gekapselt in `ResponsiveSheet`, dort später austauschbar. `next-themes` (kam mit sonner) wurde entfernt → eigener `themeStore`.
- **Neues shadcn-Paket `cn`** (offiziell, `shadcn-ui/cn`, ersetzt clsx + tailwind-merge). Unkonfiguriert verwirft es unsere Schriftgrößen neben Textfarben (`cn('text-label','text-fg-muted')` → `text-fg-muted`). Fix: konfigurierte `cn` in `shared/lib/utils.ts` (+5 KB gzip), Lint-Verbot des nackten Imports, `npm run ui:fix-imports` nach jedem `shadcn add`, Regressionstest.
- **Struktur:** shadcn-Helfer liegen in `src/shared/lib` (nicht `src/lib` – das bleibt reine Fachlogik). `PageHeader` wurde zu `shared/components/Page` (Features dürfen nicht aus `app/` importieren). Button hat zusätzliche Größen `touch`/`icon-touch` (44 px).
- **Pakete pro Phase:** In Phase 0 nur das Nötige installiert; Dexie/zod/date-fns folgen in Phase 1, Recharts in Phase 4, vite-plugin-pwa in Phase 6.
- **Merker für Phase 6:** Bundle aktuell 196 KB gzip (Budget 250 KB; Dexie + zod kommen noch) → ggf. `LazyMotion` und Lazy-Routes. PWA-Precache auf `inter-latin*`-Dateien beschränken (Fontsource liefert alle Schriftsysteme; zur Laufzeit lädt der Browser dank `unicode-range` ohnehin nur Latin).

## Phase 1 – Ergebnis & Abweichungen vom Plan

**DoD geprüft:** typecheck · lint · build grün · **374 Testläufe** (187 Tests × Zeitzonen `Australia/Sydney` + `Europe/Berlin`; ein Harness-Test beweist, dass die Zone wirklich aktiv ist) · Coverage `src/lib`: 99,8 % Zeilen, 100 % Funktionen, 94 % Branches (Schwellen 90/90/80 im Vitest-Config) · alle Pflicht-Testfälle aus §3 vorhanden · Repo-Tests gegen fake-indexeddb: `closeWeek` idempotent, Nadelöhr synct alte + neue Woche, Transfer atomar, Funding-Kaskade, Recurring idempotent (auch bei parallelem Doppelaufruf), Soft-Delete/Restore, Import-Rollback, Wipe → Seeds zurück · `checkLedgerInvariants` läuft nach **jedem** Repo-Test und ist auf den Demo-Daten grün · Lint beweist: kein React/Dexie in `lib`. Gegenprobe per Mutation (Sync der alten Woche entfernt) → vom gezielten Test UND vom Ledger-Check erkannt.

- **Typen liegen in `src/lib/types.ts`** statt `src/db/types.ts`: `lib` darf nicht aus `db` importieren, braucht die Typen aber. Dort auch `SCHEMA_VERSION` und `PRIMARY_POT_ID`.
- **Datums-Anker Mittag:** `parseISODate` erzeugt lokale Daten um 12:00 statt Mitternacht – bleibt auch in Zeitzonen korrekt, deren DST-Wechsel um Mitternacht liegt. Ungültige Tage (`2026-02-30`) werden abgelehnt statt still zu überlaufen.
- **Insights sind strukturiert** (`kind` + Daten, `id` für „wegwischen", `priority`), den deutschen Text rendert die UI in Phase 5. Kategorie-Schnitt zählt nur Wochen, die schon erfasst sind (neue Nutzer werden nicht unterschätzt).
- **„Reserviert" folgt dem Wasserzeichen** der Vorlage statt „heute": eine heute fällige Miete zählt auch, wenn der Materialisierer noch nicht lief; bewusst gelöschte Instanzen kommen nicht zurück.
- **Sparprognose-Tempo** (`weeklyPace`): Netto-Zuflüsse inkl. Umbuchungen in beide Richtungen, aber ohne Entnahmen und topf-finanzierte Ausgaben (Konsum ist kein Spartempo); junge Töpfe werden über ihr eigenes Alter gemittelt.
- **Zusätzliche Schutzregeln:** topf-finanzierte Ausgabe/Entnahme/Umbuchung überzieht nie einen Topf; das Löschen einer Einzahlung darf einen Topf nicht ins Minus bringen; abgeleitete Buchungen (`auto:`, `fund:`) sind nicht direkt löschbar; Einkommen einer abgeschlossenen Woche lässt sich nicht auf „leer" setzen. `auto:`-Buchung wird nur geschrieben, wenn sich etwas ändert (Live-Queries bleiben ruhig); auch eine 0-A$-Woche bekommt eine Buchung (Invariante „genau eine je abgeschlossener Woche").
- **Backup:** enthält alle Zeilen inkl. Tombstones (echter 1:1-Roundtrip) und verlangt genau eine Settings-Zeile. Import prüft vor der Transaktion zusätzlich den Ledger; Sicherheitskopie liegt in separater DB `<name>-safety`; `wipeAll` löscht auch diese.
- **Werkzeug-Falle:** `\u…`-Escapes wurden beim Schreiben still zu echten (teils unsichtbaren) Zeichen. BOM, NBSP und U+FFFF stehen jetzt als `String.fromCharCode(…)` bzw. `Dexie.minKey/maxKey` im Code; Regel + Prüfbefehl in `CLAUDE.md`.
- **Noch nicht verdrahtet:** Die App nutzt `db`/`repos` noch nicht (Bundle unverändert 196 KB gzip) – das passiert in Phase 2; dort auch `dexie-react-hooks`, `useToday()` und ein Dev-Button für `seedDemoData`.

## Phase 2a – Ergebnis & Abweichungen vom Plan

**Geprüft:** typecheck · lint · build grün · 414 Testläufe (207 Tests × 2 Zeitzonen), darunter RTL-Tests des Ausgaben-Formulars (Numpad, Hardware-Tastatur, Details/Tags, Bearbeiten-Modus) · Coverage `src/lib` 99,8 % Zeilen · **12 Browser-Checks im echten Chrome** (Headless, 390×844 + 1440×900): Schnellerfassung legt Zeile an und bietet Undo · Wisch löscht · Wisch öffnet KEIN Sheet · Undo stellt wieder her · kurzer Wisch zeigt nur den Löschen-Button · Tipp darauf schließt ihn · Tipp öffnet Bearbeiten mit gespeichertem Betrag · Kategorie-Sheet · Desktop: `N` + Tastatur-Eingabe · kein horizontales Scrollen · Konsole fehlerfrei.

- **Vercel:** Die Vercel-Anbindung der Session war bereits angemeldet → kein `vercel login` nötig. Projekt `finance-planner` (Team `jonasworkings-projects`) ist per Git mit dem Repo verbunden: `main` = Production (`finance-planner-jonasworkings-projects.vercel.app`), jeder Branch = Preview (`finance-planner-git-<branch>-jonasworkings-projects.vercel.app`). `vercel.json` mit SPA-Rewrite liegt bis zur Abnahme nur auf dem 2a-Branch. Previews waren anfangs durch Vercel-Login geschützt; **auf Wunsch des Nutzers am 2026-09-20 abgeschaltet** (`ssoProtection: null`). Die Vercel-API kennt keine Variante „nur Production schützen", daher ist der Login-Schutz für das ganze Projekt aus – alle Deployment-URLs sind öffentlich erreichbar (nur Code; Daten liegen im Browser, auf Previews sind es Demo-Daten). Wieder einschalten: Vercel → Project Settings → Deployment Protection → Vercel Authentication.
- **Gefundener Fehler (im Browser-Test, nicht in Unit-Tests sichtbar):** Nach einem Wisch feuert der Browser noch ein `click` auf die Zeile → das Bearbeiten-Sheet öffnete sich leer für die gerade gelöschte Ausgabe, sein Overlay verdeckte den Undo-Toast. Fix: `SwipeRow` schluckt den Klick nach einem Drag (und schließt bei Tipp eine aufgewischte Zeile); `EditExpenseSheet` schließt sich selbst, wenn seine Ausgabe nicht mehr existiert.
- **Regression jetzt im Repo abgesichert** (vorher nur per Browser-Skript im Scratchpad): `shared/components/SwipeRow.test.tsx` simuliert einen echten Pointer-Drag in jsdom (langer Wisch löscht und der Folge-Klick wird verschluckt; kurzer Wisch zeigt nur den Button, Tipp schließt ihn, danach ist ein Tipp wieder ein Tipp) und `features/expenses/components/EditExpenseSheet.test.tsx` prüft gegen echte Live-Queries, dass sich das Sheet schließt, wenn seine Ausgabe gelöscht wird oder schon weg ist, dass ein veraltetes „nicht gefunden" die nächste Ausgabe nicht schließt, und dass es nach Undo wieder öffnet. Per Mutation gegengeprüft: ohne Klick-Schlucken fallen 2 Tests, ohne Selbstschließen 3, ohne ID-Abgleich genau 1. 5 Wiederholungen + 2 volle Suite-Läufe stabil. Testzahl damit 432 Läufe (216 × 2 Zeitzonen).
- **Tags** werden klein geschrieben und ohne `#` gespeichert („#Coffee Run" → `coffee run`), damit Autocomplete und spätere Auswertungen nicht an Schreibweisen scheitern.
- **Kategorie-Icons:** kuratierte Registry mit 38 lucide-Icons statt dynamischem Import nach Name (der würde alle Icons bündeln). Sortieren per Drag am Griff; per Tastatur ist Umsortieren noch nicht möglich (Merker für den A11y-Pass in Phase 6).
- **Dev-Werkzeuge:** Einstellungen zeigen im Dev-Build „Demo-Daten laden" / „Alles löschen" (in Production-Builds nicht enthalten).
- **Bundle:** Start-Chunk 260 KB gzip (Dexie, date-fns, dexie-react-hooks und die neuen Screens kamen dazu); Backup/zod wurde in einen Lazy-Chunk (28 KB) ausgelagert. Ziel < 250 KB bleibt Aufgabe von Phase 6 (Lazy-Routes, `LazyMotion`).
- **Nicht gebaut (gehört zu 2b):** Daueraufträge-UI, Materialisierung beim App-Start, Wochenabschluss, Onboarding, Dashboard v1 – das Dashboard zeigt weiter die statische Vorschau mit Beispielwerten.

---

# Plan: Finanzplaner-PWA (`finance-planner`)

## Context

Private Ein-Nutzer-Finanz-App für das Leben in Australien (wöchentliche Auszahlung ~A$2.000). Kern-Loop: unter der Woche Ausgaben tracken → am Wochenende **„Woche abschließen"** (Netto-Betrag bestätigen) → App bucht `Einkommen − Ausgaben` automatisch in den Primär-Topf **„Nur gespart"**. Dazu Wochenbudget mit Warnungen/Streak, Spartöpfe mit Prognose, Analyse, Was-wäre-wenn, Tasks, Insights, Backup. Kein Backend, keine Auth, installierte PWA auf iPhone (primär) + MacBook. Repo ist leer (nur `.git`, Branch `master`, keine Commits) – Greenfield. Dieser Plan wird **Phase für Phase von dir freigegeben**; gebaut wird erst nach Freigabe.

**Bereits mit dir geklärt (2026-09-20):**

| Thema                 | Entscheidung                     | Konsequenz im Plan                                                                                                                                                                                                                     |
| --------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geräte-Sync           | „Später echter Sync"             | Datenmodell ab v1 sync-fähig (String-IDs, `updatedAt`, Soft-Delete/Tombstones, deterministische IDs für Seeds + abgeleitete Datensätze). Sync selbst = optionale **Phase 7**; bis dahin JSON-Backup als Transportweg iPhone → MacBook. |
| Hosting               | Vercel                           | `createBrowserRouter` + SPA-Rewrite, kein Base-Path.                                                                                                                                                                                   |
| Große Einmal-Ausgaben | „Aus Topf bezahlt"               | `Expense.fundedByPotId` → verknüpfte Topf-Entnahme; zählt nicht gegen Budget/Streak und nicht in `gespart = Einkommen − Ausgaben` (sonst Doppelabzug).                                                                                 |
| Einkommen             | Ein Netto-Direktbetrag pro Woche | Eigene `WeekIncome`-Tabelle entfällt → Feld `incomeCents` auf dem `Week`-Datensatz. Stunden/Stundensatz/Brutto/Arbeitgeber gestrichen (später per Dexie-Version nachrüstbar).                                                          |

Der Entwurf wurde von einem Review-Agenten gegengeprüft (Peer-Dependencies real per `npm view`, Datenmodell-Edge-Cases, iOS-Fallen); die Ergebnisse sind unten eingearbeitet.

---

## 0. Stack (verbindlich) + geprüfte Versionen

Stand `npm view` 2026-09-20 · lokal Node 26.4 / npm 11.17 · Paketmanager **npm**.

| Paket                                            | Version                  | Anmerkung                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vite · @vitejs/plugin-react                      | 8.3 · 6.1                |                                                                                                                                                                                                                                                               |
| react / react-dom                                | 19.3                     |                                                                                                                                                                                                                                                               |
| **typescript**                                   | **`~6.0.3` (nicht 7.0)** | TS 7 (nativer Compiler) hat noch keine Compiler-API → `typescript-eslint` verlangt `<6.1.0` (verifiziert); auch das aktuelle Vite-Template pinnt 6.0. `tsconfig`: nur `paths {"@/*": ["./src/*"]}`, **kein `baseUrl`** (in TS 7 ein Fehler → zukunftssicher). |
| tailwindcss + @tailwindcss/vite                  | 4.3                      | **v4 ist CSS-first:** Tokens als `@theme` in CSS statt `tailwind.config.ts` – das ist die v4-Entsprechung deiner „Tailwind-Config"-Anforderung und das, was shadcn erwartet.                                                                                  |
| shadcn CLI                                       | 4.21                     | `npx shadcn@latest init -t vite -b radix` (Basisbibliothek ist inzwischen Init-Option → Radix laut deiner Vorgabe, siehe §6 Frage 1); `aliases.ui = "@/shared/ui"`. `style`/`baseColor` sind nach Init nicht änderbar.                                        |
| zustand · dexie · dexie-react-hooks              | 5.0 · 4.4 · 4.4          | Zustand nur UI-State; Daten über `useLiveQuery`.                                                                                                                                                                                                              |
| recharts (+ `react-is`) · date-fns               | 3.10 · 4.4               | `react-is` ist Peer von recharts → explizit installieren. Analytics-Route lazy.                                                                                                                                                                               |
| vite-plugin-pwa · @vite-pwa/assets-generator     | 1.3 · **`^1.0.4`**       | Plugin peer-t `assets-generator ^1` (v2 wäre außerhalb der Range).                                                                                                                                                                                            |
| **motion**                                       | 13.4                     | Nachfolge-Paket von „framer-motion"; Import `motion/react`.                                                                                                                                                                                                   |
| vitest · fake-indexeddb · @testing-library/react | 5.0 · 6.2 · 16.3         |                                                                                                                                                                                                                                                               |

**Ergänzungen zum Stack (klein, begründet):** `react-router` 8.4 (Routing fehlt im Stack; `createBrowserRouter` aus `react-router`, `RouterProvider` aus `react-router/dom`) · `sonner` (Toasts/Undo) · `lucide-react` (Icons) · `zod` (Backup-Validierung) · `@fontsource-variable/inter` (Font offline). **Nicht** dabei: `vaul` (seit 12/2024 ohne Release; Bottom-Sheet kommt aus dem shadcn-Drawer). Linter: was das Vite-Template mitbringt (aktuell oxlint) + `no-restricted-imports` für die Schichtenregeln; falls das dort nicht pro Ordner geht → ESLint + typescript-eslint.

---

## 1. Ordnerstruktur

```
src/
  app/                  App.tsx, router.tsx, providers.tsx
    shell/              AppShell (Grid + innerer Scroller), BottomTabs (mobile, Glas + Safe-Area), Sidebar (≥ lg), PageHeader
  features/
    dashboard/          Wochen-Hero (Verdient/Ausgegeben/Gespart), Ring, Streak, Insight-Karten
    income/             CloseWeekSheet („Woche abschließen"), PendingWeeksPrompt (älteste zuerst)
    expenses/           QuickAddSheet (Numpad), ExpenseList, Kategorien, Daueraufträge, Tags
    budget/             Gesamt-/Kategorie-Slider, Warn-UI
    pots/               Topfliste, Detail, Ein-/Auszahlen, Umbuchen, Prognose
    analytics/          Wochen-/Monatsansicht, Charts (lazy Chunk)
    whatif/             Rechner + Kurve
    tasks/              To-dos
    insights/           Insight-Karten (Regeln liegen in lib/)
    settings/           Theme, EUR-Kurs, Defaults, Daten (Export/Import/Prüfen/Löschen), Install-Hinweis
    └─ je Feature: components/, hooks/, <Feature>Page.tsx, index.ts (öffentliche API)
  shared/
    ui/                 shadcn-Komponenten (generiert, nur minimal anpassen)
    components/         Money, AnimatedNumber, ProgressRing, Numpad, SwipeRow, ResponsiveSheet, GlassCard, EmptyState, Skeletons
    hooks/              useToday (aktualisiert bei visibilitychange + Mitternacht), useMediaQuery, useStandalone, haptic()
    stores/             zustand: uiStore (gewählte Woche, offene Sheets), whatIfStore, themeStore
    motion.ts           Spring-/Dauer-Tokens
  lib/                  ★ reine Funktionen – kein React, kein Dexie, kein Date.now()
  db/                   schema.ts, types.ts, seed.ts, repos/*.ts, migrations/
  styles/               index.css, tokens.css (@theme + CSS-Variablen)
  test/                 setup.ts, fixtures/
docs/PLAN.md            Kopie dieses Plans mit Phasen-Checkboxen
CLAUDE.md
```

**Schichtenregel (per Lint erzwungen):** `lib` importiert nur `date-fns`/`zod` · `db` importiert `lib` · `features` importieren `lib`, `db`, `shared` und andere Features nur über deren `index.ts` · `shared` importiert nie aus `features`.

**Navigation:** Mobile-Tabs **Home · Ausgaben · ( + ) · Töpfe · Analyse**; Zahnrad im Header → „Mehr" (Budget, Tasks, Was-wäre-wenn, Einstellungen & Daten). Desktop: Sidebar mit allen Punkten + „Neue Ausgabe" (Shortcut `N`). `ResponsiveSheet` = Drawer < `lg`, Dialog ≥ `lg`.

---

## 2. Finales Datenmodell

### Schärfungen gegenüber deinem Vorschlag

1. **Geld = Integer-Cents** (`…Cents`), nie Float. Eigener Formatter, weil `Intl` de-DE/AUD „1.600,00 AU$" liefert; Ziel `A$1.600,00`, negativ `−A$12,50`.
2. **Kalendertage = lokale ISO-Strings `YYYY-MM-DD`**, keine Timestamps → zeitzonenfest (AU → EU verschiebt keine Ausgabe). Verifizierte Falle: `new Date('YYYY-MM-DD')` und `toISOString().slice(0,10)` sind UTC (Montag 08:00 Sydney → Sonntag → falsche Woche) → beides per Lint verboten, alles läuft über `lib/dates.ts` (`parseISO`/`format`, Rechnen nur mit `addDays`/`differenceInCalendarDays`, nie `+7*864e5` wegen DST).
3. **Wochenstart fix Montag** → `weekStartDay` fliegt aus den Settings (weekStart ist Schlüssel mehrerer Tabellen). Repo + zod prüfen: jeder weekStart ist ein Montag.
4. **Sync-fähig:** jede Zeile `id: string`, `createdAt`, `updatedAt`, `deletedAt|null` (Soft-Delete – macht „Rückgängig" beim Swipe-Löschen trivial). **Deterministische IDs** für Seeds (`pot:primary`, `cat:<slug>`) und abgeleitete Zeilen (`auto:<weekStart>`, `fund:<expenseId>`, `tr:<transferId>:out|in`, `rec:<recurringId>:<date>`) → idempotent nach Reload/Import/Sync, keine doppelten Primär-Töpfe auf zwei Geräten.
5. **Primär-Topf = feste ID `pot:primary`** statt `isPrimary`-Boolean (ein Boolean erlaubt 0 oder 2 Primär-Töpfe; feste ID nicht). Umbenennbar, nicht lösch-/archivierbar.
6. **Eine Quelle der Wahrheit:** Wochenkennzahlen werden immer aus Rohdaten berechnet, keine Snapshots. Einzige materialisierte Ableitungen sind Topfbuchungen (`auto:`, `fund:`), die der Repo-Layer in derselben Transaktion nachzieht.
7. **Wiederkehrend = eigene Vorlagen-Tabelle** statt `isRecurring/recurrenceRule` auf der Ausgabe; erzeugte Ausgaben sind normale Expenses mit `recurringId`.
8. **Budget ist „gültig ab":** Datensatz nur bei Änderung, immer mit `id = aktuelle Woche`; `resolveBudget(w)` = letzter Datensatz mit `id ≤ w`, sonst der früheste. Das Onboarding schreibt den ersten Datensatz → vergangene Wochen (und damit der Streak) ändern sich nie rückwirkend.

### Typen (`src/db/types.ts`)

```ts
type ISODate = string
type Cents = number
interface Base {
  id: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

interface Week extends Base {
  // id = weekStart (Montag) – ersetzt WeekIncome
  incomeCents: Cents | null // Netto-Direktbetrag; 0 erlaubt (Woche ohne Arbeit)
  note?: string
  closedAt: number | null // null = offen
}
interface Expense extends Base {
  date: ISODate
  amountCents: Cents // > 0
  categoryId: string
  tags: string[]
  note?: string
  recurringId?: string // aus Vorlage erzeugt
  fundedByPotId?: string | null // „aus Topf bezahlt" (auch Primär-Topf erlaubt)
}
interface RecurringExpense extends Base {
  title: string
  amountCents: Cents
  categoryId: string
  tags: string[]
  interval: 'weekly' | 'fortnightly' | 'monthly'
  anchorDate: ISODate // erste Fälligkeit; Wochentag/Monatstag daraus
  endDate: ISODate | null
  active: boolean
  lastGeneratedDate: ISODate | null // Wasserzeichen
}
interface Category extends Base {
  name: string
  icon: string /* lucide */
  color: string /* Token cat-1..10 */
  group: 'Fixkosten' | 'Variabel' | 'Freizeit' | 'Reisen' | 'Sonstiges'
  defaultWeeklyLimitCents: Cents | null
  sortOrder: number
  archived: boolean // archivieren statt löschen
}
interface Budget extends Base {
  // id = weekStart „gültig ab"
  totalLimitCents: Cents // maßgeblich (z. B. 40000)
  categoryLimits: Record<string, Cents> // optional; UI zeigt „unverteilt"/Überbuchung
}
interface Pot extends Base {
  // Primär-Topf: id === 'pot:primary'
  name: string
  targetCents: Cents | null
  deadline: ISODate | null
  color: string
  icon: string
  sortOrder: number
  archived: boolean
}
interface PotTransaction extends Base {
  potId: string
  amountCents: Cents // VORZEICHENBEHAFTET → Topfstand = Summe
  date: ISODate // auto-weekly: Sonntag der Woche (weekStart + 6), nicht closedAt
  type:
    | 'auto-weekly'
    | 'manual-deposit'
    | 'withdrawal'
    | 'transfer-in'
    | 'transfer-out'
    | 'expense-funding'
  sourceWeekStart?: ISODate
  transferId?: string
  expenseId?: string
  note?: string
}
interface Task extends Base {
  title: string
  dueDate: ISODate | null
  done: boolean
  doneAt: number | null
  category: 'Finanzen' | 'Behörden' | 'Sonstiges'
  linkedPotId: string | null
  note?: string
}
interface Settings {
  // Singleton id = 'app'
  id: 'app'
  currency: 'AUD'
  eurRate: number | null
  eurRateUpdatedAt: number | null
  showEur: boolean
  theme: 'dark' | 'light' | 'system'
  defaultWeeklyIncomeCents: Cents
  trackingSince: ISODate
  lastBackupAt: number | null
  installHintDismissedAt: number | null
  onboardingDone: boolean
  updatedAt: number
}
```

### Dexie-Schema (`src/db/schema.ts`)

```ts
export const SCHEMA_VERSION = 1
db.version(1).stores({
  weeks: 'id', // id = weekStart
  expenses: 'id, date', // Wochenabfrage = date-Range
  recurringExpenses: 'id',
  categories: 'id',
  budgets: 'id', // where('id').belowOrEqual(w).last()
  pots: 'id',
  potTransactions: 'id, [potId+date]', // Verlauf je Topf, sortiert
  tasks: 'id',
  settings: 'id',
})
```

**Indizes bewusst sparsam:** ~1.000 Ausgaben/Jahr → Kategorie-/Tag-/Status-Filter laufen im Speicher; Booleans sind ohnehin keine gültigen IndexedDB-Keys; deterministische IDs ersetzen Lookup-Indizes. Ein Index lässt sich später per Versionssprung ohne Datenmigration nachrüsten.

**Versionierung:** ausgelieferte Versionen nie editieren; Änderungen nur als `db.version(n+1).stores(...).upgrade(tx => …)` in `db/migrations/` + fake-indexeddb-Test. `SCHEMA_VERSION` steckt in jedem Backup; `lib/backup.migrateBackup()` hebt alte Backups stufenweise an. `versionchange` → DB schließen + Reload-Hinweis (zwei Tabs am Mac); globaler Handler für „Connection to Indexed Database server lost" (iOS nach Resume) → reopen/reload.

### Invarianten im Repo-Layer (einziger Schreibweg, je eine Dexie-`rw`-Transaktion)

- **Ein Nadelöhr für Schreibzugriffe:** liest die alte Zeile in der Transaktion und ruft `syncWeekDerived` für **jede abgeschlossene Woche in `{weekOf(alt), weekOf(neu)}`** – deckt Betrag/Datum/Löschen/`fundedByPotId`-Wechsel ab; Materialisierer und Import nutzen denselben Weg. `closeWeek` doppelt = No-op; `reopenWeek` tombstoned `auto:<weekStart>`.
- Ausgabe mit `fundedByPotId` ↔ Buchung `fund:<expenseId>` wird bei Anlegen/Ändern/Löschen mitgeführt.
- Umbuchung = zwei Zeilen `tr:<id>:out|in`, atomar; abgelehnt bei Überziehen, gleichem oder archiviertem Topf. Töpfe nur archivierbar bei Stand 0.
- Recurring-Materialisierung: Wasserzeichen **in** der Transaktion lesen → fällige IDs per `bulkGet` filtern → `bulkAdd` (nie `bulkPut`: überschreibt editierte Instanzen; gelöschte Instanzen bleiben als Tombstone gelöscht). Serialisiert auch Doppel-Trigger (App-Start + `visibilitychange`, zwei Tabs). Anker/Intervall editiert oder Vorlage reaktiviert → Wasserzeichen = gestern (kein Rückwirkend-Auffüllen); `today < Wasserzeichen` (Zeitzonenwechsel) = No-op.
- Archivierte Kategorien: Limits werden beim Auflösen ignoriert, alte Budget-Zeilen nie umgeschrieben; ihre Ausgaben zählen weiter zum Gesamtlimit.
- **Import „Ersetzen":** `file.text()` → zod → Migration → FK-/Ledger-Check **vor** der Transaktion; dann eine Transaktion über alle Tabellen (clear + bulkAdd, keine Nicht-Dexie-`await`s darin) → Alles-oder-nichts; vorher Sicherheitskopie des Ist-Zustands in separater DB `fp-safety` (1 Slot, „Import rückgängig"); danach `location.reload()`.
- **„Alle Daten löschen"** = `db.delete()` + Reload (nicht `clear()`, sonst laufen die Seeds nicht erneut und es fehlt der Primär-Topf).
- **liveQuery-Konvention:** ein Querier pro Screen (kein Tearing), darin nur Dexie-`await`s; `undefined` = lädt (→ Skeleton), `null` = nicht gefunden.

---

## 3. Kernlogik in `src/lib` (pure, Vitest, `today`/`now` immer als Parameter)

| Modul                  | Wichtigste Funktionen                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `money.ts`             | `formatAUD(cents)` → `A$1.600,00` · `formatEUR(cents, rate)` · `parseAmountInput('12,5')` → `1250` · `ratio()`                                                                                                                                                                                                                                                                                                     |
| `dates.ts`             | `parseISODate` / `toISODate` (lokal) · `weekStartOf` · `weekRange` · `addWeeks` · `listWeeks` · `isMonday` · `monthOfWeek` (**Donnerstags-Regel**: Woche zählt zum Monat ihres Donnerstags → Monats-KPIs = Summe ganzer Wochen, bleiben konsistent zu den Wochenwerten)                                                                                                                                            |
| `budget.ts`            | `resolveBudget(budgets, week)` · `budgetUsage(expenses, budget)` → gesamt + je Kategorie, `level: 'ok' \| 'warn' (≥ 80 %) \| 'over' (≥ 100 %)` · `thresholdCrossed(prev, next)` (Toast genau einmal) · `unallocated()` · `reservedThisWeek(templates, week, today)` (noch nicht fällige Daueraufträge der Woche virtuell als „reserviert" → Restbudget ist ehrlich, bevor z. B. die Miete am Freitag gebucht wird) |
| `savings.ts`           | `summarizeWeek({week, expenses, budget})` → `{income, spent (ohne topf-finanzierte), funded, saved, savingsRate, underBudget}` · `buildAutoWeeklyTx()` · `potBalances(txs)` · `validateTransfer()` · `pendingWeeks(weeks, trackingSince, today)` (älteste zuerst)                                                                                                                                                  |
| `streak.ts`            | `computeStreak(summaries, today)` → `{current, best}`: rückwärts ab letzter abgeschlossener Woche, kalendarisch lückenlos, `spent ≤ totalLimit`; `current` gilt nur, wenn der letzte Abschluss die Vorwoche oder jünger ist – sonst „Wochen abschließen, um den Streak zu sehen"                                                                                                                                   |
| `recurrence.ts`        | `dueDates(template, afterExclusive, untilInclusive)` – weekly/fortnightly per Kalendertage ab **Anker** (`diffDays % 7/14`), monthly = `addMonths(anchor, k)` mit Monatsende-Klemmung (31. → 28./30., ohne Drift) · `nextDueDate()`                                                                                                                                                                                |
| `forecast.ts`          | `weeklyPace(txs, windowWeeks = 8)` · `forecastPot()` → ETA („Bei aktuellem Tempo erreicht am …") · `requiredWeeklyForDeadline()` · `deadlineDelta()` („2 Wochen vor Ziel")                                                                                                                                                                                                                                         |
| `whatif.ts`            | `projectScenario({startBalance, baselineWeeklySaving, adjustments[{categoryId, deltaCentsPerWeek}], from, until})` → Punkte `{weekStart, baseline, scenario}` + `gainCents`                                                                                                                                                                                                                                        |
| `analytics.ts`         | `weeklySeries` · `monthlySeries` (Einkommen/Gespart **nur aus abgeschlossenen Wochen** – sonst zeigt der laufende Monat ein falsches Minus; Monatsvergleich über Ø/Woche, da 4 oder 5 Wochen) · `categoryBreakdown` · `cumulativeSavings` · `compareToPreviousWeek` · `bestWorstWeek` · `categoryAverages(windowWeeks)`                                                                                            |
| `insights.ts`          | `type InsightRule = (ctx) => Insight \| null` · `runInsights(ctx, rules)` (Priorität, max. 3 aufs Dashboard). Regeln: Kategorie ≥ 20 % über 8-Wochen-Schnitt · Topf vor/hinter Deadline · Budget 80/100 % · Streak-Meilenstein · offene Wochen · Sparquote vs. Schnitt · Backup älter 14 Tage · EUR-Kurs älter 30 Tage                                                                                             |
| `ledger.ts`            | `checkLedgerInvariants(data)` → Verstöße: Umbuchungen summieren zu 0 · genau eine `auto:`-Buchung je abgeschlossener Woche und = `summarizeWeek().saved` · `fund:`-Buchungen 1:1 zu Ausgaben · alle weekStarts sind Montage · keine verwaisten FKs. Läuft in Tests, nach jedem Import und über „Daten prüfen" in den Einstellungen                                                                                 |
| `csv.ts` · `backup.ts` | CSV mit `;`, UTF-8-BOM, Dezimalkomma, Schutz vor Formel-Injection (führende `= + - @`) · zod-`BackupSchema`, `buildBackup`, `parseBackup`, `migrateBackup`                                                                                                                                                                                                                                                         |

**Pflicht-Testfälle:** Minus-Woche · Woche über Jahreswechsel · DST-Wochen – Datums-Tests laufen unter `TZ=Australia/Sydney` **und** `TZ=Europe/Berlin` · Monats-Dauerauftrag am 31. · fortnightly-Anker · topf-finanzierte Ausgabe · abgeschlossene Woche editieren/wiedereröffnen · doppeltes `closeWeek` · Datumswechsel über Wochengrenze · Budget-Auflösung mit Lücken · Streak mit Lücke / veraltetem Abschluss · offene Woche im laufenden Monat.

---

## 4. Design-Tokens (`src/styles/tokens.css`, Tailwind v4 `@theme`)

Dark ist Default (`:root`), Light über `[data-theme='light']`. Theme wird vor dem ersten Paint per Inline-Script aus `localStorage` gesetzt (kein Flash; `index.html` hat inline dunklen Hintergrund gegen den weißen iOS-Startblitz); maßgeblich bleibt `Settings.theme`.

```css
:root {
  /* DARK (Default) */
  --bg: #0b0c0f;
  --surface-1: #14161a; /* Card */
  --surface-2: #1b1e24; /* Sheet/Popover */
  --surface-3: #252932; /* Input/Hover */
  --border: rgb(255 255 255 / 0.08);
  --border-strong: rgb(255 255 255 / 0.14);
  --fg: #f5f6f8;
  --fg-muted: #9aa1ae;
  --fg-subtle: #6a7180;
  --saved: #3ee0a8;
  --saved-soft: rgb(62 224 168 / 0.14);
  --on-saved: #04231a; /* Mint = Gespart + Primary-CTA */
  --spent: #ff6f61;
  --spent-soft: rgb(255 111 97 / 0.14); /* Coral = Ausgaben */
  --income: #8aa4ff;
  --income-soft: rgb(138 164 255 / 0.14); /* Periwinkle = Verdient */
  --warning: #ffb84d;
  --danger: #ff5a52;
  --cat-1: #8aa4ff;
  --cat-2: #b58cff;
  --cat-3: #ff8fc7;
  --cat-4: #ffb84d;
  --cat-5: #5cd6e8;
  --cat-6: #ff9466;
  --cat-7: #a3e07a;
  --cat-8: #e8d36a;
  --cat-9: #7fd1b9;
  --cat-10: #9aa1ae;
  --shadow-card: inset 0 1px 0 rgb(255 255 255 / 0.04), 0 8px 24px rgb(0 0 0 / 0.35);
  --glow-saved: 0 0 24px rgb(62 224 168 / 0.25);
}
[data-theme='light'] {
  --bg: #f4f5f7;
  --surface-1: #ffffff;
  --surface-2: #ffffff;
  --surface-3: #eceef2;
  --border: rgb(10 12 16 / 0.08);
  --border-strong: rgb(10 12 16 / 0.16);
  --fg: #0e1014;
  --fg-muted: #5b6270;
  --fg-subtle: #8a909c;
  --saved: #0fa877;
  --on-saved: #ffffff;
  --spent: #e5483b;
  --income: #4463e6;
  --warning: #c77a00;
  --danger: #d92d20;
  --shadow-card: 0 1px 2px rgb(16 24 40 / 0.06), 0 8px 24px rgb(16 24 40 / 0.06);
}
@theme inline {
  --color-bg: var(--bg);
  --color-surface-1: var(--surface-1); /* … alle Farben → bg-saved, text-spent, border-border … */
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px /* Cards */;
  --radius-xl: 28px /* Sheets, Hero */;
  --text-display: 2.75rem;
  --text-display--line-height: 1.09; /* Hero-Betrag, 700, -0.03em */
  --text-h1: 1.75rem;
  --text-h2: 1.25rem;
  --text-body: 1rem;
  --text-label: 0.8125rem;
  --text-caption: 0.6875rem;
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
}
```

shadcn-Variablen (`--background`, `--card`, `--primary`, `--destructive`, `--ring`, `--chart-1..5` …) werden auf diese Tokens gemappt (`--primary: var(--saved)`, `--chart-1: var(--income)`, `--chart-2: var(--spent)`, `--chart-3: var(--saved)`).

- **Spacing:** 4-px-Raster; Seitenrand 16 px mobil / 32 px Desktop; Card-Padding 16–20 px; Abschnittsabstand 24 px; Touch-Ziel ≥ 44 px; Tab-Bar 64 px + `env(safe-area-inset-bottom)`; Sidebar 260 px; Content max. 1120 px; Shell-Wechsel bei `lg` (1024 px).
- **Zahlen:** überall `tabular-nums`; Beträge nur über `<Money>` / `<AnimatedNumber>` (Spring-Ticker). Inputs ≥ 16 px (kein iOS-Zoom).
- **Glas:** `bg-surface-1/70 backdrop-blur-xl backdrop-saturate-150 border border-border` – nur Tab-Bar, Sticky-Header, Sheet-Griffleiste (Performance).
- **Motion (`shared/motion.ts`):** Dauer 120/200/320 ms; Springs `snappy {500, 35}`, `soft {260, 28}`, `bouncy {400, 17}`; `whileTap scale .97` als Haptik-Ersatz; `MotionConfig reducedMotion="user"`. `haptic()`-Wrapper: `navigator.vibrate` wo vorhanden, sonst No-op (iOS hat keine Vibration-API; Toggles als natives `<input type="checkbox" switch>` geben dort echte Haptik).
- Farb-/Chart-Palette wird in Phase 4 mit dem `dataviz`-Skill gegen Kontrast & Farbsehschwäche validiert.

---

## 5. Umsetzungsphasen (jede Phase = eigene Freigabe durch dich)

**Gate für jede Phase:** `npm run typecheck && npm run lint && npm run test && npm run build` grün · UI von mir im Browser geprüft (Chrome-Automation, 390×844 + 1440×900, Dark + Light, Konsole fehlerfrei) · `docs/PLAN.md`-Checkboxen aktualisiert · kurze Phasen-Notiz + Screenshots an dich.

### Phase 0 – Setup, Tokens, Layout-Shell

Vite-React-TS-Scaffold (TS `~6.0.3`, strict, `paths` ohne `baseUrl`) · Lint inkl. Schichtenregeln + Verbot von `new Date(string)`/`toISOString().slice` · Prettier (`prettier-plugin-tailwindcss`) · Vitest-Setup · Tailwind v4 + `tokens.css` · shadcn init (`ui → src/shared/ui`; button, card, drawer, dialog, slider, input, tabs, skeleton, sonner, tooltip, dropdown-menu, switch) – dabei einmal prüfen: `shadcn add` löst Alias ohne `baseUrl` auf, und worauf der Drawer aufsetzt · Inter self-hosted · Theme ohne Flash · Router + **AppShell als Grid mit innerem Scroller** (keine `position: fixed`-Tab-Bar; `100dvh`, `viewport-fit=cover`, Safe-Areas, `overscroll-behavior: none`) mit Platzhalter-Seiten + Seitenübergängen · Basis-Komponenten `Money`, `GlassCard`, `ProgressRing` (statisch), `ResponsiveSheet` · Dev-Route `/dev/tokens` (Styleguide) · `CLAUDE.md` + `docs/PLAN.md`.
**DoD:** alle Scripts grün · Shell korrekt bei 390 px und 1440 px, kein horizontales Scrollen · Dark/Light ohne Flash · `/dev/tokens` zeigt Farben, Typo, Radien, Buttons, Card, Sheet · `formatAUD`-Smoke-Test läuft.

### Phase 1 – Datenmodell, Kernlogik, Tests

`db/types.ts`, `schema.ts`, Repos mit allen Invarianten aus §2, Seeds mit deterministischen IDs (10 Kategorien, `pot:primary` „Nur gespart", Settings A$2.000, erstes Budget A$400) · alle `lib`-Module aus §3 inkl. `checkLedgerInvariants` · Dev-Demo-Daten-Generator (12 realistische Wochen, nur Dev-Build) für die UI-Phasen.
**DoD:** `lib` ≥ 90 % Line-Coverage, alle Pflicht-Testfälle aus §3, Datums-Tests in beiden Zeitzonen · Repo-Tests (fake-indexeddb): `closeWeek` idempotent, Nadelöhr synct alte + neue Woche, Transfer atomar, Funding-Kaskade, Recurring-Materialisierung idempotent (auch bei parallelem Doppelaufruf), Soft-Delete/Restore, Import-Rollback bei Fehler, Wipe → Seeds wieder da · `checkLedgerInvariants` grün auf Demo-Daten · Lint beweist: kein React/Dexie in `lib`.

### Phase 2 – Einkommen & Ausgaben

QuickAdd-Sheet: FAB → eigenes Numpad (Betragsanzeige ist **kein** `<input>` → iOS-Tastatur öffnet nie; Tasten mit `pointerdown` + `touch-action: manipulation`) → Kategorie-Grid → Speichern; Datum = heute, Notiz/Tags/Datum aufklappbar (Notizfeld oben im Sheet, damit die Tastatur es nicht verdeckt) · Ausgabenliste nach Kalendertagen mit Wochen-Umschalter, Swipe-to-delete + Undo-Toast, Bearbeiten-Sheet · Kategorien verwalten (Icon/Farbe, Sortierung, Archiv) · Daueraufträge (weekly/fortnightly/monthly) + Materialisierung bei App-Start/`visibilitychange` · Tags mit Autocomplete · **„Woche abschließen"**: Betrag vorbelegt → Zusammenfassung → Bestätigen (Buchung in `pot:primary`, Erfolgsanimation); offene Wochen als Warteschlange, älteste zuerst; „Woche wieder öffnen" · Onboarding (Standard-Einkommen, Budget, Startguthaben, `trackingSince`) · Dashboard v1 (Verdient/Ausgegeben/Gespart, Sparquote) · Skeletons + Empty-States.
**DoD:** Ausgabe in ≤ 3 Taps nach Betragseingabe · wöchentliche Miete erscheint automatisch und nach Reload nicht doppelt · Swipe + Undo per Touch bedienbar · doppelter Wochenabschluss erzeugt keine zweite Buchung; Ausgabe in abgeschlossener Woche ändern/verschieben passt „Gespart" beider Wochen an · RTL-Tests für QuickAdd und CloseWeek.

### Phase 3 – Budget & Spartöpfe

Budget-Seite: Gesamt-Slider + Kategorie-Slider (Schritt A$5, alternativ Zahleneingabe), „unverteilt"-Anzeige, „gilt ab dieser Woche" · Warnungen 80 %/100 % (Toast einmalig je Schwelle, dauerhaft Farbe an Ring/Karten) · Dashboard: animierter Restbudget-Ring inkl. „davon reserviert" (anstehende Daueraufträge) + Streak · Töpfe: Liste mit Ständen, Detail (Verlauf, Fortschritt, ETA, „nötig pro Woche"), Anlegen/Bearbeiten, Ein-/Auszahlen, Umbuchen, Archivieren · „Aus Topf bezahlt" im Ausgaben-Sheet.
**DoD:** Budgetänderung heute verändert vergangene Wochen/Streak nicht · Warnung feuert exakt einmal pro Schwelle und Woche · Topfstand = Summe der Buchungen · Umbuchung atomar, kein Überziehen · topf-finanzierte Ausgabe lässt Budget, Streak und Wochen-Sparsumme unberührt · Prognose = `lib`-Fixtures · `checkLedgerInvariants` grün nach einem durchgespielten Szenario.

### Phase 4 – Analyse & Charts

(zuerst `dataviz`-Skill laden) Wochen-/Monats-Umschalter, Zeitraum 8 W/12 W/26 W/Alles · Verdient vs. Ausgegeben vs. Gespart · Kategorien-Donut mit Drilldown · kumulierter Sparverlauf · Vorwochen-Vergleich (Delta-Chips) · beste/schlechteste Woche · laufende offene Woche getrennt markiert · EUR-Umschalter · Recharts über CSS-Variablen gethemt, Tooltips mit Tabular Nums.
**DoD:** Chart-Werte = `lib/analytics`-Fixtures · lesbar bei 390 px, Dark + Light · Recharts in eigenem Lazy-Chunk · Skeleton/Empty-States, kein Layout-Shift.

### Phase 5 – Tasks, Insights, Was-wäre-wenn

Tasks (Fälligkeit, Kategorie, optional Topf-Kopplung, Abhak-Animation, überfällig hervorgehoben, Dashboard-Widget) · Insight-Karten auf dem Dashboard (wegwischbar, max. 3) · Was-wäre-wenn: Kategorie-Slider „−A$X/Woche", Zieldatum, Kurve Basis vs. Szenario live, Ergebnis „+A$Z bis Datum Y", optional „als Budget übernehmen".
**DoD:** jede Insight-Regel hat Tests (feuert / feuert nicht) · Kurve aktualisiert beim Ziehen flüssig · Rechner-Ergebnis = `projectScenario`-Fixture · Task-Flows komplett per Touch und Tastatur.

### Phase 6 – PWA, Export, Polish

`vite-plugin-pwa` (generateSW, alles precachen, `navigateFallback`, Update-Toast; zusätzlich `registration.update()` gedrosselt bei `visibilitychange`, weil eine fortgesetzte PWA selten navigiert) · Icons/Maskable/Apple-Touch + `apple-touch-startup-image` aus einer SVG · Manifest (standalone, Theme-Colors) · Statusbar: `black-translucent` rendert immer weiße Schrift → im Light-Theme dunkler Streifen darunter oder `default` (am Gerät entscheiden) · iOS-Install-Sheet (Safari && nicht standalone), erscheint **vor** dem Onboarding · `navigator.storage.persist()` im Standalone-Modus, Ergebnis in den Einstellungen sichtbar · JSON-Export: `navigator.share({files})` hinter `canShare`, Blob **vor** dem Tap bauen (User-Activation läuft ab), Fallback `<a download>`, `AbortError` schlucken · Import: `accept=".json,application/json,text/plain"`, Inhalt validieren, `input.value` zurücksetzen, Sicherheitskopie + „Import rückgängig" · CSV-Export · „Daten prüfen" · „Alle Daten löschen" (Halten-zum-Bestätigen, vorher Export anbieten) · Settings komplett · A11y-Pass (Fokus, ARIA für Ring/Slider, Kontrast) · Reduced Motion · Performance · Vercel: SPA-Rewrite, `sw.js`/`index.html` no-cache, Assets immutable.
**DoD:** App startet im Flugmodus vollständig · auf iPhone installiert, Safe-Areas/Statusbar korrekt · Export → „Alle Daten löschen" → Import stellt identischen Zustand her (automatisierter Roundtrip-Test + manuell am Gerät) · Lighthouse Performance/Best Practices/A11y ≥ 90 · initiales JS < 250 KB gzip · Production-URL steht.
_Die iOS-Punkte stammen teils aus Erfahrungswissen, nicht aus aktueller iOS-26-Doku → werden in dieser Phase am echten Gerät verifiziert._

### Phase 7 (optional, separate Entscheidung) – Sync

Evaluierung Dexie Cloud (naheliegend, da Dexie; braucht aber E-Mail-Login → Abweichung von „keine Auth") vs. Alternativen. Datenmodell ist vorbereitet; bis dahin: iPhone führend, MacBook per Backup-Import.

> **Wichtig (Origin = Datenbank):** IndexedDB hängt an der Domain. Installierte PWA **immer von der stabilen Production-URL**; jede Vercel-Preview-URL und jede spätere Custom-Domain startet mit leerer DB (→ vorher Backup). Auf iOS sind Safari-Tab und installierte App getrennte Speicher (erst installieren, dann Daten erfassen); App-Icon entfernen löscht die Daten → Backup-Erinnerung ist Pflichtfeature, kein Nice-to-have.

---

## 6. Offene Fragen an dich (vor Phase 0) – mit meiner Annahme, falls du nichts sagst

1. **shadcn-Basis:** Du hast „Radix-Primitives" vorgegeben → ich initialisiere mit `-b radix` (Annahme). Hinweis: shadcn baut den Drawer inzwischen laut Doku auf Base UI statt vaul; ich prüfe das in Phase 0 und melde mich nur, falls es mit Radix-Basis hakt. Alternativ komplett `-b base` (neuer shadcn-Weg) – deine Wahl, nach Init nicht mehr änderbar.
2. **Minus-Woche** (Ausgaben > Einkommen): Differenz **negativ** in „Nur gespart" buchen (Annahme – Topf bleibt ehrlich) oder auf 0 begrenzen?
3. **Git-Workflow:** Ich committe pro Phase selbstständig in kleinen Conventional Commits auf Branch `phase-N-…`, Push nur auf deine Ansage; `master` → `main` umbenennen (Annahme: ja zu beidem)?
4. **Startguthaben:** Onboarding fragt einmalig nach bereits Erspartem → Einzahlung „Startguthaben" in den Primär-Topf (Annahme: ja).
5. **Lohnwoche:** Einkommen zählt für die Woche, die du abschließt – unabhängig vom Auszahlungstag (Annahme). Oder weicht deine Pay-Period stark von Mo–So ab?
6. **Budget-Umfang:** Alle Kategorien zählen gegen das A$400-Gesamtlimit, außer topf-finanzierte Ausgaben (Annahme). Start-Kategorien: Miete/Wohnen, Lebensmittel, Essen gehen, Transport, Handy/Internet, Freizeit, Reisen, Shopping, Gesundheit, Sonstiges – passt das?
7. **Topf-Automatik:** feste Wochenbeträge in Neben-Töpfe (z. B. A$200/Woche → „Auto") beim Wochenabschluss? Annahme: **nicht** in v1, nur manuelle Umbuchungen.
8. **Sprache/Name:** UI Deutsch, Code Englisch; App-Name „Finanzplaner", Icon = Mint-Ring auf Schwarz (Annahme).
9. **Testen auf dem iPhone:** Service Worker/Installation brauchen HTTPS. Vercel (privates GitHub-Repo + Git-Integration) schon **ab Phase 2** anbinden, damit du jede Phase real testen kannst (Annahme) – oder erst in Phase 6? Dafür bräuchte ich von dir GitHub-Repo + Vercel-Login.
10. **Schrift:** Inter self-hosted (Annahme: konsistent + offline) oder System-Font SF Pro (0 KB, „nativer")?

---

## 7. `CLAUDE.md`

Liegt im Repo-Root (`/CLAUDE.md`) und ist dort maßgeblich.

---

## 8. Verifikation (End-to-End)

- **Automatisch pro Phase:** `npm run typecheck`, `npm run lint`, `npm run test` (Vitest: lib in zwei Zeitzonen + Repos gegen fake-indexeddb + RTL-Flows), `npm run build`.
- **Von mir im Browser** (Chrome-Automation gegen `npm run dev` bzw. `npm run preview`): Kern-Loop durchspielen – Ausgabe erfassen → Woche abschließen → Stand von „Nur gespart" prüfen → Ausgabe nachträglich ändern → Stand zieht nach → „Daten prüfen" grün; Viewports 390×844 und 1440×900, Dark/Light, Konsole ohne Fehler, Screenshots an dich.
- **PWA (Phase 6):** `npm run build && npm run preview` → DevTools offline → App lädt und ist bedienbar; Lighthouse; Backup-Roundtrip.
- **Von dir auf dem iPhone:** Production-URL in Safari → „Zum Home-Bildschirm" → Flugmodus-Start, Safe-Areas, Numpad/Sheets, Swipe-Gesten, Export per Share-Sheet aufs MacBook → dort importieren.
