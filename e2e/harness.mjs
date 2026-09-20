/*
 * Harness of the browser smoke suite: serves the production bundle, drives a real Chrome via
 * puppeteer-core and offers the few helpers the journeys need. Not part of the normal gate –
 * run it with `npm run test:e2e`.
 *
 *   E2E_BASE_URL  test a running server (dev server, Vercel URL) instead of building + previewing
 *   CHROME_PATH   Chrome/Chromium binary (default: the macOS app)
 *   E2E_HEADFUL   set to 1 to watch the run
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const VITE_BIN = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const ARTIFACTS = fileURLToPath(new URL('./artifacts/', import.meta.url))
const PREVIEW_PORT = 4178
const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export const PHONE = {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
}
export const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 }

/*
 * The browser clock is pinned to a Sunday noon in Sydney: the home screen offers "close this
 * week" only on Sat/Sun, so without it the suite would test different things on different days.
 * The offset is computed once, so time keeps flowing and stays monotonic across reloads.
 */
const TIME_ZONE = 'Australia/Sydney'
const PINNED_NOW = Date.UTC(2026, 8, 20, 2, 0, 0) // Sunday 2026-09-20, 12:00 AEST
const CLOCK_OFFSET = PINNED_NOW - Date.now()

const MODAL_OVERLAYS = '[data-slot="drawer-overlay"], [data-slot="dialog-overlay"]'

let baseUrl = ''
let preview = null
let browser = null

async function reachable(url) {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

async function startPreview() {
  const build = spawnSync(process.execPath, [VITE_BIN, 'build'], { cwd: ROOT, encoding: 'utf8' })
  if (build.status !== 0) throw new Error(`vite build failed:\n${build.stdout}\n${build.stderr}`)

  const url = `http://localhost:${PREVIEW_PORT}`
  let output = ''
  preview = spawn(
    process.execPath,
    [VITE_BIN, 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
    { cwd: ROOT },
  )
  preview.stdout.on('data', (chunk) => (output += chunk))
  preview.stderr.on('data', (chunk) => (output += chunk))

  for (let attempt = 0; attempt < 100; attempt++) {
    if (preview.exitCode !== null) break
    if (await reachable(url)) return url
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`vite preview did not come up on port ${PREVIEW_PORT}:\n${output}`)
}

export async function startSuite() {
  const executablePath = process.env.CHROME_PATH ?? DEFAULT_CHROME
  if (!existsSync(executablePath)) {
    throw new Error(`Chrome not found at "${executablePath}" – set CHROME_PATH to a Chrome binary.`)
  }
  baseUrl = process.env.E2E_BASE_URL?.replace(/\/+$/, '') ?? (await startPreview())
  browser = await puppeteer.launch({ executablePath, headless: process.env.E2E_HEADFUL !== '1' })
  return baseUrl
}

export async function stopSuite() {
  await browser?.close()
  preview?.kill()
}

/** One journey = one browser context = fresh storage, i.e. an empty database. */
export async function openSession(viewport) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.setDefaultTimeout(10_000)
  await page.setViewport(viewport)
  await page.emulateTimezone(TIME_ZONE)
  await page.evaluateOnNewDocument((offset) => {
    const RealDate = Date
    class ShiftedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(RealDate.now() + offset)
        else super(...args)
      }
      static now() {
        return RealDate.now() + offset
      }
    }
    window.Date = ShiftedDate
  }, CLOCK_OFFSET)

  const problems = []
  page.on('console', (message) => {
    if (['error', 'warn', 'warning'].includes(message.type())) {
      problems.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))

  return { page, problems, close: () => context.close() }
}

