# Phasenstatus

> Arbeitskopie des am 2026-09-20 freigegebenen Plans. Jede Phase startet erst nach ausdrücklicher Freigabe durch den Nutzer. Checkboxen nach Abschluss einer Phase pflegen; Abweichungen vom Plan hier unter der jeweiligen Phase notieren.

- [x] Plan freigegeben (2026-09-20)
- [x] `CLAUDE.md` + `docs/PLAN.md` angelegt
- [x] Offene Fragen §6 beantwortet (unbeantwortet = Annahme gilt) — beantwortet: 1 (Radix), 3 (selbstständig committen, `main`, Push nur auf Ansage), 10 (Inter self-hosted), 2 (Minus-Woche negativ buchen), 6 (alle Kategorien zählen; 10 Start-Kategorien wie vorgeschlagen), 4 (Onboarding fragt nach Startguthaben → Einzahlung in „Nur gespart"), 5 (Lohn zählt für die Woche, die abgeschlossen wird – nicht für die Auszahlungswoche), 9 (Vercel schon ab Phase 2; braucht vom Nutzer ein privates GitHub-Repo + Vercel-Login; Preview-URLs = Wegwerf-Daten), 7 (keine Topf-Automatik in v1), 8 („Finanzplaner" mit Mint-Ring-Icon) — **alle beantwortet**
- [x] **Phase 0** – Setup, Tokens, Layout-Shell — abgeschlossen 2026-09-20 (Branch `phase-0-setup`, in `main`), Notizen unten
- [x] **Phase 1** – Datenmodell, Kernlogik, Tests — abgeschlossen und abgenommen 2026-09-20 (Branch `phase-1-data-logic`, in `main`), Notizen unten
- [x] **Phase 2** – Einkommen & Ausgaben — vom Nutzer in zwei Teile geteilt, beide abgenommen 2026-09-20:
  - [x] **2a** – QuickAdd-Sheet mit Numpad, Ausgabenliste mit Swipe-to-delete + Undo, Bearbeiten-Sheet, Kategorienverwaltung, Tags mit Autocomplete, Vercel-Anbindung — fertig 2026-09-20 (Branch `phase-2a-expenses`), **abgenommen 2026-09-20 (am iPhone getestet), in `main`**, Notizen unten
  - [x] **2b** – Daueraufträge (weekly/fortnightly/monthly) inkl. Materialisierung, „Woche abschließen" mit Warteschlange + „Woche wieder öffnen", Onboarding (Standard-Einkommen, Budget, Startguthaben, trackingSince), Dashboard v1 mit Empty-States und klarem nächsten Schritt — fertig 2026-09-20 (Branch `phase-2b-weekly-flow`), **abgenommen 2026-09-20 (am iPhone getestet), in `main`**, Notizen unten
- [x] **Zwischenschritt** – Browser-Journeys als E2E-Smoke-Suite im Repo (`npm run test:e2e`, nicht im Gate) — fertig 2026-09-20 (Branch `e2e-smoke`), **abgenommen 2026-09-20, in `main`**, Notizen unten
- [x] **Phase 3** – Budget & Spartöpfe — fertig 2026-09-20 (Branch `phase-3-budget-pots`), **abgenommen 2026-09-21 (am iPhone getestet), in `main`**, Notizen unten
- [x] **Phase 4** – Analyse & Charts — freigegeben 2026-09-21, fertig 2026-09-21 (Branch `phase-4-analytics`), **abgenommen 2026-09-22, in `main`**, Notizen unten
- [x] **Phase 5** – Tasks, Insights, Was-wäre-wenn — Aufteilung in 5a–5c (5d am 2026-09-24 gestrichen: was nach ein paar Wochen Nutzung fehlt, wird gezielt gebaut) und die folgenden Entscheidungen bestätigt 2026-09-22; alle übrigen Annahmen des Ursprungsplans (§5) gelten unverändert:
  - [x] **5a** – Tasks: Fälligkeit, Kategorie, optionale Topf-Kopplung als **Verweis mit Fortschrittsanzeige (keine Automatik)**, Abhak-Animation, überfällige Tasks hervorgehoben, Dashboard-Widget — freigegeben 2026-09-22, fertig 2026-09-22 (Branch `phase-5a-tasks`), **abgenommen 2026-09-22, in `main`**, Notizen unten
  - [x] **5b** – Insights: Karten auf dem Dashboard (wegwischbar, max. 3). **Weggewischte Insights liegen in `localStorage`** (gerätelokal, nicht im Backup, kein Schema-Wechsel). Die Regeln „Offene Wochen" und „Backup" erscheinen **nicht** als Karte – offene Wochen deckt schon der Nächste Schritt ab, die Backup-Erinnerung kommt mit Phase 6. — freigegeben 2026-09-22, fertig 2026-09-23 (Branch `phase-5b-insights`), **abgenommen 2026-09-23 (am iPhone getestet), in `main`**, Notizen unten
  - [x] **5c** – Was-wäre-wenn: **Startwert der Prognose = Summe aller Töpfe**; Kategorie-Slider, Zieldatum, Kurve Basis vs. Szenario, Ergebnis „+A$Z bis Datum Y", optional „als Budget übernehmen". — freigegeben 2026-09-23, fertig 2026-09-24 (Branch `phase-5c-whatif`), **abgenommen 2026-09-24, in `main`**, Notizen unten
