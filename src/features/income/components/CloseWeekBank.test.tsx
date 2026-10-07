import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import sample from '@/lib/__fixtures__/commbank-sample.csv?raw'
import { parseBankFile } from '@/lib/bankImport'
import { useUiStore } from '@/shared/stores/uiStore'
import { stubDesktopViewport } from '@/test/ui'
import { CloseWeekSheet } from './CloseWeekSheet'

// Wednesday after the week of the sample export (14.–20. Sep.).
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
  const parsed = parseBankFile(sample)
  if (!parsed.ok) throw new Error(parsed.reason)
  await repos.bank.import(parsed.rows)
})

const renderSheet = () =>
  render(
    <MemoryRouter>
      <CloseWeekSheet />
    </MemoryRouter>,
  )
const open = (weekStart: string) => act(() => useUiStore.getState().openCloseWeek(weekStart))
const income = () => screen.findByLabelText('Einkommen dieser Woche')
const markWage = async () => {
  const wage = (await db.bankTransactions.toArray()).find((tx) =>
    tx.description.startsWith('Fast Transfer From ACME'),
  )!
  await repos.bank.markIncomeSource(wage.id)
}

describe('CloseWeekSheet – income from the bank import', () => {
  it('keeps the default while no employer is marked', async () => {
    renderSheet()
    open('2026-09-14')
    expect(await income()).toHaveValue('2000')
    expect(screen.queryByText(/Aus dem Bank-Import/)).not.toBeInTheDocument()
  })

  it('prefills what the marked employer paid in that week – and writes nothing by itself', async () => {
    await markWage()
    const user = userEvent.setup()
    renderSheet()
    open('2026-09-14')

    expect(await income()).toHaveValue('1432,60')
    expect(
      screen.getByText(/Aus dem Bank-Import: Gutschrift vom Do\., 17\. Sep\./),
    ).toBeInTheDocument()
    // a suggestion only: no week row until the user closes the week
    expect(await db.weeks.get('2026-09-14')).toBeUndefined()

    // and it can be overwritten
    await user.clear(await income())
    await user.type(await income(), '1500')
    await user.click(screen.getByRole('button', { name: 'Woche abschließen' }))
    await screen.findByText(/In „Nur gespart" gebucht/)
    expect(await db.weeks.get('2026-09-14')).toMatchObject({ incomeCents: 150_000 })
  })

  it('closes with the suggested amount when it is confirmed as it stands', async () => {
    await markWage()
    const user = userEvent.setup()
    renderSheet()
    open('2026-09-14')
    expect(await income()).toHaveValue('1432,60')
    await user.click(screen.getByRole('button', { name: 'Woche abschließen' }))
    await screen.findByText(/In „Nur gespart" gebucht/)
    expect(await db.weeks.get('2026-09-14')).toMatchObject({ incomeCents: 143_260 })
  })

  it('does not suggest the payment for another week, nor over a stored income', async () => {
    await markWage()
    await repos.weeks.setIncome('2026-09-14', 180_000)
    renderSheet()

    open('2026-09-07') // the sample has only an own transfer in that week
    expect(await income()).toHaveValue('2000')
    expect(screen.queryByText(/Aus dem Bank-Import/)).not.toBeInTheDocument()

    open('2026-09-14')
    expect(await screen.findByDisplayValue('1800')).toBeInTheDocument()
    expect(screen.queryByText(/Aus dem Bank-Import/)).not.toBeInTheDocument()
  })

  it('says how many bookings of the week still wait in the inbox', async () => {
    renderSheet()
    open('2026-09-14')
    // purchases from Mon 14 to Sun 20: direct debit (14.), telco (bought 14.), direct debit (18.),
    // Woolworths (bought 16.), tavern (19.), fuel (20.)
    expect(
      await screen.findByRole('link', {
        name: /6 Buchungen dieser Woche warten noch in der Inbox/,
      }),
    ).toHaveAttribute('href', '/inbox')
  })
})
