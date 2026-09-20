import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import { useUiStore } from '@/shared/stores/uiStore'
import { DashboardPage } from './DashboardPage'

vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' })) // Wednesday

const onboard = (trackingSince: string, openingBalanceCents = 0) =>
  repos.onboarding.complete(
    {
      defaultWeeklyIncomeCents: 200_000,
      totalLimitCents: 40_000,
      openingBalanceCents,
      trackingSince,
    },
    '2026-09-23',
  )

const renderPage = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )

beforeEach(async () => {
  useUiStore.setState({ quickAddOpen: false, closeWeekOpen: false, closeWeekStart: null })
  await db.delete()
  await db.open()
})

describe('DashboardPage', () => {
  it('carries on day one: projection, one clear next step and no empty cards', async () => {
    const user = userEvent.setup()
    await onboard('2026-09-21')
    renderPage()

    expect(await screen.findByText('Erfasse deine erste Ausgabe')).toBeInTheDocument()
    expect(screen.getByText('Voraussichtlich gespart')).toBeInTheDocument()
    expect(screen.getByText(/bei A\$2\.000 Einkommen · noch 4 Tage/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Wochenbudget verbraucht' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(screen.getByText('So läuft deine Woche')).toBeInTheDocument()
    expect(screen.getByText(/Nach deinem ersten Wochenabschluss landet hier/)).toBeInTheDocument()
    // No hollow sections:
    expect(screen.queryByText('Letzte Wochen')).not.toBeInTheDocument()
    expect(screen.queryByText('Zuletzt ausgegeben')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ausgabe erfassen' }))
    expect(useUiStore.getState().quickAddOpen).toBe(true)
  })

  it('asks to catch up on pending weeks first and opens the oldest one', async () => {
    const user = userEvent.setup()
    await onboard('2026-09-07', 850_000)
    renderPage()

    expect(await screen.findByText('2 Wochen warten auf ihren Abschluss')).toBeInTheDocument()
    expect(screen.getByText(/Dein Startguthaben/)).toBeInTheDocument()
    expect(screen.getByText('A$8.500,00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Woche 7.–13. Sep. 2026 abschließen' }))
    expect(useUiStore.getState()).toMatchObject({
      closeWeekOpen: true,
      closeWeekStart: '2026-09-07',
    })
  })

  it('shows spending, reserved standing orders, recent expenses and closed weeks', async () => {
    const user = userEvent.setup()
    await onboard('2026-09-14')
    await repos.expenses.add({
      date: '2026-09-16',
      amountCents: 45_000,
      categoryId: 'cat:groceries',
    })
    await repos.weeks.close('2026-09-14', { incomeCents: 200_000 })
    await repos.expenses.add({
      date: '2026-09-22',
      amountCents: 12_000,
      categoryId: 'cat:groceries',
      note: 'Coles',
    })
    await repos.recurring.create({
      title: 'Miete',
      amountCents: 18_000,
      categoryId: 'cat:rent',
      interval: 'weekly',
      anchorDate: '2026-09-25', // Friday, still ahead
    })
    renderPage()

    // 120 spent + 180 reserved of 400 → 75 %, 100 left, projection 2000 − 120 − 180.
    expect(
      await screen.findByText(/\+ A\$180,00 reserviert \(Miete, Fr\., 25\. Sep\.\)/),
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Wochenbudget verbraucht' })).toHaveAttribute(
      'aria-valuenow',
      '75',
    )
    expect(screen.getByText('A$1.700,00')).toBeInTheDocument()

    expect(screen.getByText('Zuletzt ausgegeben')).toBeInTheDocument()
    expect(screen.getByText('Coles')).toBeInTheDocument()

    expect(screen.getByText('Letzte Wochen')).toBeInTheDocument()
    expect(screen.getByText(/über Budget · Sparquote 78 %/)).toBeInTheDocument()
    expect(screen.getByText(/Zuletzt \+A\$1\.550,00/)).toBeInTheDocument()
    expect(screen.queryByText('So läuft deine Woche')).not.toBeInTheDocument()
    expect(screen.getByText('Alles erledigt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /14\.–20\. Sep\. 2026/ }))
    expect(useUiStore.getState()).toMatchObject({
      closeWeekOpen: true,
      closeWeekStart: '2026-09-14',
    })
  })
})
