import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import sample from '@/lib/__fixtures__/commbank-sample.csv?raw'
import { parseBankFile } from '@/lib/bankImport'
import { DashboardPage } from './DashboardPage'

// Friday of the sample export's week (14.–20. Sep.) – its wage was booked on Thursday the 17th.
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-18' }))

beforeEach(async () => {
  await db.delete()
  await db.open()
  await repos.onboarding.complete(
    {
      defaultWeeklyIncomeCents: 200_000,
      totalLimitCents: 40_000,
      openingBalanceCents: 0,
      trackingSince: '2026-09-14',
    },
    '2026-09-18',
  )
  const parsed = parseBankFile(sample)
  if (!parsed.ok) throw new Error(parsed.reason)
  await repos.bank.import(parsed.rows)
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
const markWage = async () => {
  const wage = (await db.bankTransactions.toArray()).find((tx) =>
    tx.description.startsWith('Fast Transfer From ACME'),
  )!
  await repos.bank.markIncomeSource(wage.id)
}

describe('DashboardPage – wage from the bank import', () => {
  it('assumes the default income while no employer is marked', async () => {
    renderPage()
    expect(await screen.findByText(/bei A\$2\.000 Einkommen · noch 2 Tage/)).toBeInTheDocument()
  })

  it('projects with the imported wage of the running week – and writes nothing', async () => {
    renderPage()
    await screen.findByText(/bei A\$2\.000 Einkommen/)
    await markWage()

    expect(await screen.findByText(/bei A\$1\.433 Lohn \(Do\.\) · noch 2 Tage/)).toBeInTheDocument()
    expect(screen.getByText('A$1.432,60')).toBeInTheDocument()
    // display only: the week gets its income when it is closed
    expect(await db.weeks.get('2026-09-14')).toBeUndefined()
  })

  it('lets an entered income win over the bank', async () => {
    await markWage()
    await repos.weeks.setIncome('2026-09-14', 150_000)
    renderPage()
    expect(await screen.findByText(/Einkommen A\$1\.500 eingetragen/)).toBeInTheDocument()
  })
})