- [ ] **Phase 6** – PWA, Export, Polish — **Backup-Erinnerung ist Pflichtfeature:** Insight-Karte („Backup älter als 14 Tage" bzw. noch nie) plus Hinweis in den Einstellungen (siehe §5) — freigegeben 2026-09-24 (Branch `phase-6-pwa`). **Endgültige Adresse: https://jonas-finanzen.vercel.app** (fest am Projekt eingetragen am 2026-09-24, Entscheidung des Nutzers). Zusätzlich gewünscht: ein deutlich sichtbarer Hinweis, ab wann echte Daten gefahrlos erfasst werden können.
- [ ] Phase 7 (optional) – Sync

## Session-Notiz – Stand 2026-09-24

> Einstieg für die nächste Session. Wird bei jedem Sessionende überschrieben, nicht fortgeschrieben – die dauerhaften Ergebnisse stehen in den Phasen-Notizen unten.

**Wo wir stehen**

- **Phase 5 ist komplett** (5a–5c abgenommen, 5d gestrichen). Production = Stand 5c.
- **Phase 6 ist freigegeben** (2026-09-24) und läuft auf Branch `phase-6-pwa`.
- **Domain entschieden (2026-09-24): `jonas-finanzen.vercel.app`** ist als Projekt-Domain eingetragen und liefert Production aus. Hintergrund: `finance-planner-jonasworkings-projects.vercel.app` ist nur ein automatischer Alias aus Projektname + Team-Slug (ändert sich bei Umbenennung); fest eingetragen war bisher nur `finance-planner-gilt-eight.vercel.app`. Beide alten Adressen laufen weiter, sind aber eigene Origins (eigene Datenbank) – nie dort echte Daten erfassen.

**Offen aus Phase 3/4** (nicht blockierend, unverändert)

- Ausgaben-Sheet mit offenen Details ist höher als der Bildschirm („Speichern" erst nach Scrollen im Sheet).
- `AnimatedNumber` (Spring-Ticker für Beträge) ist nicht gebaut.
- Warn-Protokoll liegt in `localStorage`: nach „Alle Daten löschen" mitten in der Woche bleibt es bis zur nächsten Woche stumm.
- Ausgabe aus einem inzwischen archivierten Topf lässt sich erst nach „Wiederherstellen" des Topfs ändern.
- Start-Chunk 295 KB gzip (Ziel < 250 KB → Phase 6: Lazy-Routes für Budget/Töpfe, `LazyMotion`).
- A11y-Pass (Pfeiltasten im Segment-Schalter, Sortieren per Tastatur, `forced-colors`-Textur für Charts) → Phase 6.

**Als Nächstes**

1. Phase 6 bauen (Bundle < 250 KB, PWA, Backup-UI, Backup-Erinnerung, Einstellungen, A11y, Hinweis „echte Daten") → Gate + Smoke-Suite → Preview → Abnahme am iPhone unter `jonas-finanzen.vercel.app`.

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

## Phase 2b – Ergebnis & Abweichungen vom Plan

**Geprüft:** typecheck · lint · build grün · **478 Testläufe** (239 Tests × 2 Zeitzonen), neu: `lib/dashboard` + `describeRecurrence`, Repo-Tests für Onboarding (atomar, idempotent, Eingabeprüfung) und `recurring.restore`, RTL-Tests gegen die echte DB-Schicht für **CloseWeek** (Abschluss, Minus-Woche, Warteschlange, Bearbeiten/Wiederöffnen), **Onboarding** (3 Wege) und **Dashboard** (Tag eins, offene Wochen, laufender Betrieb) · Coverage `src/lib` 99,8 % · **21 Browser-Checks im echten Chrome**: Onboarding → Dashboard Tag eins → erste Ausgabe → Dauerauftrag (sofort gebucht) → Woche abschließen → Erfolgsansicht → „Letzte Wochen" → wieder öffnen mit Undo; zweiter Weg „ab letzter Woche" → offene Woche abschließen; Kartenbreiten im Viewport; Konsole fehlerfrei. Production-Deep-Links liefern seit dem 2a-Merge HTTP 200.

- **Dashboard ohne leere Karten (Nutzerwunsch):** Hero mit Budget-Ring und „Voraussichtlich gespart" auf Basis des Standard-Einkommens (trägt ab Minute eins), genau ein „Nächster Schritt" (offene Wochen → erste Ausgabe → laufende Woche am Sa/So abschließen → Dauerauftrag anlegen, nur in den ersten zwei Wochen → „Alles erledigt" mit nächstem Abschlusstag), „Nur gespart" erklärt sich selbst, bis gebucht wurde; „Zuletzt ausgegeben" erscheint nur mit Inhalt; statt einer leeren Wochenliste zeigt die Karte „So läuft deine Woche" mit abgehaktem ersten Schritt.
- **„Reserviert" schon jetzt im Hero:** noch nicht gebuchte Daueraufträge der Woche zählen im Ring und in der Prognose mit (Logik existierte seit Phase 1; der animierte Ring und Warnungen bleiben Phase 3).
- **Laufende Woche abschließbar:** der nächste Schritt bietet das ab Samstag an; nachträgliche Ausgaben ziehen die Buchung automatisch nach. Abgeschlossene Wochen lassen sich über „Letzte Wochen" bearbeiten (Einkommen ändern) oder wieder öffnen (mit Rückgängig).
- **Onboarding** speichert in EINER Transaktion; der gewählte Budgetwert überschreibt auch die geseedete Standardzeile, sonst gälte für die Wochen nach dem Seed weiter A$400. Startguthaben mit fester ID → doppeltes Abschließen zahlt nicht doppelt ein.
- **Neuer Dauerauftrag bucht sofort**, was fällig ist (auch rückwirkend ab „Erste Fälligkeit", frühestens ab Tracking-Beginn); Rhythmusänderung/Fortsetzen holt nichts nach. Löschen mit Rückgängig (`recurring.restore`).
- **Im Browser-Test gefundener Layoutfehler:** Grid-Spalten ohne `minmax(0,1fr)`/`min-w-0` liefen durch lange nicht umbrechende Zeilen über den Bildschirmrand (Karten abgeschnitten). Behoben; Regel + Prüfmethode in `CLAUDE.md`. Meine alte Overflow-Prüfung konnte das nicht sehen, weil `main` den Überstand abschneidet – das Skript misst jetzt die Kartenbreiten.
- **Refactor aus 2a:** Kategorien-Raster als `CategoryGrid` extrahiert (Ausgabe + Dauerauftrag).
- **Bundle:** Start-Chunk 270 KB gzip (Ziel < 250 KB bleibt Phase 6: Lazy-Routes, `LazyMotion`).
- **Offen / Merker:** ~~Die Browser-Journeys liegen weiter nur im Scratchpad~~ → erledigt, siehe Zwischenschritt unten. Dev-Werkzeuge (Demo-Daten) gibt es nur im Dev-Build.

## Zwischenschritt – E2E-Smoke-Suite (vor Phase 3)

**Geprüft:** typecheck · lint · build grün · 478 Testläufe unverändert (die Suite läuft dort bewusst nicht mit) · `npm run test:e2e` **5× hintereinander grün** (6 Journeys, ~47 s inkl. Build) · einmal gegen Production (`E2E_BASE_URL=…vercel.app`) grün, Deep-Link `/recurring` HTTP 200 · **Mutationsprobe:** ohne Klick-Schlucken in `SwipeRow` wird genau die Wisch-Journey rot („a swipe opened a sheet"); ohne `minmax(0,1fr)`/`min-w-0` im Dashboard-Grid werden genau die beiden Dashboards mit abgeschlossener Woche rot, mit Elementnamen und Maßen (`16…438 px of 390`).

- **Umfang (wie gewünscht):** Onboarding (inkl. Reload: bleibt erledigt) · Ausgabe erfassen (Nächster-Schritt-Button und Tab-Bar) · Wisch-Löschen mit Undo, kurzer Wisch, Tipp · Wochenabschluss der laufenden Woche mit Wiederöffnen sowie Warteschlange „ab letzter Woche" · Breitenprüfung der Karten auf jedem Zwischenstand, dazu Desktop 1440×900 mit `N`-Shortcut. Nicht dabei: Daueraufträge, Kategorien, Light-Theme – bleiben bei RTL/Unit.
- **Läuft gegen das Production-Bundle** (`vite build` + `vite preview` auf Port 4178, startet und beendet die Suite selbst), nicht gegen den Dev-Server: näher an dem, was auf dem iPhone landet; Demo-Daten braucht sie nicht, weil jede Journey beim Onboarding beginnt. Mit `E2E_BASE_URL` auch gegen Preview/Production.
- **Feste Browser-Uhr** (Sonntag 2026-09-20 12:00, Zeitzone Sydney, per `Date`-Shim mit konstantem Offset): Das alte Skript übersprang den Abschluss der laufenden Woche an Mo–Fr stillschweigend und suchte die Wochenzeile über das Monatskürzel `Sep.` – beides wäre nächste Woche gekippt.
- **Robuster als die Scratchpad-Skripte:** keine festen Wartezeiten mehr (die beiden alten Skripte schliefen zusammen 48 s), Selektoren über Text/`aria-label` statt Tailwind-Klassen, Klick erst, wenn das Ziel stillsteht und oben liegt. Beim Umbau zwei Timing-Fallen gefunden, die die Sleeps verdeckt hatten (Overlay eines schließenden Sheets schluckt Tipps; Sheet-Titel steht vor dem Formular) – als Konvention in `CLAUDE.md`. Beides Eigenheiten der Suite, **kein App-Fehler**.
- **Schärfere Wisch-Prüfung:** „kein Sheet offen" nach dem Wisch hätte den 2a-Fehler heute nicht mehr gesehen, weil sich das Bearbeiten-Sheet inzwischen selbst schließt. Ein `MutationObserver` merkt sich deshalb, ob überhaupt je ein Overlay erschien.
- `puppeteer-core` lädt kein eigenes Chrome (nutzt das lokal installierte, `CHROME_PATH` überschreibt) → der Vercel-Build bleibt schlank. `.mjs` wie `scripts/` → ESLint/`tsc` unberührt.

## Phase 3 – Ergebnis & Abweichungen vom Plan

**Geprüft:** typecheck · lint · build grün · **596 Testläufe** (298 Tests × 2 Zeitzonen) · Coverage `src/lib` 99,8 % Zeilen / 100 % Funktionen / 94,9 % Branches · `npm run test:e2e` **8 Journeys grün, 3× hintereinander** (~52 s), darunter neu „Topf anlegen → einzahlen → aus dem Topf bezahlen" und „Budget ab dieser Woche ändern" · Sichtprüfung im echten Chrome mit Demo-Daten (390×844 dunkel, 1440×900 hell), Konsole fehlerfrei.
**DoD:** Budgetänderung heute lässt vergangene Wochen und Streak unberührt (Repo-Szenario + Dashboard-Test mit 12 Wochen + Budget-Seite schreibt nur die Zeile der laufenden Woche) · Warnung genau einmal je Schwelle und Woche (lib + Hook-Test unter StrictMode, inkl. Löschen/Wiederherstellen, App-Neustart, neue Woche; per Mutation gegengeprüft: ohne Protokoll fallen 2 Tests) · Topfstand = Summe der Buchungen · Umbuchung atomar ohne Überziehen · topf-finanzierte Ausgabe lässt Budget, Streak und Wochen-Sparsumme unberührt (Szenario in einer bereits abgeschlossenen Woche + E2E: Ring bleibt bei 0 %) · Prognose = `lib`-Fixtures · `checkLedgerInvariants` grün nach dem durchgespielten Szenario.

- **Eine Rechnung für Ring, Budget-Seite und Warnungen** (`lib/budget.runningWeekBudget`): ausgegeben **plus** noch nicht gebuchte Daueraufträge der Woche. Die Warnung geht damit nach derselben Zahl wie der Ring – sie kann also auch am Montag kommen, wenn die Miete das Budget schon zu 80 % verplant, und ebenso, wenn ein gesenktes Budget die Schwelle reißt. Der Hero rechnete das vorher selbst; das ist jetzt in der lib.
- **„Genau einmal" über ein Protokoll statt Vorher/Nachher-Vergleich:** `thresholdCrossed` (Phase 1) hätte nach Löschen + erneutem Erfassen ein zweites Mal gewarnt. `dueBudgetWarnings` vergleicht mit dem, was für diese Woche schon gemeldet wurde; wer 80 % überspringt, bekommt nur „aufgebraucht". Das Protokoll liegt pro Gerät in `localStorage` (kein Finanzdatum, gehört nicht ins Backup; ein zweites Gerät soll nicht stumm bleiben). Nebenwirkung: nach „Alle Daten löschen" mitten in der Woche bleibt es stumm, bis die nächste Woche beginnt.
- **Warnungen auch je Kategorie-Limit** (nicht nur gesamt) – Gesamt zuerst, dann die am weitesten überzogene Kategorie. Der Toast führt per „Budget" zur Budget-Seite.
- **Budget-Seite:** Regler in A$5-Schritten **und** Zahleneingabe je Zeile (beide an denselben Entwurf gebunden), „unverteilt / überbucht / alles verteilt", Farben und Balken reagieren live auf den Entwurf, geschrieben wird erst mit „Speichern" – und nur die Zeile der laufenden Woche. 0 bzw. leer = kein Limit (es wird kein Eintrag gespeichert). Eigener `AmountSlider` statt des generierten shadcn-Sliders (12-px-Griff, nicht touch-tauglich).
- **Dashboard:** Ring animiert per Spring ein und zeigt Reserviertes als blasseren Bogen; er ist zugleich der Link zum Budget, „Nur gespart" der Link zum Topf. Streak-Karte erscheint ab der ersten abgeschlossenen Woche und erklärt sich bei „pausiert" (offene Wochen) und „gerissen". Dafür lädt das Dashboard jetzt **alle** Ausgaben statt der letzten 8 Wochen (der Streak läuft über alle abgeschlossenen Wochen; ~1.000 Zeilen/Jahr).
- **Töpfe:** Liste mit Stand, Fortschritt und Prognosezeile; Detail mit Ring, „erreicht am …", „n Wochen vor/nach der Deadline", Spartempo, „nötig pro Woche", Verlauf mit Stand nach jeder Buchung. Umbuchen schlägt als Richtung „Nur gespart → dieser Topf" vor (der häufigste Fall), mit Tauschen-Button. **Zusätzlich zum Plan:** manuelle Buchungen lassen sich im Verlauf wegwischen (mit Rückgängig → neues `pots.restoreTransaction`, das dieselben Regeln erneut prüft) – sonst ließe sich ein Tippfehler nur durch eine Gegenbuchung beheben, die das Spartempo verfälscht. Abgeleitete Zeilen sind nicht löschbar; eine aus dem Topf bezahlte Ausgabe öffnet stattdessen ihr Bearbeiten-Sheet.
- **Prognose braucht eine abgeschlossene Woche:** Das Spartempo zählt nur beendete Wochen (Logik aus Phase 1). Direkt nach der ersten Umbuchung steht deshalb „Noch kein Spartempo" statt eines Datums – „nötig pro Woche" gibt es sofort.
- **„Aus Topf bezahlt"** sitzt hinter „Details" als „Bezahlt aus" (Wochenbudget ist Standard). Die zusammengeklappte Zeile nennt den Topf, das Formular verweigert das Überziehen nach der Repo-Regel und gibt einer bearbeiteten Ausgabe zurück, was sie selbst schon im Topf hält.
- **Im Browser gefunden (kein Unit-Test sah es):** Button-Label „Speichern · gilt ab dieser Woche" lief bei 390 px über den Nachbarn; die Kategoriezeile schnitt genau „… übrig/drüber" ab; drei Topf-Aktionen füllten ihre Buttons randvoll. Behoben; die Breitenprüfung der Smoke-Suite erkennt jetzt auch überlaufende Button-Texte (per Mutation bewiesen: „needs 307 px, has 208").
- **Smoke-Suite am Phasenende (wie gewünscht):** zwei Journeys wurden rot – beides Schwächen der Suite, kein App-Fehler: Der Klick auf die Wochenzeile lief nicht über den Helfer und traf unter der Tab-Bar das „+"; und der Helfer scrollte ein Ziel nur einmal ins Bild, ein noch aufklappendes Panel schob „Speichern" danach wieder hinaus. Der Helfer scrollt jetzt nach und sagt beim Timeout, was das Ziel verdeckt.
- **Bundle:** Start-Chunk 285 KB gzip (+15 KB; Ziel < 250 KB bleibt Phase 6: Lazy-Routes für Budget/Töpfe, `LazyMotion`).
- **Offen / Merker:** `AnimatedNumber` (Spring-Ticker für Beträge) ist weiterhin nicht gebaut. Mit offenen Details ist das Ausgaben-Sheet höher als der Bildschirm – „Speichern" ist erreichbar, aber erst nach Scrollen im Sheet (war schon in 2a so, „Bezahlt aus" macht es ~110 px länger). Eine Ausgabe, die aus einem inzwischen archivierten Topf bezahlt wurde, lässt sich erst nach „Wiederherstellen" des Topfs ändern.

## Phase 4 – Ergebnis & Abweichungen vom Plan

**Geprüft:** typecheck · lint · build grün · **736 Testläufe** (368 Tests × 2 Zeitzonen) · Coverage `src/lib` 99,9 % Zeilen / 100 % Funktionen / 95,4 % Branches · `npm run test:e2e` **9 Journeys grün, 3× hintereinander** (~62 s), neu: „Analyse zeichnet ihre Charts, Drilldown, EUR" bei 390 px · Sichtprüfung im echten Chrome mit Demo-Daten (390×844 dunkel **und** hell, 1440×900 hell; Wochen/Monate, 12 W/26 W/Alles, A$/€, Tabellenansicht, Drilldown, Tooltip), Konsole fehlerfrei, kein Element außerhalb des Viewports.
**DoD:** Chart-Werte = `lib/analytics` (die Seite reicht den Charts genau `buildAnalytics`/`toFlowRows`/`toDonutRows`/`toCumulativeRows` durch – Seitentest gegen die echte DB-Schicht vergleicht Zeile für Zeile; per Mutation gegengeprüft: ohne Monats-Einrasten, ohne Klemmen auf den Tracking-Beginn und mit „offene Woche zählt mit" fällt jeweils genau der zuständige Test) · lesbar bei 390 px in Dark + Light · Recharts im eigenen Lazy-Chunk (`charts` 115 KB gzip, Seite 8 KB; **Start-Chunk unverändert 286 KB**) · Skeletons in fester Plot-Höhe, Karten ohne Daten erklären sich selbst, kein Layout-Shift.

- **Reihenfolge nach dem `dataviz`-Skill: erst die Form, Farbe zuletzt.** „Verdient · Ausgegeben · Gespart" ist **eine gestapelte Säule je Woche** (Ausgegeben + Gespart = Verdient) mit einer Einkommens-Marke quer über der Säule – statt drei Balken je Woche (78 Balken bei 26 Wochen auf 286 px) oder drei Linien (Wochen sind abgeschlossene Einheiten, keine stetige Größe). In einer Minus-Woche sitzt die Marke IN den Ausgaben und der Fehlbetrag hängt unter der Nulllinie. Kategorien = Donut (ausdrücklich gewünscht) mit höchstens 5 Segmenten + „Übrige", Summe in der Mitte; Sparverlauf = eine Linie über blasser Fläche bis zur Nulllinie, neuester Punkt markiert. Jede Karte hat Tooltip (Werte führen, Serien als Strich-Schlüssel), Legende in Textfarbe und einen **Tabellen-Zwilling**; Marken ≤ 24 px, 4-px-Rundung nur am Daten-Ende, 2-px-Lücke in Flächenfarbe statt Rahmen, nie zwei y-Achsen.
- **Kontrast-/Farbprüfung (Validator des Skills, gegen `surface-1`):** Mint/Coral/Periwinkle haben im Dark-Theme reichlich Kontrast (10,7 / 6,6 / 7,6 : 1), sind als große Flächen aber zu hell (OKLCH L 0,81 / 0,72 / 0,74, Band 0,48–0,67). Charts tragen deshalb dieselben Farbtöne eine Stufe dunkler (`--chart-income/-spent/-saved` = `#738ce5 / #eb5d50 / #01a275`, Kontrast 5,7 / 5,4 / 5,6); Text, Ring und Buttons behalten die Markenfarben. Mint und Coral wurden in der Helligkeit so weit auseinandergezogen, dass das Paar auch bei Rot-Grün-Schwäche das Ziel erreicht (ΔE 8,4 in beiden Themes; vorher 7,3 / 7,9 = nur mit Zweitkodierung zulässig). Light: nur `--chart-spent` eine Spur dunkler als `--spent`.
- **Kategorie-Palette – ehrliches Ergebnis:** Neun Farbtöne in einem Helligkeitsband können die Paarprüfung nicht bestehen (Periwinkle↔Violett ΔE 0,4 bei gleicher Helligkeit; auch die beste durchgerechnete Stufung erreicht nur die Hälfte des Ziels und macht aus Gelb Oliv). Deshalb: Die Farbe folgt weiter der Kategorie (nie dem Rang), verwechselbare Familien sind in der Helligkeit gespreizt (Periwinkle/Violett jetzt ΔE 13), und **eine Kategorie wird nie nur über Farbe erkannt** – die Liste neben dem Donut ist Legende und Tabelle zugleich (Farbstrich, Icon, Name, Betrag, Anteil). **App-weite Folge:** `--cat-1…10` haben jetzt eigene Light-Stufen mit ≥ 3:1 auf Weiß (die Pastelltöne lagen bei ~1,5:1) – Chips und Icons im hellen Theme sind dadurch kräftiger.
- **Zeitraum endet immer mit der laufenden Woche und beginnt nie vor dem Tracking-Start** (sonst stünden leere „offene" Wochen davor). In der Monatsansicht rastet der Beginn auf die erste Woche seines Monats ein (Donnerstags-Regel) – kein angeschnittener Monat. **Monate zeigen den Ø pro abgeschlossener Woche**, nicht die Summe: Monate haben 4 oder 5 Wochen, Summen würden grundlos zickzacken (Summe und Wochenzahl stehen in Tooltip und Tabelle).
- **Offene Wochen getrennt:** Ihre Ausgaben erscheinen als blasse Säule („noch offen: bisher ausgegeben"), zählen aber in keine Summe, keinen Vergleich und nicht in den Sparverlauf – das Einkommen fehlt ja noch. Die Kacheln sagen das aus („1 Woche ist noch offen …"). Der Donut zählt sie mit (dort geht es um Ausgaben, nicht um Gespartes) und nennt den Betrag; aus Töpfen Bezahltes ist nicht drin und wird ebenfalls genannt.
- **Vorwochen-Vergleich = die zwei jüngsten ABGESCHLOSSENEN Wochen** (Monate: Ø pro Woche), nie die laufende – eine halbe Woche sieht immer wie eine Ersparnis aus. Delta-Chips mit Pfeil + Farbe nach „gut/schlecht" (mehr ausgegeben = Coral, weniger = Mint). Beste/schwächste Woche ab zwei Abschlüssen. **Sparverlauf startet im Zeitraum bei 0** (mit „Alles" = seit Beginn): eine Fläche braucht eine ehrliche Nulllinie; ein Fenster auf eine große Gesamtsumme wäre entweder flach oder abgeschnitten.
- **Drilldown:** Tipp auf Kategorie (Segment oder Zeile) → Verlauf je Woche/Monat in der Chart-Stufe ihrer eigenen Farbe (Wochen ohne Ausgabe = 0, nicht ausgelassen), Summe · Anteil · Ø pro Woche, die 5 größten Ausgaben (Tipp öffnet das Bearbeiten-Sheet), Tabellen-Zwilling. „Übrige (n)" klappt die kleinen Kategorien auf, jede ist wieder antippbar.
- **EUR:** Umschalter A$/€ in der Filterzeile, gespeichert in `Settings.showEur`; Achsen rechnen in EUR-Einheiten (runde Euro-Ticks), gerechnet wird weiter in A$-Cents. **Vorgezogen aus Phase 6 (mit dir abgestimmt am 2026-09-21):** das kleine Sheet „EUR-Kurs" (ein Feld `1 A$ = 0,61 €`, Live-Beispiel, Datum der letzten Änderung). Ohne Kurs öffnet der Umschalter dieses Sheet und schaltet nach dem Speichern auf € um; in den Einstellungen gibt es eine Karte dafür. Repo lehnt unbrauchbare Kurse ab (`invalid-rate`).
- **Recharts bleibt garantiert im Lazy-Chunk:** Import nur in `features/analytics/charts/` erlaubt (ESLint-Regel, per Probe-Datei bewiesen), die Karten laden diesen Ordner per `lazy()`; die Route selbst ist ebenfalls lazy. Die Zeilen, die ein Chart zeichnet, entstehen in `chartData.ts` (ohne Recharts) und sind dort getestet; in jsdom-Tests sind die Charts durch eine Klartext-Ausgabe ihrer Zeilen ersetzt (jsdom hat kein Layout, Recharts zeichnet dort nichts) – das echte SVG prüft die Smoke-Suite.
- **Von der Smoke-Suite gefunden (kein Unit-Test sah es):** Der gleitende Auswahl-Indikator des neuen `SegmentedControl` ragte während der Fahrt aus seinem Button („Wochen needs 92 px, has 75"). Er gleitet jetzt innerhalb der Gruppe. Zwei Eigenheiten der Werkzeuge, **kein App-Fehler:** `innerText` liefert per CSS großgeschriebene Überschriften – aus „Größte" wird „GRÖSSTE", darauf kann man nicht warten; und ein Ganzseiten-Screenshot ändert die Fenstergröße, Recharts animiert dann neu und das Bild zeigt leere Charts (Screenshots mit `prefers-reduced-motion` aufnehmen).
- **Bundle:** Start-Chunk 286 KB gzip (unverändert; Ziel < 250 KB bleibt Phase 6), `analytics` 8 KB, `charts` 115 KB – beide erst beim Öffnen der Analyse.
- **Offen / Merker:** keine Direktbeschriftung auf den Säulen (bei 11 px Breite nicht unterzubringen – Legende, Tooltip und Tabelle tragen die Werte) · kein Textur-Modus für `forced-colors`/Druck · Pfeiltasten im `SegmentedControl` und ein A11y-Pass bleiben Phase 6 (Recharts bringt Tastatur-Navigation der Tooltips mit) · `ThemeToggle` könnte auf `SegmentedControl` umziehen · `AnimatedNumber` weiterhin nicht gebaut.

## Phase 5a – Ergebnis & Abweichungen vom Plan

**Geprüft:** typecheck · lint · build grün · **782 Testläufe** (391 Tests × 2 Zeitzonen; neu: `lib/tasks`, Repo-Regeln für Tasks, RTL-Tests der Tasks-Seite mit Sheet gegen die echte DB-Schicht, Dashboard-Widget) · `npm run test:e2e` **10 Journeys grün, 3× hintereinander** (~70 s), neu: „Task anlegen → abhaken → rückgängig → Home-Widget" bei 390 px · Sichtprüfung im echten Chrome (390×844 dunkel **und** hell, 1440×900): leere Seite, Sheet leer/gefüllt, Liste mit überfälligem/heutigem/gekoppeltem Task, Erledigt-Abschnitt, Dashboard-Widget – Konsole fehlerfrei, kein Element außerhalb des Viewports.
**DoD (Task-Teil von Phase 5):** Anlegen, Bearbeiten, Abhaken, Zurücknehmen und Löschen laufen per Touch (Haken, Wisch, Presets) **und** Tastatur (der Haken ist ein `role="checkbox"`-Button, Löschen sitzt zusätzlich im Bearbeiten-Sheet, Enter im Titel speichert).

- **Datenmodell unverändert** – `Task`, `tasks`-Tabelle und `repos.tasks` stammen aus Phase 1, kein Schema-Sprung. Neu im Repo: Titel wird getrimmt und darf nicht leer sein (`invalid-title`), ein Topf-Verweis muss existieren (`unknown-pot`; archiviert erlaubt, der Fortschritt ist dann Geschichte), `setDone` ist idempotent (zweites Abhaken behält `doneAt`).
- **Reihenfolge aus `lib/tasks.sortTasks`:** offen vor erledigt; offene nach Fälligkeit (überfällige dadurch automatisch oben), undatierte danach, neueste zuerst; erledigte nach Erledigt-Zeitpunkt. **Gefunden im Dashboard-Test:** zwei Zeilen aus derselben Millisekunde hatten keine feste Reihenfolge (gleiches `createdAt`, zufällige UUID) → letzter Tiebreaker `id`, Regel in `CLAUDE.md`.
- **Überfällig = offen und `dueDate < today`** – ein zu spät erledigter Task ist einfach erledigt. Anzeige: Coral-Kante links, Label „Seit n Tagen überfällig" in Coral mit Icon, „Heute fällig" in Warning; Zähler im Untertitel („3 offen · 1 überfällig") und als Badge im Home-Widget.
- **Abhak-Animation mit verzögertem Schreiben:** Der Haken zeigt den Zustand sofort (Spring `bouncy` auf dem Strich, `pathLength` zeichnet), geschrieben wird nach 320 ms – mit Live-Queries wäre die Zeile sonst schon nach „Erledigt" gesprungen, bevor man den Haken sieht. Zurücknehmen schreibt sofort. Toast „„X" erledigt" mit Rückgängig, wie beim Löschen. **Werkzeug-Falle:** eine Keyframe-Liste (`scale: [1, 1.2, 1]`) mit Spring wirft in jsdom (Motion erlaubt Springs nur zwei Keyframes), im Browser fiel es nicht auf – der Überschwinger von `bouncy` ersetzt sie.
- **Topf-Kopplung = Verweis (Entscheidung):** Die Zeile zeigt Name, „A$1.000 von A$3.000" und den Balken aus `summarizePot`, als Link zum Topf; das Sheet bietet die Töpfe erst an, wenn es neben „Nur gespart" einen weiteren gibt, und sagt dazu „gebucht wird dadurch nichts". Dafür lädt das Dashboard jetzt alle Topf-Buchungen (statt nur die des Primär-Topfs); der Primär-Stand rechnet sich daraus.
- **Fälligkeit mit Presets** „Heute / Morgen / In 7 Tagen" (44 px, abwählbar) über dem Datumsfeld – am Telefon schneller als der Datepicker und in der Smoke-Suite klickbar. Beschriftung relativ bis sechs Tage („In 3 Tagen fällig"), danach „Fällig am Mo., 5. Okt."
- **Home-Widget nur mit Inhalt** (Home-Screen-Regel): höchstens 3 offene Tasks in Listenreihenfolge, „n weitere Tasks" als Link, Tipp auf den Titel öffnet das Sheet, Haken schreibt mit Rückgängig. Ohne offene Tasks fehlt die Karte; die Seite erreicht man über „Mehr".
- **Ein Sheet für alles:** `TaskSheet` ist einmal in `AppShell` gemountet (`uiStore.openTask`), damit Home-Widget und Tasks-Seite dasselbe Sheet nutzen; verschwindet der Task darunter, schließt es sich (Muster aus dem Ausgaben-Sheet).
- **Bundle:** Start-Chunk 290 KB gzip (+4 KB; Ziel < 250 KB bleibt Phase 6).
- **Offen / Merker:** keine Sortierung/Filter nach Kategorie (drei Kategorien, bewusst schlicht) · Notiz ist ein einzeiliges Feld · kein Umsortieren per Hand · Wiederkehrende Tasks nicht vorgesehen · Dashboard-Widget steht in der linken Spalte unter dem nächsten Schritt (auf dem Telefon unterhalb der ersten Bildschirmhöhe).

## Phase 5b – Ergebnis & Abweichungen vom Plan

**Geprüft:** typecheck · lint · build grün · **812 Testläufe** (406 Tests × 2 Zeitzonen; neu: `dashboardRules`, deutsche Texte je Insight-Art, Karte mit Wisch/X/Link, Merkliste in `localStorage`, Dashboard mit/ohne Karten) · `npm run test:e2e` **11 Journeys grün**, lokal und gegen die Preview, neu: „Insight erscheint → wegwischen → Rückgängig → per X ausblenden → bleibt nach Reload weg" bei 390 px · Sichtprüfung im echten Chrome (390×844 dunkel **und** hell, mit Demo-Daten: drei Karten Budget-Warnung, Topf vor dem Plan, Serie) – Konsole fehlerfrei, kein Element außerhalb des Viewports.

- **Regeln unverändert aus `lib/insights`** (seit Phase 1 getestet); neu ist nur `dashboardRules` = alle Regeln ohne `pending-weeks` (macht der Nächste Schritt) und `backup-stale` (kommt mit dem Export in Phase 6). Höchstens drei Karten nach Priorität, weggewischte werden vor dem Kürzen herausgefiltert – dann rückt die nächste nach.
- **Texte rendert die UI** (`features/insights/insightCopy.ts`): Titel, Satz, Icon (bei Kategorie/Topf dessen eigene Kachel) und ein Link zum Handeln („Budget", „Zum Topf", …).
- **Wegwischen** in beide Richtungen oder per X (Tastatur/Screenreader), Toast „Hinweis ausgeblendet" mit Rückgängig. Die IDs tragen die Woche, eine neue Woche bringt also einen neuen Hinweis; die Merkliste in `localStorage` (`fp.insightsDismissed`) ist auf 100 Einträge gedeckelt und synct zwischen Tabs.
- **Abschnitt nur mit Inhalt** (Home-Screen-Regel): ohne Karten fehlt die Überschrift „Insights" ganz. Karten stehen unter dem Nächsten Schritt, vor dem Tasks-Widget.
- **Bundle:** Start-Chunk 295 KB gzip (+5 KB; Ziel < 250 KB bleibt Phase 6).
- **Offen / Merker:** kein „Hinweise zurücksetzen" in den Einstellungen (Funktion `clearDismissedInsights` existiert) · wie das Warn-Protokoll gerätelokal, ein zweites Gerät zeigt weggewischte Karten wieder (gewollt).

## Phase 5c – Ergebnis & Abweichungen vom Plan

**Geprüft:** typecheck · lint · build grün · **844 Testläufe** (422 Tests × 2 Zeitzonen; Coverage `src/lib` 99,9 % Zeilen, `whatif.ts` 100 %; neu: `whatIfBase`, `toAdjustments`, `budgetFromScenario`, `horizonUntil`, `gainByCategory`, `formatDate`, Chart-Zeilen, RTL-Tests der Seite gegen die echte DB-Schicht: Startwert/Basis, Regler → Ergebnis = `projectScenario` für dieselben Zeilen, Zieldatum per Preset/Hand, Übernehmen mit Rückgängig, Selbsterklärung ohne Daten) · `npm run test:e2e` **12 Journeys grün**, neu: Rechner mit echtem Drag am Regler, Pfeiltasten, Kurve in beiden Ansichten, Preset, „Als Budget übernehmen" → Dashboard „von A$380" · Sichtprüfung im echten Chrome (390×844 dunkel **und** hell, 1440×900) mit Demo-Daten, Konsole fehlerfrei · Mutationsproben: ohne Zurücksetzen der Regler nach dem Übernehmen wird der RTL-Test rot; ohne `fromWeek` die neue Journey („+A$3.180" erscheint nie).
**DoD (Rechner-Teil von Phase 5):** Kurve folgt dem Ziehen ohne Animation (Punkte per `useDeferredValue`) · Ergebnis = `projectScenario` für dieselben Zeilen (RTL-Test vergleicht Zahl für Zahl, auch die Chart-Punkte).

- **Startwert = Summe aller Töpfe** (gelöschte Töpfe zählen nicht, archivierte sind per Regel leer). **Basis** = Ø Gespartes der letzten 8 abgeschlossenen Wochen; ohne abgeschlossene Woche Standard-Einkommen − Wochenbudget (so erklärt es die Karte auch).
- **Gefundener Rechenfehler (beim Schreiben der Journey):** Ist die laufende Woche schon abgeschlossen (Sa/So), steckt ihr Gespartes bereits im Topf – `projectScenario` hätte sie ein zweites Mal addiert. `whatIfBase.fromWeek` beginnt dann mit der nächsten Woche.
- **Regler „−A$X pro Woche"** je Kategorie, Spanne = max(Ø der letzten 8 abgeschlossenen Wochen, Limit), A$5-Schritte wie das Budget; Kategorien ohne Ausgaben und ohne Limit fehlen (nichts zu kürzen). Jede Zeile zeigt ihren eigenen Beitrag („+A$1.080 bis 20. Sep. 2027"), damit man am Telefon beim Ziehen etwas sieht, auch wenn das Ergebnis oben aus dem Bild ist.
- **Zieldatum:** Presets 3 Mon./6 Mon./1 Jahr (Standard)/2 Jahre plus Datumsfeld (nie vor heute).
- **Abweichung Kurve (Entscheidung):** Auf voller Skala liegen Basis und Szenario praktisch aufeinander (Demo: A$1.326 Basis pro Woche gegen A$30 Kürzung), beim Ziehen bewegt sich nichts Sichtbares. Deshalb zeigt die Kurve standardmäßig den **Unterschied** (Basis = Nulllinie in Grau, Vorsprung als Mint-Fläche), Umschalter „Gesamt" zeigt beide Stände mit angepasster Achse. Tabellen-Zwilling je Monatsende.
- **„Als Budget übernehmen":** Sheet zeigt alle Änderungen („Wochenbudget A$400 → A$370", „Essen gehen: kein Limit → A$40"), schreibt das Budget dieser Woche (gilt ab dieser Woche, frühere bleiben), setzt die Regler zurück (sonst würde ein zweites Übernehmen doppelt kürzen), Toast mit Rückgängig (stellt Budget und Regler wieder her). Folge: Liegt eine Kategorie diese Woche schon über dem neuen Limit, meldet sich sofort die übliche Budget-Warnung – gewollt, das Limit gilt ab jetzt.
- **Architektur:** `ChartCard`, `ChartTooltip` und das Chart-Theme liegen jetzt in `shared`, Recharts ist in jedem `features/<name>/charts/` erlaubt (ESLint) – beide Screens teilen sich den Recharts-Chunk. Route lazy (`WhatIfRoute`); `PlaceholderPage` entfernt (nicht mehr benutzt).
- **Bundle:** Start-Chunk 291 KB gzip (−4 KB durch die Lazy-Route; Ziel < 250 KB bleibt Phase 6).
- **Offen / Merker:** Szenario lebt nur bis zum Reload (bewusst: Skizze, kein Datensatz) · kein „mehr ausgeben"-Szenario (Regler nur nach unten, wie beauftragt) · offene vergangene Wochen fließen nicht in den Startwert (ihr Einkommen fehlt noch).

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

**Gate für jede Phase:** `npm run typecheck && npm run lint && npm run test && npm run build` grün · UI von mir im Browser geprüft (Chrome-Automation, 390×844 + 1440×900, Dark + Light, Konsole fehlerfrei) · ab Phase 3 zusätzlich `npm run test:e2e` grün (Smoke-Suite; neue Abläufe mit echten Gesten/Layout-Risiko bekommen dort eine Journey) · `docs/PLAN.md`-Checkboxen aktualisiert · kurze Phasen-Notiz + Screenshots an dich.

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
**Backup-Erinnerung ist Pflichtfeature (bestätigt 2026-09-22):** Sie kommt in dieser Phase als **Insight-Karte auf dem Dashboard** (Regel „Backup älter als 14 Tage" bzw. noch nie gesichert, aus `lib/insights`) **plus Hinweis in den Einstellungen** (Datum des letzten Backups, Aufforderung, wenn es fehlt oder alt ist). Grund: Auf iOS löscht das Entfernen des App-Icons die Daten (siehe Hinweis unter Phase 7).
**DoD:** App startet im Flugmodus vollständig · auf iPhone installiert, Safe-Areas/Statusbar korrekt · Export → „Alle Daten löschen" → Import stellt identischen Zustand her (automatisierter Roundtrip-Test + manuell am Gerät) · Backup-Erinnerung erscheint als Insight-Karte und in den Einstellungen · Lighthouse Performance/Best Practices/A11y ≥ 90 · initiales JS < 250 KB gzip · Production-URL steht.
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
