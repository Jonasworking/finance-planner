import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import { PRIMARY_POT_ID } from '@/lib/types'
import { useUiStore } from '@/shared/stores/uiStore'
import { stubDesktopViewport } from '@/test/ui'
import { CloseWeekSheet } from './CloseWeekSheet'

// Wednesday. Finished weeks since tracking began (2026-09-07): 09-07 and 09-14.
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' }))

beforeAll(stubDesktopViewport)

beforeEach(async () => {
  useUiStore.setState({ closeWeekStart: null, closeWeekOpen: false })
  await db.delete()
  await db.open()
  await repos.onboarding.complete(
    {
      defaultWeeklyIncomeCents: 200_000,
      totalLimitCents: 40_000,
      openingBalanceCents: 0,
      trackingSince: '2026-09-07',
    },
    '2026-09-23',
  )
  await repos.expenses.add({ date: '2026-09-15', amountCents: 31_250, categoryId: 'cat:groceries' })
})

const open = (weekStart: string) => act(() => useUiStore.getState().openCloseWeek(weekStart))
const income = () => screen.findByLabelText('Einkommen dieser Woche')
const booking = (weekStart: string) => db.potTransactions.get(`auto:${weekStart}`)

describe('CloseWeekSheet', () => {
  it('closes a week: default income prefilled, summary shown, savings booked', async () => {
    const user = userEvent.setup()
    render(<CloseWeekSheet />)
    open('2026-09-14')

    expect(await screen.findByRole('dialog', { name: 'Woche abschließen' })).toBeInTheDocument()
    expect(screen.getByText('14.–20. Sep. 2026')).toBeInTheDocument()
    expect(await income()).toHaveValue('2000')
    expect(screen.getByText('A$312,50')).toBeInTheDocument()
    expect(screen.getByText('A$87,50 darunter')).toBeInTheDocument()
    expect(screen.getByText('A$1.687,50')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Woche abschließen' }))

    expect(await screen.findByText(/In „Nur gespart" gebucht · Sparquote 84 %/)).toBeInTheDocument()
    expect(await booking('2026-09-14')).toMatchObject({
      potId: PRIMARY_POT_ID,
      amountCents: 168_750,
      deletedAt: null,
    })
    expect((await db.weeks.get('2026-09-14'))?.closedAt).not.toBeNull()
  })

  it('uses the income as typed and books a minus week honestly', async () => {
    const user = userEvent.setup()
    render(<CloseWeekSheet />)
    open('2026-09-14')

    await user.clear(await income())
    await user.type(await income(), '1.850,50')
    expect(screen.getByText('A$1.538,00')).toBeInTheDocument()

    await user.clear(await income())
    expect(screen.getByRole('button', { name: 'Woche abschließen' })).toBeDisabled()

    await user.type(await income(), '0')
    await user.type(screen.getByLabelText('Notiz zur Woche'), 'Keine Schichten')
    await user.click(screen.getByRole('button', { name: 'Woche abschließen' }))

    expect(await screen.findByText('Minus in dieser Woche')).toBeInTheDocument()
    expect((await booking('2026-09-14'))?.amountCents).toBe(-31_250)
    expect(await db.weeks.get('2026-09-14')).toMatchObject({
      incomeCents: 0,
      note: 'Keine Schichten',
    })
  })

  it('walks through the queue of pending weeks, oldest first', async () => {
    const user = userEvent.setup()
    render(<CloseWeekSheet />)
    open('2026-09-07')

    await user.click(await screen.findByRole('button', { name: 'Woche abschließen' }))
    await user.click(
      await screen.findByRole('button', { name: 'Nächste Woche abschließen (1 offen)' }),
    )

    expect(useUiStore.getState().closeWeekStart).toBe('2026-09-14')
    expect(await screen.findByText('14.–20. Sep. 2026')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Woche abschließen' }))

    // Nothing left: only "Fertig" remains, and it closes the sheet.
    await screen.findByText(/In „Nur gespart" gebucht/)
    expect(screen.queryByRole('button', { name: /Nächste Woche/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fertig' }))
    expect(useUiStore.getState().closeWeekOpen).toBe(false)
    expect(await db.weeks.filter((week) => week.closedAt !== null).count()).toBe(2)
  })

  it('edits and reopens a closed week', async () => {
    const user = userEvent.setup()
    await repos.weeks.close('2026-09-14', { incomeCents: 200_000 })
    render(<CloseWeekSheet />)
    open('2026-09-14')

    expect(await screen.findByRole('dialog', { name: 'Woche bearbeiten' })).toBeInTheDocument()
    await user.clear(await income())
    await user.type(await income(), '2100')
    await user.click(screen.getByRole('button', { name: 'Änderung speichern' }))
    await waitFor(async () => expect((await booking('2026-09-14'))?.amountCents).toBe(178_750))
    await waitFor(() => expect(useUiStore.getState().closeWeekOpen).toBe(false))

    open('2026-09-14')
    await user.click(await screen.findByRole('button', { name: 'Woche wieder öffnen' }))
    await waitFor(async () => expect((await db.weeks.get('2026-09-14'))?.closedAt).toBeNull())
    expect((await booking('2026-09-14'))?.deletedAt).not.toBeNull()
    expect(useUiStore.getState().closeWeekOpen).toBe(false)
  })
})
