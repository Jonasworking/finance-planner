/*
 * Browser smoke suite – the flows that already had real bugs no unit test could see:
 * a swipe that "clicked" the row it deleted, and cards growing wider than the screen.
 * Every journey starts with an empty database and a pinned clock (see harness.mjs).
 */
import assert from 'node:assert/strict'
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
  swipeLeft,
  tapRow,
  typeInto,
  waitForAmount,
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

function journey(name, viewport, run) {
  test(name, { timeout: 120_000 }, async () => {
    const session = await openSession(viewport)
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

journey('desktop layout keeps every card inside the window', DESKTOP, async (page) => {
  await goto(page, '/')
  await waitForText(page, 'Willkommen beim Finanzplaner')
  await assertFitsViewport(page, 'desktop onboarding')

  await onboard(page)
  await page.keyboard.press('n') // shortcut for "Neue Ausgabe"
  await waitForModals(page, 1)
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
