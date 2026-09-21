import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, loadAnalytics, repos } from '@/db'
import { buildAnalytics } from '@/lib/analytics'
import { formatAUD, formatEUR } from '@/lib/money'
import { useUiStore } from '@/shared/stores/uiStore'
import { useAnalyticsStore } from './analyticsStore'
import {
  toFlowRows,
  type CumulativeRow,
  type DonutRow,
  type FlowRow,
  type TrendRow,
} from './chartData'
import { AnalyticsPage } from './AnalyticsPage'

const TODAY = '2026-09-23' // Wednesday of the week starting 2026-09-21
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' }))
// jsdom has no layout, so Recharts draws nothing: the charts are replaced by a plain readout of
// the rows they were given. The SVG itself is covered by the browser smoke suite.
vi.mock('./charts', () => ({
  CategoryDonut: ({ rows, onSelect }: { rows: DonutRow[]; onSelect: (id: string) => void }) => (
    <ul aria-label="Donut">
      {rows.map((row) => (
        <li key={row.id}>
          <button type="button" onClick={() => onSelect(row.id)}>
            {`Segment ${row.name}: ${row.value} ${row.fill}`}
          </button>
        </li>
      ))}
    </ul>
  ),
  CategoryTrendChart: ({ rows, fill }: { rows: TrendRow[]; fill: string }) => (
    <ul aria-label="Trend-Chart" data-fill={fill}>
      {rows.map((row) => (
        <li key={row.key}>{`${row.key}|${row.amount}`}</li>
      ))}
    </ul>
  ),
  CumulativeChart: ({ rows }: { rows: CumulativeRow[] }) => (
    <ul aria-label="Sparverlauf-Chart">
      {rows.map((row) => (
        <li key={row.key}>{`${row.key}|${row.total}`}</li>
      ))}
    </ul>
  ),
  FlowChart: ({ rows }: { rows: FlowRow[] }) => (
    <ul aria-label="Flow-Chart">
      {rows.map((row) => (
        <li key={row.key}>{[row.key, row.spent, row.saved, row.open, row.income].join('|')}</li>
      ))}
    </ul>
  ),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

const whole = (cents: number) => formatAUD(cents, { decimals: false })

async function onboard(trackingSince: string) {
  await repos.onboarding.complete(
    {
      defaultWeeklyIncomeCents: 200_000,
      totalLimitCents: 40_000,
      openingBalanceCents: 0,
      trackingSince,
    },
    TODAY,
  )
}

/** Four closed weeks across August/September plus spending in the running week. */
async function seedWeeks() {
  await onboard('2026-08-24')
  const weeks: [string, number, number][] = [
    ['2026-08-24', 200_000, 40_000],
    ['2026-08-31', 200_000, 30_000],
    ['2026-09-07', 180_000, 50_000],
    ['2026-09-14', 200_000, 20_000],
  ]
  for (const [weekStart, incomeCents, spentCents] of weeks) {
    await repos.expenses.add({
      date: weekStart,
      amountCents: spentCents,
      categoryId: 'cat:groceries',
    })
    await repos.weeks.close(weekStart, { incomeCents })
  }
  await repos.expenses.add({ date: '2026-09-22', amountCents: 12_000, categoryId: 'cat:groceries' })
}

/** What lib computes for the same rows – the screen must show exactly these numbers. */
async function expected(range: 8 | 12 | 26 | 'all', granularity: 'week' | 'month') {
  const data = await loadAnalytics(db)
  return buildAnalytics({
    today: TODAY,
    range,
    granularity,
    trackingSince: data.settings!.trackingSince,
    weeks: data.weeks,
    expenses: data.expenses,
    budgets: data.budgets,
  })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>,
  )

// "Gespart" also appears in the comparison card – a tile is looked up inside the sums region.
const tile = (label: string) =>
  within(screen.getByRole('region', { name: 'Summen im Zeitraum' }))
    .getByText(label)
    .closest('div')!

beforeEach(async () => {
  act(() => {
    useAnalyticsStore.setState({ granularity: 'week', range: 12 })
    useUiStore.setState({ eurRateOpen: false, editOpen: false })
  })
  await db.delete()
  await db.open()
})

describe('AnalyticsPage', () => {
  it('shows the sums of the closed weeks and names the open one', async () => {
    await seedWeeks()
    const view = await expected(12, 'week')
    renderPage()

    expect(await screen.findByText('24. Aug. – 27. Sep. 2026')).toBeInTheDocument()
    const sums = screen.getByRole('region', { name: 'Summen im Zeitraum' })
    expect(within(sums).getByText(whole(view.totals.incomeCents))).toBeInTheDocument()
    expect(within(tile('Verdient')).getByText('A$7.800')).toBeInTheDocument()
    expect(within(tile('Ausgegeben')).getByText('A$1.400')).toBeInTheDocument()
    expect(within(tile('Gespart')).getByText('A$6.400')).toBeInTheDocument()
    expect(within(tile('Sparquote')).getByText(/82\s%/)).toBeInTheDocument()
    expect(within(sums).getByText(/Aus 4 Wochen mit Abschluss\./)).toBeInTheDocument()
    expect(within(sums).getByText(/1 Woche ist noch offen/)).toBeInTheDocument()
    expect(within(sums).getByText(whole(view.totals.openSpentCents))).toBeInTheDocument()
  })

  it('compares the last closed week with the one before and names best and weakest', async () => {
    await seedWeeks()
    renderPage()

    const card = (await screen.findByText('Letzte Woche im Vergleich')).closest(
      'div',
    )!.parentElement!
    expect(
      within(card).getByText(/14\.–20\. Sep\. 2026 gegenüber 7\.–13\. Sep\. 2026/),
    ).toBeInTheDocument()
    expect(within(card).getByText('A$1.800')).toBeInTheDocument() // saved last week
    // Spending fell by A$300 (−60 %) – good news; income rose by A$200.
    expect(within(card).getAllByText('gesunken um')).toHaveLength(1)
    expect(within(card).getByText(/A\$300/)).toBeInTheDocument()
    expect(within(card).getByText(/60\s%/)).toBeInTheDocument()

    const bestWorst = screen.getByText('Beste und schwächste Woche').closest('div')!
    expect(within(bestWorst).getByText('14.–20. Sep. 2026')).toBeInTheDocument()
    expect(within(bestWorst).getByText('7.–13. Sep. 2026')).toBeInTheDocument()
  })

  it('follows the range and the grouping', async () => {
    const user = userEvent.setup()
    await seedWeeks()
    renderPage()
    await screen.findByText('24. Aug. – 27. Sep. 2026')

    await user.click(screen.getByRole('radio', { name: 'Monate' }))
    expect(await screen.findByText('August 2026 – September 2026')).toBeInTheDocument()
    const monthly = await expected(12, 'month')
    const card = screen.getByText('Letzter Monat im Vergleich').closest('div')!.parentElement!
    expect(
      within(card).getByText(/September 2026 gegenüber August 2026 · Ø pro Woche/),
    ).toBeInTheDocument()
    expect(within(card).getByText(whole(monthly.comparison!.savedCents))).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Wochen' }))
    await user.click(screen.getByRole('radio', { name: 'Gesamter Zeitraum' }))
    expect(useAnalyticsStore.getState().range).toBe('all')
    expect(await screen.findByText('24. Aug. – 27. Sep. 2026')).toBeInTheDocument()
  })

  it('explains itself before anything is closed', async () => {
    await onboard('2026-09-21')
    renderPage()
    expect(await screen.findByText(/Noch keine Woche abgeschlossen/)).toBeInTheDocument()
    expect(screen.getByText(/Sobald zwei Wochen abgeschlossen sind/)).toBeInTheDocument()
    expect(screen.queryByText('Beste und schwächste Woche')).not.toBeInTheDocument()
    expect(within(tile('Sparquote')).getByText('–')).toBeInTheDocument()
  })

  it('shows amounts in EUR once a rate exists and asks for the rate otherwise', async () => {
    const user = userEvent.setup()
    await seedWeeks()
    renderPage()
    await screen.findByText('24. Aug. – 27. Sep. 2026')

    await user.click(screen.getByRole('radio', { name: 'Euro' }))
    expect(useUiStore.getState()).toMatchObject({ eurRateOpen: true, eurRateEnable: true })
    expect((await repos.settings.get()).showEur).toBe(false)

    await repos.settings.update({ eurRate: 0.6, showEur: true }) // what the sheet saves
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Euro' })).toHaveAttribute('aria-checked', 'true'),
    )
    const euros = formatEUR(640_000, 0.6, { decimals: false }).replace(/\s/g, ' ')
    expect(within(tile('Gespart')).getByText(euros)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Australische Dollar' }))
    await waitFor(async () => expect((await repos.settings.get()).showEur).toBe(false))
    expect(await within(tile('Gespart')).findByText('A$6.400')).toBeInTheDocument()
  })

  it('hands the chart the numbers lib computed and offers them as a table', async () => {
    const user = userEvent.setup()
    await seedWeeks()
    const view = await expected(12, 'week')
    renderPage()

    const chart = await screen.findByRole('list', { name: 'Flow-Chart' })
    const rows = toFlowRows(view.flow, 'week', { currency: 'AUD' })
    expect(
      within(chart)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(rows.map((row) => [row.key, row.spent, row.saved, row.open, row.income].join('|')))
    expect(rows.at(-1)).toMatchObject({ key: '2026-09-21', open: 120, income: null })
    expect(screen.getByText('noch offen: bisher ausgegeben')).toBeInTheDocument() // legend

    await user.click(
      screen.getByRole('button', { name: 'Verdient, ausgegeben, gespart: als Tabelle anzeigen' }),
    )
    const table = screen.getByRole('table')
    const newestClosed = within(table).getByRole('row', { name: /14\.–20\. Sep\./ })
    expect(within(newestClosed).getByText('A$2.000')).toBeInTheDocument()
    expect(within(newestClosed).getByText('A$200')).toBeInTheDocument()
    expect(within(newestClosed).getByText('A$1.800')).toBeInTheDocument()
    const open = within(table).getByRole('row', { name: /21\.–27\. Sep\./ })
    expect(within(open).getByText('noch offen')).toBeInTheDocument()
    expect(within(open).getByText('A$120')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Flow-Chart' })).not.toBeInTheDocument()
  })

  it('splits the spending by category and drills into one', async () => {
    const user = userEvent.setup()
    await seedWeeks()
    await repos.expenses.add({
      date: '2026-09-15',
      amountCents: 25_000,
      categoryId: 'cat:rent',
      note: 'Miete September',
    })
    await repos.expenses.add({
      date: '2026-09-16',
      amountCents: 65_000,
      categoryId: 'cat:travel',
      fundedByPotId: 'pot:primary',
    })
    renderPage()

    const card = (await screen.findByText('Wofür das Geld wegging')).closest('div')!.parentElement!
    // Groceries: 1.400 closed + 120 open; rent 250. The pot-funded trip is named, not counted.
    expect(await within(card).findByText('A$1.770')).toBeInTheDocument()
    const groceries = within(card).getByRole('button', { name: /^Lebensmittel/ }) // not the stubbed slice
    expect(within(groceries).getByText('A$1.520')).toBeInTheDocument()
    expect(within(groceries).getByText(/86\s%/)).toBeInTheDocument()
    expect(within(card).getByText(/aus noch\s+offenen Wochen/)).toBeInTheDocument()
    expect(within(card).getByText(/die aus Töpfen\s+bezahlt wurden/)).toBeInTheDocument()
    // The slice wears the chart step of its category's own color.
    const rent = await db.categories.get('cat:rent')
    expect(
      await within(card).findByRole('button', {
        name: `Segment ${rent!.name}: 25000 var(--chart-${rent!.color})`,
      }),
    ).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: new RegExp(`^${rent!.name}`) }))
    expect(await screen.findByRole('heading', { name: rent!.name })).toBeInTheDocument()
    const trend = await screen.findByRole('list', { name: 'Trend-Chart' })
    expect(trend).toHaveAttribute('data-fill', `var(--chart-${rent!.color})`)
    expect(
      within(trend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['2026-08-24|0', '2026-08-31|0', '2026-09-07|0', '2026-09-14|250', '2026-09-21|0'])
    await user.click(screen.getByRole('button', { name: /Miete September/ }))
    expect(useUiStore.getState().editOpen).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Alle Kategorien' }))
    expect(await screen.findByText('Wofür das Geld wegging')).toBeInTheDocument()
  })

  it('adds the closed weeks up to the savings curve', async () => {
    const user = userEvent.setup()
    await seedWeeks()
    const view = await expected(12, 'week')
    renderPage()

    const chart = await screen.findByRole('list', { name: 'Sparverlauf-Chart' })
    expect(
      within(chart)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(view.cumulative.map((point) => `${point.weekStart}|${point.totalCents / 100}`))
    expect(view.cumulative.at(-1)?.totalCents).toBe(640_000)
    const card = screen.getByRole('heading', { name: 'Sparverlauf' }).closest('div')!.parentElement!
    expect(within(card).getByText('A$6.400')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sparverlauf: als Tabelle anzeigen' }))
    const newest = screen.getByRole('row', { name: /14\.–20\. Sep\./ })
    expect(within(newest).getByText('A$6.400,00')).toBeInTheDocument()
  })

  it('explains the savings curve until two weeks are closed', async () => {
    await onboard('2026-09-14')
    await repos.weeks.close('2026-09-14', { incomeCents: 200_000 })
    renderPage()
    expect(await screen.findByText(/Ab zwei abgeschlossenen Wochen/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Sparverlauf-Chart' })).not.toBeInTheDocument()
  })
})