export async function saveScreenshot(page, name) {
  mkdirSync(ARTIFACTS, { recursive: true })
  const file = `${ARTIFACTS}${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
  await page.screenshot({ path: file }).catch(() => {})
  return file
}

export const goto = (page, path) => page.goto(baseUrl + path, { waitUntil: 'networkidle0' })

// ---------- reading the screen ----------

// Headings are uppercased via CSS and innerText reports them that way → compare case-insensitively.
const screenIncludes = (needle) => document.body.innerText.toLowerCase().includes(needle)

export const has = (page, text) => page.evaluate(screenIncludes, text.toLowerCase())

export const waitForText = (page, text) =>
  page.waitForFunction(screenIncludes, {}, text.toLowerCase()).catch(() => {
    throw new Error(`text never appeared: "${text}"`)
  })

export const waitForNoText = (page, text) =>
  page
    .waitForFunction(
      (needle) => !document.body.innerText.toLowerCase().includes(needle),
      {},
      text.toLowerCase(),
    )
    .catch(() => {
      throw new Error(`text never disappeared: "${text}"`)
    })

/** Only VISIBLE elements count – the desktop sidebar is in the DOM on phones, just hidden. */
async function findByText(page, selector, text, exact) {
  const handle = await page
    .waitForFunction(
      (sel, needle, isExact) =>
        [...document.querySelectorAll(sel)].find((el) => {
          const content = el.textContent.trim()
          const rect = el.getBoundingClientRect()
          const matches = isExact ? content === needle : content.includes(needle)
          return matches && rect.width > 0 && rect.height > 0
        }),
      {},
      selector,
      text,
      exact,
    )
    .catch(() => {
      throw new Error(`not found: ${selector} "${text}"`)
    })
  return handle.asElement()
}

/**
 * Puppeteer clicks coordinates, not elements. Sheets slide in, steps cross-fade, a closing sheet
 * keeps its overlay on top until the animation ends, and the tab bar floats above the end of the
 * page – so wait until the target has stopped moving AND is what a finger would actually hit at
 * its centre. While it is out of sight it is scrolled back in: a panel that is still expanding
 * pushes whatever is below it out of view again after a single scroll.
 */
async function waitUntilActionable(page, element) {
  await element.evaluate((el) => {
    delete el.__e2eRect
    delete el.__e2eStillFrames
  })
  await page
    .waitForFunction(
      (el) => {
        const rect = el.getBoundingClientRect()
        const key = [rect.x, rect.y, rect.width, rect.height].join()
        el.__e2eStillFrames = el.__e2eRect === key ? (el.__e2eStillFrames ?? 0) + 1 : 0
        el.__e2eRect = key
        if (el.__e2eStillFrames < 4) return false
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        if (hit !== null && (el.contains(hit) || hit.contains(el))) return true
        // Still, but not reachable: bring it to the middle and look again.
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
        el.__e2eStillFrames = 0
        return false
      },
      { polling: 'raf' },
      element,
    )
    .catch(async () => {
      // Say what is in the way – "covered by a toast" and "scrolled out of view" need different fixes.
      const report = await element.evaluate((el) => {
        const rect = el.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        const describe = (node) =>
          node
            ? `<${node.tagName.toLowerCase()}> "${node.textContent.trim().slice(0, 40)}"`
            : 'nothing (outside the viewport)'
        return (
          `${describe(el)} at y=${Math.round(rect.top)}…${Math.round(rect.bottom)} ` +
          `of ${window.innerHeight}; at its centre: ${describe(hit)}`
        )
      })
      throw new Error(`never became clickable (still moving or covered): ${report}`)
    })
}

export async function clickText(page, selector, text, { exact = false } = {}) {
  const element = await findByText(page, selector, text, exact)
  await waitUntilActionable(page, element)
  await element.click()
}

/** For elements a journey looked up itself – same care as `clickText`. */
export async function clickElement(page, element) {
  await waitUntilActionable(page, element)
  await element.click()
}

export async function clickSelector(page, selector) {
  const element = await page.waitForSelector(selector, { visible: true })
  await waitUntilActionable(page, element)
  await element.click()
}

/** `MoneyInput` and friends: replace whatever is prefilled. */
export async function typeInto(page, ariaLabel, value) {
  const selector = `input[aria-label="${ariaLabel}"]`
  await clickSelector(page, selector)
  const input = await page.$(selector)
  const length = await input.evaluate((el) => el.value.length)
  await page.keyboard.press('End')
  for (let i = 0; i < length; i++) await page.keyboard.press('Backspace')
  await input.type(value)
}

/**
 * The amount shown by the expense form. It waits instead of reading once: the sheet title is
 * there before the form, which first has to get its expense from a live query.
 */
export async function waitForAmount(page, expected) {
  const selector = '[aria-label="Betrag"]'
  await page
    .waitForFunction(
      (sel, text) => document.querySelector(sel)?.textContent === text,
      {},
      selector,
      expected,
    )
    .catch(async () => {
      const actual = await page.evaluate(
        (sel) => document.querySelector(sel)?.textContent,
        selector,
      )
      throw new Error(`amount should read "${expected}" but is ${JSON.stringify(actual ?? null)}`)
    })
}

/** Keys as labelled on the numpad: '0'–'9' and 'Komma'. */
export async function pressNumpad(page, keys) {
  for (const key of keys) {
    await clickSelector(page, `[aria-label="Ziffernblock"] button[aria-label="${key}"]`)
  }
}

// ---------- sheets ----------

export const openModals = (page) =>
  page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)].filter((el) => el.dataset.state === 'open').length,
    MODAL_OVERLAYS,
  )

/**
 * "No sheet" means the overlay has left the DOM: while the closing animation runs it is already
 * `data-state="closed"` but still swallows every tap and swipe underneath.
 */
export const waitForModals = (page, count) =>
  page
    .waitForFunction(
      (selector, expected) => {
        const overlays = [...document.querySelectorAll(selector)]
        if (expected === 0) return overlays.length === 0
        return overlays.filter((el) => el.dataset.state === 'open').length === expected
      },
      {},
      MODAL_OVERLAYS,
      count,
    )
    .catch(() => {
      throw new Error(`expected ${count} open sheet(s)`)
    })

/**
 * Records whether a sheet shows up at all from now on. A plain "is one open?" afterwards is not
 * enough: the edit sheet closes itself once its expense is gone, so a sheet that was wrongly
 * opened by a swipe is closed again by the time anyone looks.
 */
export const watchForModals = (page) =>
  page.evaluate((selector) => {
    window.__e2eModalObserver?.disconnect()
    window.__e2eModalSeen = false
    window.__e2eModalObserver = new MutationObserver(() => {
      if (document.querySelector(selector)) window.__e2eModalSeen = true
    })
    window.__e2eModalObserver.observe(document.body, { childList: true, subtree: true })
  }, MODAL_OVERLAYS)

export const sawModal = (page) => page.evaluate(() => window.__e2eModalSeen === true)

// ---------- expense rows ----------

// Every expense row sits in a SwipeRow whose delete button is labelled "<title> löschen".
const ROW_DELETE_BUTTONS = 'main button[aria-label$=" löschen"]'

export const expenseRowCount = (page) =>
  page.evaluate((selector) => document.querySelectorAll(selector).length, ROW_DELETE_BUTTONS)

export const waitForExpenseRows = (page, count) =>
  page
    .waitForFunction(
      (selector, expected) => document.querySelectorAll(selector).length === expected,
      {},
      ROW_DELETE_BUTTONS,
      count,
    )
    .catch(() => {
      throw new Error(`expected ${count} expense row(s)`)
    })

/** The tappable content of the row showing `amountText` (SwipeRow: action layer, then content). */
export async function expenseRow(page, amountText) {
  const handle = await page.waitForFunction(
    (selector, needle) =>
      [...document.querySelectorAll(selector)]
        .map((deleteButton) =>
          deleteButton.parentElement.nextElementSibling?.querySelector('button'),
        )
        .find((row) => row?.textContent.includes(needle)),
    {},
    ROW_DELETE_BUTTONS,
    amountText,
  )
  const row = handle.asElement()
  await waitUntilActionable(page, row)
  return row
}

/** A real pointer drag to the left, in frame-sized steps like a finger would produce. */
export async function swipeLeft(page, row, distance) {
  const box = await row.boundingBox()
  const y = box.y + box.height / 2
  const startX = box.x + box.width - 30
  await page.mouse.move(startX, y)
  await page.mouse.down()
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(startX - (distance / 12) * step, y)
    await new Promise((resolve) => setTimeout(resolve, 16))
  }
  await page.mouse.up()
}

/** Taps the row's content. A revealed row is shifted to the left, so stay inside the screen. */
export async function tapRow(page, row) {
  const box = await row.boundingBox()
  await page.mouse.click(Math.max(box.x, 0) + 60, box.y + box.height / 2)
}

/** Clicks the action of the toast that contains `toastText` (several toasts can be stacked). */
export async function clickToastAction(page, toastText, actionText) {
  const handle = await page
    .waitForFunction(
      (needle, action) =>
        [...document.querySelectorAll('[data-sonner-toast]')]
          .filter((toast) => toast.textContent.includes(needle))
          .flatMap((toast) => [...toast.querySelectorAll('button')])
          .find((button) => button.textContent.includes(action)),
      {},
      toastText,
      actionText,
    )
    .catch(() => {
      throw new Error(`no toast "${toastText}" with action "${actionText}"`)
    })
  const button = handle.asElement()
  await waitUntilActionable(page, button)
  await button.click()
}

// ---------- layout ----------

/**
 * The width check. `main` clips horizontal overflow, so neither a scrollbar nor `scrollWidth`
 * gives a too-wide card away – measure every rendered element against the viewport instead.
 */
export async function assertFitsViewport(page, where) {
  const offenders = await page.evaluate(() =>
    [...document.querySelectorAll('main *')]
      .flatMap((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return []
        if (rect.left >= -1 && rect.right <= window.innerWidth + 1) return []
        const classes = (el.getAttribute('class') ?? '').slice(0, 80)
        return [
          `<${el.tagName.toLowerCase()} class="${classes}"> spans ${Math.round(rect.left)}…${Math.round(rect.right)} px of ${window.innerWidth}`,
        ]
      })
      .slice(0, 5),
  )
  assert.deepEqual(offenders, [], `${where}: elements reach beyond the viewport`)

  // A label that is too long for its button spills over its neighbours while the button itself
  // stays in place – invisible to the measurement above.
  const spilling = await page.evaluate(() =>
    [...document.querySelectorAll('button, a')]
      .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
      .map(
        (el) =>
          `"${el.textContent.trim().slice(0, 40)}" needs ${el.scrollWidth} px, has ${el.clientWidth}`,
      )
      .slice(0, 5),
  )
  assert.deepEqual(spilling, [], `${where}: text spills out of its button`)

  const scrolls = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  assert.equal(scrolls, false, `${where}: page scrolls horizontally`)
}

// ---------- shared steps ----------

/** Fast path through the onboarding for journeys that are about something else. */
export async function onboard(page, { tracking = 'Ab dieser Woche' } = {}) {
  await goto(page, '/')
  await waitForText(page, 'Willkommen beim Finanzplaner')
  await clickText(page, 'button', 'Los geht')
  await waitForText(page, 'Was verdienst du pro Woche?')
  await clickText(page, 'button', 'Weiter', { exact: true })
  await waitForText(page, 'Wie viel willst du pro Woche höchstens ausgeben?')
  await clickText(page, 'button', 'Weiter', { exact: true })
  await waitForText(page, 'Wo startest du?')
  await clickText(page, '[role="radio"]', tracking)
  await clickText(page, 'button', 'Fertig', { exact: true })
  await waitForText(page, 'Nächster Schritt')
}

/** Amount on the numpad → category → save; expects the quick-add sheet to be open. */
export async function fillQuickAdd(page, keys, category) {
  await waitForModals(page, 1)
  await pressNumpad(page, keys)
  await clickText(page, '[role="radio"]', category)
  await clickText(page, 'button', 'Speichern', { exact: true })
  await waitForModals(page, 0)
}
