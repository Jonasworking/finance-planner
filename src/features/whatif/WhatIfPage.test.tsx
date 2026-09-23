import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, loadWhatIf, repos } from '@/db'
import { resolveBudget } from '@/lib/budget'
import { formatAUD } from '@/lib/money'
import { projectScenario, toAdjustments, whatIfBase } from '@/lib/whatif'
import { stubDesktopViewport, stubResizeObserver } from '@/test/ui'
import type { ScenarioRow } from './chartData'
import { useWhatIfStore } from './whatIfStore'
import { WhatIfPage } from './WhatIfPage'

const TODAY = '2026-09-23' // Wednesday of the week starting 2026-09-21
const THIS_WEEK = '2026-09-21'
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' }))
// jsdom has no layout, so Recharts draws nothing: the chart is replaced by a plain readout of the
// rows it was given. The SVG itself is covered by the browser smoke suite.
vi.mock('./charts', () => ({
  ScenarioChart: ({ rows, view }: { rows: ScenarioRow[]; view: string }) => (
    <ul aria-label="Szenario-Chart" data-view={view}>
      {rows.map((row) => (
        <li key={row.key}>{[row.key, row.baseline, row.scenario, row.diff].join('|')}</li>
      ))}
    </ul>
  ),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

const whole = (cents: number) => formatAUD(cents, { decimals: false })
/** Text that is split across <Money> spans: the innermost element that holds all of it. */
const spanning = (text: string) => (_: string, element: Element | null) =>
  element?.textContent === text &&
  [...element.children].every((child) => child.textContent !== text)

async function onboard() {
  await repos.onboarding.complete(
    {
      defaultWeeklyIncomeCents: 200_000,
      totalLimitCents: 40_000,
      openingBalanceCents: 100_000,
      trackingSince: '2026-08-24',
    },
    TODAY,
  )
}

/** Four closed weeks with groceries and eating out, plus a second pot with money in it. */
async function seedHistory() {
  await onboard()
  for (const [weekStart, groceries, eatingOut] of [
    ['2026-08-24', 12_000, 6_000],
    ['2026-08-31', 10_000, 4_000],
    ['2026-09-07', 14_000, 8_000],
    ['2026-09-14', 12_000, 6_000],
  ] as const) {
    await repos.expenses.add({
      date: weekStart,
      amountCents: groceries,
      categoryId: 'cat:groceries',
    })
    await repos.expenses.add({
      date: weekStart,
      amountCents: eatingOut,
      categoryId: 'cat:eating-out',
    })
    await repos.weeks.close(weekStart, { incomeCents: 200_000 })
  }
  const pot = await repos.pots.create({ name: 'Reise', color: 'cat-2', icon: 'Plane' })
  await repos.pots.deposit(pot.id, 50_000, '2026-09-15')
}

/** What lib computes for the same rows – the screen must show exactly these numbers. */
async function expected(cuts: Record<string, number>, until: string) {
  const data = await loadWhatIf(db)
  const base = whatIfBase({
    today: TODAY,
    defaultWeeklyIncomeCents: data.settings!.defaultWeeklyIncomeCents,
    weeks: data.weeks,
    expenses: data.expenses,
    budgets: data.budgets,
    categories: data.categories,
    pots: data.pots,
    potTransactions: data.potTransactions,
  })
  const scenario = projectScenario({
    startBalanceCents: base.startBalanceCents,
    baselineWeeklySavingCents: base.baselineWeeklySavingCents,
    adjustments: toAdjustments(base.categories, cuts),
    from: TODAY,
    until,
  })
  return { base, scenario }
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <WhatIfPage />
    </MemoryRouter>,
  )

const chartRows = () =>
  within(screen.getByRole('list', { name: 'Szenario-Chart' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

beforeAll(() => {
  stubResizeObserver()
  stubDesktopViewport()
})

beforeEach(async () => {
  vi.clearAllMocks()
  act(() => useWhatIfStore.setState({ cuts: {}, horizon: 12, view: 'gain' }))
  await db.delete()
  await db.open()
})

describe('WhatIfPage', () => {
  it('starts from all pots and the average of the closed weeks', async () => {
    await seedHistory()
    const { base, scenario } = await expected({}, '2027-09-23')
    renderPage()

    // opening balance 1 000 + four closes (8 000 income − 720 spent) + 500 in the second pot
    expect(base.startBalanceCents).toBe(8_780_00)
    expect(base.baselineWeeklySavingCents).toBe(1_820_00)
    expect(await screen.findByText('Bis 23. Sep. 2027 in allen Töpfen')).toBeInTheDocument()
    expect(
      screen.getByText(whole(scenario.points.at(-1)!.baselineCents), { selector: 'p > span' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Ø der letzten 4 abgeschlossenen Wochen/)).toBeInTheDocument()
    // no cut yet: the lead chart explains itself instead of drawing a flat line
    expect(screen.getByText(/Noch kein Unterschied/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Als Budget übernehmen/ })).toBeDisabled()
  })

  it('shows "+A$Z bis Datum Y" as the sliders move – the numbers of projectScenario', async () => {
    await seedHistory()
    const user = userEvent.setup()
    renderPage()

    const eatingOut = await screen.findByRole('slider', {
      name: 'Weniger für Essen gehen pro Woche',
    })
    expect(eatingOut).toHaveAttribute('aria-valuemax', '6000') // Ø A$60
    eatingOut.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}') // 4 × A$5
    const groceries = screen.getByRole('slider', { name: 'Weniger für Lebensmittel pro Woche' })
    groceries.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')

    const { scenario } = await expected(
      { 'cat:eating-out': 2_000, 'cat:groceries': 1_000 },
      '2027-09-23',
    )
    expect(scenario.gainCents).toBe(3_000 * scenario.weeks)
    expect(await screen.findByText('Bis 23. Sep. 2027 mehr gespart')).toBeInTheDocument()
    expect(
      screen.getByText(whole(scenario.gainCents), { selector: 'p > span' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/pro Woche × 53 Wochen/)).toBeInTheDocument()
    expect(
      screen.getByText(spanning(`+${whole(2_000 * scenario.weeks)} bis 23. Sep. 2027`)),
    ).toBeInTheDocument()

    // the chart gets the very points of the projection
    await waitFor(() =>
      expect(chartRows()).toEqual(
        scenario.points.map((point) =>
          [
            point.weekStart,
            point.baselineCents / 100,
            point.scenarioCents / 100,
            (point.scenarioCents - point.baselineCents) / 100,
          ].join('|'),
        ),
      ),
    )
    await user.click(screen.getByRole('radio', { name: 'Gesamt' }))
    expect(screen.getByRole('list', { name: 'Szenario-Chart' })).toHaveAttribute(
      'data-view',
      'total',
    )

    await user.click(screen.getByRole('button', { name: 'Alle Regler zurücksetzen' }))
    expect(await screen.findByText('Bis 23. Sep. 2027 in allen Töpfen')).toBeInTheDocument()
  })

  it('moves the target date by preset or by hand, never before today', async () => {
    await seedHistory()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('radio', { name: '3 Monate' }))
    expect(screen.getByText('Bis 23. Dez. 2026 in allen Töpfen')).toBeInTheDocument()
    expect(screen.getByLabelText('Zieldatum')).toHaveValue('2026-12-23')

    // jsdom's date input takes a whole value, not keystrokes
    const date = screen.getByLabelText('Zieldatum')
    fireEvent.change(date, { target: { value: '2026-10-04' } })
    expect(screen.getByText('Bis 4. Okt. 2026 in allen Töpfen')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '3 Monate' })).toHaveAttribute('aria-checked', 'false')

    fireEvent.change(date, { target: { value: '2026-09-01' } }) // in the past: ignored
    expect(screen.getByText('Bis 4. Okt. 2026 in allen Töpfen')).toBeInTheDocument()
  })

  it('turns the scenario into this week’s budget, with undo', async () => {
    await seedHistory()
    await repos.budgets.set(TODAY, {
      totalLimitCents: 40_000,
      categoryLimits: { 'cat:groceries': 15_000 },
    })
    const user = userEvent.setup()
    renderPage()

    const eatingOut = await screen.findByRole('slider', {
      name: 'Weniger für Essen gehen pro Woche',
    })
    eatingOut.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    const groceries = screen.getByRole('slider', { name: 'Weniger für Lebensmittel pro Woche' })
    groceries.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')

    await user.click(screen.getByRole('button', { name: /Als Budget übernehmen/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Als Budget übernehmen' })
    const row = (name: string) => within(sheet).getByText(name).closest('li')!
    expect(row('Wochenbudget')).toHaveTextContent('A$400A$375')
    expect(row('Essen gehen')).toHaveTextContent('kein LimitA$50') // Ø A$60 − A$10
    expect(row('Lebensmittel')).toHaveTextContent('A$150A$135')

    await user.click(within(sheet).getByRole('button', { name: 'Übernehmen' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledOnce())
    const budget = () => db.budgets.toArray().then((rows) => resolveBudget(rows, THIS_WEEK))
    expect(await budget()).toMatchObject({
      totalLimitCents: 37_500,
      categoryLimits: { 'cat:groceries': 13_500, 'cat:eating-out': 5_000 },
    })
    // the cuts are part of the budget now – the sliders start over
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(
      screen.getByRole('slider', { name: 'Weniger für Essen gehen pro Woche' }),
    ).toHaveAttribute('aria-valuenow', '0')

    const [, options] = vi.mocked(toast.success).mock.calls[0]!
    const undo = options?.action as { label: string; onClick: () => void }
    expect(undo.label).toBe('Rückgängig')
    act(() => undo.onClick())
    await waitFor(async () =>
      expect(await budget()).toMatchObject({
        totalLimitCents: 40_000,
        categoryLimits: { 'cat:groceries': 15_000 },
      }),
    )
    expect((await budget())?.categoryLimits).not.toHaveProperty('cat:eating-out')
    await waitFor(() =>
      expect(
        screen.getByRole('slider', { name: 'Weniger für Essen gehen pro Woche' }),
      ).toHaveAttribute('aria-valuenow', '1000'),
    )
  })

  it('explains itself before there is anything to cut', async () => {
    await onboard()
    renderPage()

    expect(
      await screen.findByText(/Sobald du eine Woche mit Ausgaben abgeschlossen/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Standard-Einkommen minus Wochenbudget/)).toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Als Budget übernehmen/ })).not.toBeInTheDocument()
  })
})
