/*
 * Browser smoke suite – the flows that already had real bugs no unit test could see:
 * a swipe that "clicked" the row it deleted, and cards growing wider than the screen.
 * Every journey starts with an empty database and a pinned clock (see harness.mjs).
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import {
  DESKTOP,
  PHONE,
  assertFitsViewport,
  clickElement,
  clickSelector,
  clickText,
  clickToastAction,
  expenseRow,
  expenseRowCount,
  fillQuickAdd,
  goto,
  has,
  onboard,
  openModals,
  openSession,
  pressNumpad,
  saveScreenshot,
  sawModal,
  startSuite,
  stopSuite,
  swipe,
  swipeLeft,
  tapRow,
  typeInto,
  waitForAmount,
  waitForChart,
  waitForDownload,
  waitForExpenseRows,
  waitForModals,
  waitForNoText,
  waitForText,
  watchForModals,
} from './harness.mjs'

before(async () => {
  console.log(`e2e target: ${await startSuite()}`)
})
after(stopSuite)

function journey(name, viewport, run, options = {}) {
  test(name, { timeout: 120_000 }, async () => {
    const session = await openSession(viewport, options)
    try {
      await run(session.page)
      assert.deepEqual(session.problems, [], 'the browser console must stay clean')
    } catch (error) {
      console.log(`screenshot: ${await saveScreenshot(session.page, name)}`)
      throw error
    } finally {
      await session.close()
    }
  })
}

journey('onboarding leads to a dashboard that carries on day one', PHONE, async (page) => {
  await goto(page, '/')
  await waitForText(page, 'Willkommen beim Finanzplaner')
  assert.equal(await has(page, 'Analyse'), false, 'no app navigation during the onboarding')
  await assertFitsViewport(page, 'onboarding welcome')

  await clickText(page, 'button', 'Los geht')
  await waitForText(page, 'Was verdienst du pro Woche?')
  await clickText(page, 'button', 'Weiter', { exact: true })
  await waitForText(page, 'Wie viel willst du pro Woche höchstens ausgeben?')
  await clickText(page, 'button', 'A$500', { exact: true })
  await assertFitsViewport(page, 'onboarding budget')
  await clickText(page, 'button', 'Weiter', { exact: true })
  await waitForText(page, 'Wo startest du?')
  await typeInto(page, 'Startguthaben', '8500')
  await clickText(page, 'button', 'Fertig', { exact: true })

  await waitForText(page, 'Diese Woche')
  await waitForText(page, 'Erfasse deine erste Ausgabe')
  await waitForText(page, 'Voraussichtlich gespart')
  await waitForText(page, 'A$8.500,00') // opening balance landed in "Nur gespart"
  await waitForText(page, 'So läuft deine Woche') // explains itself instead of an empty list
  assert.equal(await has(page, 'Letzte Wochen'), false)
  await assertFitsViewport(page, 'dashboard on day one')

  await page.reload({ waitUntil: 'networkidle0' })
  await waitForText(page, 'Erfasse deine erste Ausgabe')
  assert.equal(await has(page, 'Willkommen beim Finanzplaner'), false, 'onboarding stays done')
})

journey('an expense is captured in a few taps', PHONE, async (page) => {
  await onboard(page)

  // from the next-step card on the home screen
  await clickText(page, 'button', 'Ausgabe erfassen')
  await fillQuickAdd(page, ['4', '5'], 'Lebensmittel')
  await waitForText(page, 'Zuletzt ausgegeben')
  await waitForText(page, 'A$45,00')
  await assertFitsViewport(page, 'dashboard with a first expense')

  // from the tab bar on the expense list
  await goto(page, '/expenses')
  await waitForExpenseRows(page, 1)
  await clickSelector(page, 'button[aria-label="Neue Ausgabe"]')
  await fillQuickAdd(page, ['1', '2', 'Komma', '5'], 'Lebensmittel')
  await waitForExpenseRows(page, 2)
  await waitForText(page, 'A$12,50')
  await waitForText(page, 'Rückgängig') // the save toast offers undo
  await assertFitsViewport(page, 'expense list')
})

journey('swipe deletes with undo and never opens the row', PHONE, async (page) => {
  await onboard(page)
  await goto(page, '/expenses')
  await clickSelector(page, 'button[aria-label="Neue Ausgabe"]')
  await fillQuickAdd(page, ['1', '2', 'Komma', '5'], 'Lebensmittel')
  await waitForExpenseRows(page, 1)

  // long swipe = delete; the click the browser fires afterwards must not open the edit sheet
  await watchForModals(page)
  await swipeLeft(page, await expenseRow(page, 'A$12,50'), 240)
  await waitForExpenseRows(page, 0)
  await waitForText(page, 'A$12,50 gelöscht')
  assert.equal(await sawModal(page), false, 'a swipe opened a sheet')

  await clickToastAction(page, 'gelöscht', 'Rückgängig')
  await waitForExpenseRows(page, 1)

  // short swipe = only reveal the delete button; a tap closes it again instead of opening the row
  const row = await expenseRow(page, 'A$12,50')
  const restingLeft = (await row.boundingBox()).x
  await watchForModals(page)
  await swipeLeft(page, row, 70)
  await page.waitForFunction(
    (el, left) => el.getBoundingClientRect().left < left - 40,
    {},
    row,
    restingLeft,
  )
  assert.equal(await expenseRowCount(page), 1, 'a short swipe keeps the row')
  await tapRow(page, await expenseRow(page, 'A$12,50'))
  await page.waitForFunction(
    (el, left) => Math.abs(el.getBoundingClientRect().left - left) < 1,
    {},
    row,
    restingLeft,
  )
  assert.equal(await sawModal(page), false, 'tapping a revealed row opened a sheet')

  // and a plain tap is a tap again
  await tapRow(page, await expenseRow(page, 'A$12,50'))
  await waitForModals(page, 1)
  await waitForText(page, 'Ausgabe bearbeiten')
  await waitForAmount(page, 'A$12,50') // the edit sheet shows the stored amount
})

journey('the running week can be closed, shown and reopened', PHONE, async (page) => {
  await onboard(page)
  await clickText(page, 'button', 'Ausgabe erfassen')
  await fillQuickAdd(page, ['4', '5'], 'Lebensmittel')

  // the pinned clock says Sunday → closing the running week is the next step
  await clickText(page, 'button', 'Diese Woche abschließen')
  await waitForModals(page, 1)
  await clickText(page, 'button', 'Woche abschließen', { exact: true })
  await waitForText(page, 'In „Nur gespart" gebucht')
  await clickText(page, 'button', 'Fertig', { exact: true })
  await waitForModals(page, 0)

  await waitForText(page, 'Woche abgeschlossen')
  await waitForText(page, 'Letzte Wochen')
  await waitForText(page, 'A$1.955,00') // default income A$2.000 − A$45
  await assertFitsViewport(page, 'dashboard with a closed week') // the phase 2b layout bug sat here

  // closed weeks open in edit mode and can be reopened
  const weekRow = await page.evaluateHandle(() =>
    [...document.querySelectorAll('main section')]
      .find((section) => section.querySelector('h2')?.textContent === 'Letzte Wochen')
      ?.querySelector('button'),
  )
  await clickElement(page, weekRow.asElement())
  await waitForText(page, 'Woche bearbeiten')
  await clickText(page, 'button', 'Woche wieder öffnen')
  await waitForText(page, 'Woche wieder geöffnet')
  await waitForNoText(page, 'Letzte Wochen')
  assert.equal(await openModals(page), 0)
})

journey('a week that ended before today waits in the queue', PHONE, async (page) => {
  await onboard(page, { tracking: 'Ab letzter Woche' })
  await waitForText(page, 'Eine Woche wartet auf ihren Abschluss')
  await assertFitsViewport(page, 'dashboard with a pending week')

  await clickText(page, 'main button', 'abschließen')
  await waitForModals(page, 1)
  await clickText(page, 'button', 'Woche abschließen', { exact: true })
  await waitForText(page, 'In „Nur gespart" gebucht')
  await waitForText(page, 'A$2.000,00') // the default income was booked
  await clickText(page, 'button', 'Fertig', { exact: true })
  await waitForModals(page, 0)

  await waitForNoText(page, 'wartet auf ihren Abschluss')
  await waitForText(page, 'Letzte Wochen')
  await assertFitsViewport(page, 'dashboard after catching up')
})

journey('a pot is created, filled and pays for an expense', PHONE, async (page) => {
  await onboard(page)
  await goto(page, '/pots')
  await waitForText(page, 'Wofür sparst du?') // only "Nur gespart" so far → the screen explains pots
  await assertFitsViewport(page, 'pots list')

  // create
  await clickText(page, 'main button', 'Topf anlegen', { exact: true })
  await waitForModals(page, 1)
  await typeInto(page, 'Name', 'Bali')
  await typeInto(page, 'Zielbetrag', '3000')
  await clickText(page, '[role="dialog"] button', 'Topf anlegen', { exact: true })
  await waitForModals(page, 0)
  await waitForText(page, 'Noch keine Buchungen') // landed on the new pot's screen
  await waitForText(page, 'es fehlen A$3.000,00')
  await assertFitsViewport(page, 'empty pot')

  // deposit
  await clickText(page, 'main button', 'Einzahlen', { exact: true })
  await waitForModals(page, 1)
  await typeInto(page, 'Betrag', '1000')
  await clickText(page, '[role="dialog"] button', 'Einzahlen', { exact: true })
  await waitForModals(page, 0)
  await waitForText(page, 'es fehlen A$2.000,00')
  await waitForText(page, '33 %')
  await waitForText(page, 'Einzahlung')

  // pay a big one-off from the pot
  await clickSelector(page, 'button[aria-label="Neue Ausgabe"]')
  await waitForModals(page, 1)
  await pressNumpad(page, ['8', '0', '0'])
  await clickText(page, '[role="radio"]', 'Reisen')
  await clickText(page, '[role="dialog"] button', 'Details')
  await clickText(page, '[role="radio"]', 'Bali')
  await waitForText(page, 'Zählt nicht zum Wochenbudget · A$1.000,00 im Topf')
  await clickText(page, 'button', 'Speichern', { exact: true })
  await waitForModals(page, 0)

  // the pot paid …
  await waitForText(page, 'Ausgabe aus dem Topf')
  await waitForText(page, 'es fehlen A$2.800,00')
  await assertFitsViewport(page, 'pot with history')

  // … and the weekly budget did not
  await goto(page, '/')
  await waitForText(page, 'Zuletzt ausgegeben')
  const used = await page.$eval('[aria-label="Wochenbudget verbraucht"]', (ring) =>
    ring.getAttribute('aria-valuenow'),
  )
  assert.equal(used, '0', 'a pot-paid expense must not use up the weekly budget')
  await goto(page, '/pots')
  await waitForText(page, 'Gesamt A$200,00')
  await assertFitsViewport(page, 'pots list with a goal')
})

journey('the budget is changed from this week on', PHONE, async (page) => {
  await onboard(page)
  await goto(page, '/budget')
  await waitForText(page, 'Limits je Kategorie')
  await assertFitsViewport(page, 'budget')

  await typeInto(page, 'Wochenbudget', '300')
  await typeInto(page, 'Limit Lebensmittel', '120')
  await waitForText(page, 'A$180,00 unverteilt')
  // the save bar floats above the tab bar – it has to be reachable, not hidden behind it
  await waitForText(page, 'Gilt ab dieser Woche – vergangene Wochen bleiben')
  await assertFitsViewport(page, 'budget with the save bar')
  await clickText(page, 'main button', 'Speichern', { exact: true })
  await waitForText(page, 'Budget gespeichert')
  await waitForNoText(page, 'Verwerfen')
  await assertFitsViewport(page, 'budget after saving')

  await goto(page, '/')
  await waitForText(page, 'von A$300')
})

journey(
  'the analysis draws its charts, drills into a category and switches to EUR',
  PHONE,
  async (page) => {
    // two closed weeks: last week from the queue, then the running one with an expense in it
    await onboard(page, { tracking: 'Ab letzter Woche' })
    await clickText(page, 'main button', 'abschließen')
    await waitForModals(page, 1)
    await clickText(page, 'button', 'Woche abschließen', { exact: true })
    await waitForText(page, 'In „Nur gespart" gebucht')
    await clickText(page, 'button', 'Fertig', { exact: true })
    await waitForModals(page, 0)
    await clickText(page, 'button', 'Ausgabe erfassen')
    await fillQuickAdd(page, ['4', '5'], 'Lebensmittel')
    await clickText(page, 'button', 'Diese Woche abschließen')
    await waitForModals(page, 1)
    await clickText(page, 'button', 'Woche abschließen', { exact: true })
    await waitForText(page, 'In „Nur gespart" gebucht')
    await clickText(page, 'button', 'Fertig', { exact: true })
    await waitForModals(page, 0)

    // the screen (and Recharts with it) arrives as a lazy chunk
    await goto(page, '/analytics')
    await waitForText(page, 'Aus 2 Wochen mit Abschluss.')
    await waitForText(page, 'A$3.955') // saved: A$2.000 + (A$2.000 − A$45)
    await waitForChart(page, 'Verdient, ausgegeben, gespart: Chart')
    await waitForChart(page, 'Kategorien: Chart')
    await waitForChart(page, 'Sparverlauf: Chart')
    await waitForText(page, 'Letzte Woche im Vergleich')
    await waitForText(page, 'Beste und schwächste Woche')
    await assertFitsViewport(page, 'analysis by week')

    await clickText(page, '[role="radio"]', 'Monate', { exact: true })
    await waitForText(page, 'Ø pro Woche je Monat')
    await waitForChart(page, 'Verdient, ausgegeben, gespart: Chart')
    await assertFitsViewport(page, 'analysis by month')
    await clickText(page, '[role="radio"]', 'Wochen', { exact: true })

    // every chart has a table twin
    await clickSelector(
      page,
      'button[aria-label="Verdient, ausgegeben, gespart: als Tabelle anzeigen"]',
    )
    await waitForText(page, '14.–20. Sep.')
    await assertFitsViewport(page, 'analysis with the table view')
    await clickSelector(
      page,
      'button[aria-label="Verdient, ausgegeben, gespart: als Chart anzeigen"]',
    )
    await waitForChart(page, 'Verdient, ausgegeben, gespart: Chart')

    // drill into the only category and back
    await clickText(page, 'main button', 'Lebensmittel')
    await waitForText(page, 'A$45 im Zeitraum') // (not the heading: CSS uppercases its ß to SS)
    await waitForChart(page, 'Lebensmittel: Chart')
    await assertFitsViewport(page, 'analysis drill-down')
    await clickText(page, 'main button', 'Alle Kategorien')
    await waitForText(page, 'Wofür das Geld wegging')

    // EUR needs a rate first: the switch asks for it, then shows euros
    await clickSelector(page, '[role="radio"][aria-label="Euro"]')
    await waitForModals(page, 1)
    await typeInto(page, 'EUR-Kurs', '0,6')
    await waitForText(page, 'A$1.000,00 entsprechen 600,00')
    await clickText(page, '[role="dialog"] button', 'Speichern', { exact: true })
    await waitForModals(page, 0)
    await waitForText(page, '2.373') // A$3.955 × 0,6
    await waitForNoText(page, 'A$3.955')
    await assertFitsViewport(page, 'analysis in EUR')
  },
)

journey('a task is created, ticked off and brought back', PHONE, async (page) => {
  await onboard(page)
  await goto(page, '/tasks')
  await waitForText(page, 'Was steht an?') // no tasks yet → the screen explains them
  await assertFitsViewport(page, 'tasks empty')

  await clickText(page, 'main button', 'Task anlegen', { exact: true })
  await waitForModals(page, 1)
  await typeInto(page, 'Titel', 'Steuernummer beantragen')
  await clickText(page, '[role="dialog"] button', 'Heute', { exact: true })
  await clickText(page, '[role="dialog"] [role="radio"]', 'Behörden', { exact: true })
  await assertFitsViewport(page, 'task sheet')
  await clickText(page, '[role="dialog"] button', 'Task anlegen', { exact: true })
  await waitForModals(page, 0)
  await waitForText(page, 'Heute fällig')
  await waitForText(page, '1 offen')
  await assertFitsViewport(page, 'tasks list')

  // the tick shows first, then the row moves to "Erledigt" – and the toast offers undo
  await clickSelector(page, `button[aria-label='„Steuernummer beantragen" erledigen']`)
  await waitForText(page, '„Steuernummer beantragen" erledigt')
  await waitForText(page, 'Alles erledigt')
  await waitForText(page, 'Heute erledigt')
  await assertFitsViewport(page, 'tasks with a finished task')
  await clickToastAction(page, 'erledigt', 'Rückgängig')
  await waitForText(page, '1 offen')
  await waitForNoText(page, 'Alles erledigt')

  // … and it is back on the home screen
  await goto(page, '/')
  await waitForText(page, 'Steuernummer beantragen')
  await waitForText(page, 'Heute fällig')
  await assertFitsViewport(page, 'dashboard with a task')
})

journey('an insight card appears, is swiped away and stays away', PHONE, async (page) => {
  await onboard(page)
  await clickText(page, 'button', 'Ausgabe erfassen')
  await fillQuickAdd(page, ['4', '5', '0'], 'Lebensmittel') // A$450 against the A$400 default
  const card = () => page.waitForSelector('[role="article"][aria-label="A$50,00 über dem Budget"]')
  await card()
  await assertFitsViewport(page, 'dashboard with an insight')

  // swipe it away (to the right here; either direction works) – undo brings it back
  await swipe(page, await card(), 260)
  await waitForNoText(page, 'A$50,00 über dem Budget')
  await waitForText(page, 'Hinweis ausgeblendet')
  assert.equal(await has(page, 'Insights'), false, 'an empty insights section is left out')
  await clickToastAction(page, 'Hinweis ausgeblendet', 'Rückgängig')
  await card()

  // the accessible path, then a reload: the dismissal lives on this device
  await clickSelector(page, 'button[aria-label="Hinweis ausblenden: A$50,00 über dem Budget"]')
  await waitForNoText(page, 'A$50,00 über dem Budget')
  await page.reload({ waitUntil: 'networkidle0' })
  await waitForText(page, 'Zuletzt ausgegeben')
  assert.equal(await has(page, 'über dem Budget'), false, 'a dismissed insight came back')
  await assertFitsViewport(page, 'dashboard after dismissing the insight')
})

journey('the what-if calculator answers live and becomes the budget', PHONE, async (page) => {
  // one closed week with A$60 eating out: that is what the slider can cut
  await onboard(page)
  await clickText(page, 'button', 'Ausgabe erfassen')
  await fillQuickAdd(page, ['6', '0'], 'Essen gehen')
  await clickText(page, 'button', 'Diese Woche abschließen')
  await waitForModals(page, 1)
  await clickText(page, 'button', 'Woche abschließen', { exact: true })
  await waitForText(page, 'In „Nur gespart" gebucht')
  await clickText(page, 'button', 'Fertig', { exact: true })
  await waitForModals(page, 0)

  // reached through "Mehr" – the route loads lazily
  await clickSelector(page, 'a[aria-label="Mehr"]')
  await clickText(page, 'a', 'Was-wäre-wenn')
  await waitForText(page, 'Bis 20. Sep. 2027 in allen Töpfen')
  await waitForText(page, 'Start: A$1.940 in allen Töpfen')
  await assertFitsViewport(page, 'what-if before a cut')

  // a real drag to the end of the track: A$60 less a week, 53 weeks from the next Monday
  const slider = '[role="slider"][aria-label="Weniger für Essen gehen pro Woche"]'
  await swipe(page, await page.waitForSelector(slider), 400)
  await waitForText(page, 'Bis 20. Sep. 2027 mehr gespart')
  await waitForText(page, '+A$3.180')
  // arrow keys step by A$5
  await page.focus(slider)
  for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowLeft')
  await waitForText(page, '+A$1.060 bis 20. Sep. 2027')
  await waitForChart(page, 'Verlauf: Chart')
  await clickText(page, '[role="radio"]', 'Gesamt')
  await waitForChart(page, 'Verlauf: Chart')
  await clickText(page, '[role="radio"]', '3 Mon.')
  await waitForText(page, 'Bis 20. Dez. 2026 mehr gespart')
  await assertFitsViewport(page, 'what-if with a cut')

  await clickText(page, 'main button', 'Als Budget übernehmen')
  await waitForModals(page, 1)
  await waitForText(page, 'kein Limit') // eating out had none: A$60 average − A$20
  await assertFitsViewport(page, 'adopt-as-budget sheet')
  await clickText(page, 'button', 'Übernehmen', { exact: true })
  await waitForText(page, 'Budget übernommen')
  await waitForModals(page, 0)
  await waitForText(page, 'Bis 20. Dez. 2026 in allen Töpfen') // the sliders start over

  await goto(page, '/')
  await waitForText(page, 'von A$380')
})

journey('the installed app starts and works without network', PHONE, async (page) => {
  await onboard(page)
  await clickText(page, 'button', 'Ausgabe erfassen')
  await fillQuickAdd(page, ['1', '2'], 'Lebensmittel')
  // the service worker has installed (precache complete); the first visit is not controlled
  // yet – after one reload the worker serves every request
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload({ waitUntil: 'networkidle0' })
  assert.ok(await page.evaluate(() => navigator.serviceWorker.controller !== null))

  await page.setOfflineMode(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForText(page, 'Zuletzt ausgegeben') // data from IndexedDB, code from the cache
    await waitForText(page, 'A$12,00')
    // a lazy route and a deep link work offline too
    await clickText(page, 'nav a', 'Ausgaben')
    await waitForExpenseRows(page, 1)
    await page.goto(page.url().replace(/\/expenses$/, '/what-if'), {
      waitUntil: 'domcontentloaded',
    })
    await waitForText(page, 'Zieldatum')
  } finally {
    await page.setOfflineMode(false)
  }
})

const DOWNLOADS = mkdtempSync(join(tmpdir(), 'fp-e2e-'))

journey(
  'a backup is saved, played back, undone – and "Alle Daten löschen" starts over',
  PHONE,
  async (page) => {
    await onboard(page)
    await clickText(page, 'button', 'Ausgabe erfassen')
    await fillQuickAdd(page, ['1', '2'], 'Lebensmittel')

    // save: a real download of the JSON (on an iPhone it would be the share sheet)
    await goto(page, '/settings')
    await waitForText(page, 'Noch kein Backup gespeichert')
    await assertFitsViewport(page, 'settings')
    await clickText(page, 'main button', 'Backup speichern')
    await waitForText(page, 'Letztes Backup: heute.')
    const file = await waitForDownload(DOWNLOADS, /^finanzplaner-backup-.*\.json$/)
    const backup = JSON.parse(readFileSync(file, 'utf8'))
    assert.equal(backup.app, 'finance-planner')
    assert.deepEqual(
      backup.data.expenses.map((expense) => expense.amountCents),
      [1200],
    )

    // one more expense, then play the file back: the second one is gone again
    await goto(page, '/')
    await clickSelector(page, 'button[aria-label="Neue Ausgabe"]')
    await fillQuickAdd(page, ['3', '4'], 'Transport')
    await goto(page, '/settings')
    await waitForText(page, 'Letztes Backup: heute.')
    const input = await page.$('input[type="file"]')
    await input.uploadFile(file)
    await waitForModals(page, 1)
    await waitForText(page, 'Ersetzt alle Daten auf diesem Gerät')
    await clickText(page, '[role="dialog"] button', 'Einspielen', { exact: true })
    await waitForText(page, 'Backup eingespielt') // after the reload
    await goto(page, '/expenses')
    await waitForExpenseRows(page, 1)

    // "Import rückgängig" brings the state from before the import back
    await goto(page, '/settings')
    await clickText(page, 'main button', 'Import rückgängig')
    await waitForText(page, 'Import rückgängig gemacht')
    await goto(page, '/expenses')
    await waitForExpenseRows(page, 2)

    // "Alle Daten löschen": a tap does nothing, holding the key does it
    await goto(page, '/settings')
    await clickText(page, 'main button', 'Alle Daten löschen')
    await waitForModals(page, 1)
    await clickText(page, '[role="dialog"] button', 'Gedrückt halten zum Löschen')
    assert.equal(await openModals(page), 1, 'a tap must not delete anything')
    await page.evaluate(() =>
      [...document.querySelectorAll('[role="dialog"] button')]
        .find((button) => button.textContent === 'Gedrückt halten zum Löschen')
        .focus(),
    )
    await page.keyboard.down(' ')
    await waitForText(page, 'Willkommen beim Finanzplaner') // wiped and reloaded
    await page.keyboard.up(' ')
  },
  { downloadPath: DOWNLOADS },
)

journey('desktop layout keeps every card inside the window', DESKTOP, async (page) => {
  await goto(page, '/')
  await waitForText(page, 'Willkommen beim Finanzplaner')
  await assertFitsViewport(page, 'desktop onboarding')

  await onboard(page)
  await page.keyboard.press('n') // shortcut for "Neue Ausgabe"
  await waitForModals(page, 1)
  // the sheet is a lazy chunk and the form follows its live query: type once the amount is there
  await waitForAmount(page, 'A$0')
  await page.keyboard.type('8,5')
  await waitForAmount(page, 'A$8,5') // the hardware keyboard types the amount
  await clickText(page, '[role="radio"]', 'Lebensmittel')
  await clickText(page, 'button', 'Speichern', { exact: true })
  await waitForModals(page, 0)

  await waitForText(page, 'Zuletzt ausgegeben')
  await assertFitsViewport(page, 'desktop dashboard')
  await goto(page, '/expenses')
  await waitForExpenseRows(page, 1)
  await assertFitsViewport(page, 'desktop expense list')
})
