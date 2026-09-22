import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import { clearDismissedInsights } from '@/features/insights'
import { addWeeksISO } from '@/lib/dates'
import { useUiStore } from '@/shared/stores/uiStore'
import { DashboardPage } from './DashboardPage'

vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' })) // Wednesday
// The real toaster needs pointer capture, which jsdom lacks – capture the calls instead.
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

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
  clearDismissedInsights()
  useUiStore.setState({
    quickAddOpen: false,
    closeWeekOpen: false,
    closeWeekStart: null,
    taskOpen: false,
    taskId: null,
  })
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
    expect(screen.queryByText('Streak')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Insights' })).not.toBeInTheDocument()
    // The ring leads to the budget, "Nur gespart" to its pot:
    expect(screen.getByRole('link', { name: 'Budget anpassen' })).toHaveAttribute('href', '/budget')
    expect(screen.getByRole('link', { name: /Nur gespart/ })).toHaveAttribute(
      'href',
      '/pots/pot%3Aprimary',
    )

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

    // The week before went over budget → no streak, and the card says why.
    expect(screen.getByText('Noch kein Streak')).toBeInTheDocument()

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

  it('counts the streak over every closed week, however long ago – a changed budget does not rewrite it', async () => {
    await onboard('2026-06-29')
    // Twelve closed weeks, all under the A$400 that applied; the oldest lie far back.
    for (let index = 0; index < 12; index++) {
      const monday = addWeeksISO('2026-06-29', index)
      await repos.expenses.add({ date: monday, amountCents: 35_000, categoryId: 'cat:groceries' })
      await repos.weeks.close(monday, { incomeCents: 200_000 })
    }
    await repos.budgets.set('2026-09-23', { totalLimitCents: 30_000 }) // tighter from today on
    renderPage()

    expect(await screen.findByText('12 Wochen im Budget')).toBeInTheDocument()
    expect(screen.getByText(/Das ist dein Rekord/)).toBeInTheDocument()
  })

  it('lists the next open tasks – overdue first – and ticks one off with undo', async () => {
    const user = userEvent.setup()
    await onboard('2026-09-21')
    const bali = await repos.pots.create({ name: 'Bali', targetCents: 300_000 })
    await repos.tasks.add({ title: 'Irgendwann' }) // undated → after every dated task
    await repos.tasks.add({ title: 'Flug buchen', dueDate: '2026-09-30', linkedPotId: bali.id })
    await repos.tasks.add({ title: 'Miete überweisen', dueDate: '2026-09-25' })
    await repos.tasks.add({ title: 'Steuer', dueDate: '2026-09-20' })
    const done = await repos.tasks.add({ title: 'Schon erledigt' })
    await repos.tasks.setDone(done.id, true)
    renderPage()

    const widget = await screen.findByRole('region', { name: 'Tasks' })
    expect(within(widget).getByText('1 überfällig')).toBeInTheDocument()
    expect(
      within(widget)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('aria-label')),
    ).toEqual(['„Steuer" erledigen', '„Miete überweisen" erledigen', '„Flug buchen" erledigen'])
    expect(within(widget).getByText('Seit 3 Tagen überfällig')).toBeInTheDocument()
    expect(within(widget).getByText('Bali')).toBeInTheDocument() // the pot reference, by name
    expect(within(widget).getByRole('link', { name: '1 weiterer Task' })).toHaveAttribute(
      'href',
      '/tasks',
    )
    expect(within(widget).queryByText('Schon erledigt')).not.toBeInTheDocument()

    // Tapping the title opens the sheet; the tick writes with an undo toast.
    await user.click(within(widget).getByText('Steuer'))
    expect(useUiStore.getState()).toMatchObject({ taskOpen: true })
    await user.click(within(widget).getByRole('checkbox', { name: '„Steuer" erledigen' }))
    await waitFor(() => expect(within(widget).queryByText('Steuer')).not.toBeInTheDocument())
    expect(within(widget).queryByText('1 überfällig')).not.toBeInTheDocument()
    expect(within(widget).getByText('Irgendwann')).toBeInTheDocument() // the 4th moved up
    const [message, options] = vi.mocked(toast).mock.calls.at(-1)!
    expect(message).toBe('„Steuer" erledigt')
    const undo = options?.action as { label: string; onClick: () => void }
    expect(undo.label).toBe('Rückgängig')
    undo.onClick()
    expect(await within(widget).findByText('Steuer')).toBeInTheDocument()
  })

  it('shows insight cards, lets one be dismissed with undo and remembers it per device', async () => {
    const user = userEvent.setup()
    await onboard('2026-09-21')
    await repos.expenses.add({
      date: '2026-09-22',
      amountCents: 45_000,
      categoryId: 'cat:groceries',
    })
    const { unmount } = renderPage()

    const section = await screen.findByRole('region', { name: 'Insights' })
    const card = within(section).getByRole('article', { name: 'A$50,00 über dem Budget' })
    expect(within(card).getByRole('link', { name: 'Budget' })).toHaveAttribute('href', '/budget')

    await user.click(within(card).getByRole('button', { name: /Hinweis ausblenden/ }))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Insights' })).not.toBeInTheDocument(),
    )
    expect(JSON.parse(localStorage.getItem('fp.insightsDismissed')!)).toEqual([
      'budget-over:2026-09-21',
    ])
    const [message, options] = vi.mocked(toast).mock.calls.at(-1)!
    expect(message).toBe('Hinweis ausgeblendet')

    // A fresh render (as after a reload) keeps it hidden …
    unmount()
    renderPage()
    expect(await screen.findByText('Zuletzt ausgegeben')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Insights' })).not.toBeInTheDocument()

    // … until "Rückgängig".
    const undo = options?.action as { label: string; onClick: () => void }
    expect(undo.label).toBe('Rückgängig')
    act(() => undo.onClick())
    expect(
      await screen.findByRole('article', { name: 'A$50,00 über dem Budget' }),
    ).toBeInTheDocument()
  })

  it('pauses the streak while finished weeks are still open', async () => {
    await onboard('2026-09-07')
    await repos.weeks.close('2026-09-07', { incomeCents: 200_000 }) // 09-14 is still pending
    renderPage()

    expect(await screen.findByText('Streak pausiert')).toBeInTheDocument()
  })
})
