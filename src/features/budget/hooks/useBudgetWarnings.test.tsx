import { render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import { useBudgetWarnings } from './useBudgetWarnings'

vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn() } }))

const TODAY = '2026-09-23' // Wednesday of the week starting 2026-09-21
const GROCERIES = 'cat:groceries'

function Probe({ today = TODAY }: { today?: string }) {
  useBudgetWarnings(today)
  return null
}
// StrictMode runs effects twice in development – the warning must still come once.
const mount = (today?: string) =>
  render(
    <StrictMode>
      <MemoryRouter>
        <Probe today={today} />
      </MemoryRouter>
    </StrictMode>,
  )

const warnings = () => vi.mocked(toast.warning).mock.calls.map(([title]) => title)
const overs = () => vi.mocked(toast.error).mock.calls.map(([title]) => title)
const spend = (amountCents: number, categoryId = 'cat:rent', date = '2026-09-22') =>
  repos.expenses.add({ date, amountCents, categoryId })
/** Lets the live query deliver and the effect run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60))

beforeEach(async () => {
  vi.clearAllMocks()
  localStorage.clear()
  await db.delete()
  await db.open()
  await repos.onboarding.complete(
    {
      defaultWeeklyIncomeCents: 200_000,
      totalLimitCents: 40_000,
      openingBalanceCents: 0,
      trackingSince: '2026-09-07',
    },
    TODAY,
  )
})

describe('useBudgetWarnings', () => {
  it('stays quiet below 80 %', async () => {
    await spend(31_900)
    mount()
    await settle()
    expect(warnings()).toEqual([])
    expect(overs()).toEqual([])
  })

  it('warns once at 80 % and once at 100 % – never again that week', async () => {
    mount()
    await spend(32_000)
    await waitFor(() => expect(warnings()).toEqual(['80 % des Wochenbudgets erreicht']))
    expect(vi.mocked(toast.warning).mock.calls[0]?.[1]).toMatchObject({
      description: 'Noch A$80,00 übrig.',
    })

    await spend(2_000) // 85 %: same threshold
    await settle()
    expect(warnings()).toHaveLength(1)

    await spend(7_000) // 102,5 %
    await waitFor(() => expect(overs()).toEqual(['Wochenbudget aufgebraucht']))
    expect(vi.mocked(toast.error).mock.calls[0]?.[1]).toMatchObject({
      description: 'A$10,00 drüber.',
    })

    await spend(5_000)
    await settle()
    expect(warnings()).toHaveLength(1)
    expect(overs()).toHaveLength(1)
  })

  it('does not warn again after deleting and re-adding, nor after an app restart', async () => {
    const first = mount()
    const expense = await spend(33_000)
    await waitFor(() => expect(warnings()).toHaveLength(1))

    await repos.expenses.remove(expense.id)
    await settle()
    await repos.expenses.restore(expense.id)
    await settle()
    expect(warnings()).toHaveLength(1)

    first.unmount()
    mount() // app closed and opened again
    await settle()
    expect(warnings()).toHaveLength(1)
  })

  it('starts fresh in a new week', async () => {
    const first = mount()
    await spend(33_000)
    await waitFor(() => expect(warnings()).toHaveLength(1))
    first.unmount()

    await spend(34_000, 'cat:rent', '2026-09-29')
    mount('2026-09-30')
    await waitFor(() => expect(warnings()).toHaveLength(2))
  })

  it('counts a reserved standing order like the hero ring does', async () => {
    await repos.recurring.create({
      title: 'Miete',
      amountCents: 30_000,
      categoryId: 'cat:rent',
      interval: 'weekly',
      anchorDate: '2026-09-25', // Friday – not booked yet on Wednesday
    })
    mount()
    await spend(3_000, GROCERIES)
    await waitFor(() => expect(warnings()).toEqual(['80 % des Wochenbudgets erreicht']))
    expect(vi.mocked(toast.warning).mock.calls[0]?.[1]).toMatchObject({
      description: 'Noch A$70,00 übrig (inkl. A$300,00 reserviert).',
    })
  })

  it('warns per category limit, and when a lowered budget is what crosses the line', async () => {
    await repos.budgets.set(TODAY, {
      totalLimitCents: 40_000,
      categoryLimits: { [GROCERIES]: 10_000 },
    })
    mount()
    await spend(8_500, GROCERIES)
    await waitFor(() => expect(warnings()).toEqual(['Lebensmittel: 80 % des Limits erreicht']))

    await repos.budgets.set(TODAY, { totalLimitCents: 8_000, categoryLimits: {} })
    await waitFor(() => expect(overs()).toEqual(['Wochenbudget aufgebraucht']))
  })

  it('says nothing before the onboarding is done', async () => {
    await db.settings.update('app', { onboardingDone: false })
    await spend(50_000)
    mount()
    await settle()
    expect(overs()).toEqual([])
  })
})
