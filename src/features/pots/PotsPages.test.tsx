import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, loadAppData, repos } from '@/db'
import { checkLedgerInvariants } from '@/lib/ledger'
import { potBalances } from '@/lib/savings'
import { PRIMARY_POT_ID } from '@/lib/types'
import { stubDesktopViewport } from '@/test/ui'
import { PotDetailPage } from './PotDetailPage'
import { PotsPage } from './PotsPage'

vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' })) // Wednesday
// The real toaster needs pointer capture, which jsdom lacks – capture the calls instead.
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

beforeAll(stubDesktopViewport)

beforeEach(async () => {
  vi.clearAllMocks()
  await db.delete()
  await db.open()
  await repos.onboarding.complete(
    {
      defaultWeeklyIncomeCents: 200_000,
      totalLimitCents: 40_000,
      openingBalanceCents: 500_000,
      trackingSince: '2026-09-21',
    },
    '2026-09-23',
  )
})

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/pots" element={<PotsPage />} />
        <Route path="/pots/:potId" element={<PotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
const balances = async () => potBalances(await db.potTransactions.toArray())
const amountField = () => screen.findByRole('textbox', { name: 'Betrag' })
const newTripPot = () =>
  repos.pots.create({ name: 'Bali', targetCents: 300_000, deadline: '2026-12-20' })

describe('PotsPage', () => {
  it('shows "Nur gespart" and explains further pots instead of leaving a gap', async () => {
    renderAt('/pots')
    expect(await screen.findByText('Insgesamt A$5.000,00 gespart')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Nur gespart/ })).toHaveAttribute(
      'href',
      '/pots/pot%3Aprimary',
    )
    expect(screen.getByText('Wofür sparst du?')).toBeInTheDocument()
  })

  it('creates a pot with a target and lands on its screen', async () => {
    const user = userEvent.setup()
    renderAt('/pots')
    await user.click(await screen.findByRole('button', { name: 'Topf anlegen' }))

    const dialog = await screen.findByRole('dialog', { name: 'Neuer Spartopf' })
    expect(within(dialog).getByRole('button', { name: 'Topf anlegen' })).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Bali')
    await user.type(within(dialog).getByRole('textbox', { name: 'Zielbetrag' }), '3000')
    await user.click(within(dialog).getByRole('button', { name: 'Topf anlegen' }))

    expect(await screen.findByRole('heading', { name: 'Bali' })).toBeInTheDocument()
    expect(screen.getByText(/von A\$3\.000,00 · es fehlen A\$3\.000,00/)).toBeInTheDocument()
    expect(screen.getByText(/Noch keine Buchungen/)).toBeInTheDocument()
    expect(await db.pots.toArray()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Bali', targetCents: 300_000 })]),
    )
  })

  it('lists archived pots apart', async () => {
    const old = await repos.pots.create({ name: 'Altes Auto' })
    await repos.pots.archive(old.id)
    renderAt('/pots')
    expect(await screen.findByText('Archiviert')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Altes Auto/ })).toBeInTheDocument()
    expect(screen.queryByText('Wofür sparst du?')).toBeInTheDocument() // still only one active pot
  })
})

describe('PotDetailPage', () => {
  it('moves money in from "Nur gespart" by default and shows forecast and what is needed', async () => {
    const user = userEvent.setup()
    const trip = await newTripPot()
    renderAt(`/pots/${encodeURIComponent(trip.id)}`)

    await user.click(await screen.findByRole('button', { name: 'Umbuchen' }))
    const dialog = await screen.findByRole('dialog', { name: 'Umbuchen' })
    expect(within(dialog).getByRole('combobox', { name: 'Von' })).toHaveValue(PRIMARY_POT_ID)
    expect(within(dialog).getByRole('combobox', { name: 'Nach' })).toHaveValue(trip.id)
    expect(within(dialog).getByText(/Verfügbar in „Nur gespart": A\$5\.000,00/)).toBeInTheDocument()

    await user.type(await amountField(), '1200')
    await user.click(within(dialog).getByRole('button', { name: 'Umbuchen' }))

    await waitFor(async () =>
      expect(await balances()).toEqual({ [PRIMARY_POT_ID]: 380_000, [trip.id]: 120_000 }),
    )
    expect(await screen.findByText('40 %')).toBeInTheDocument()
    expect(screen.getByText(/es fehlen A\$1\.800,00/)).toBeInTheDocument()
    expect(screen.getByText('Umbuchung von „Nur gespart"')).toBeInTheDocument()
    // 88 days = 13 week closes until 20 Dec → 1,800 / 13, rounded up
    expect(screen.getByText('A$138,47 / Woche')).toBeInTheDocument()
    // moved in this week → no finished week yet, so no pace and no ETA
    expect(screen.getByText(/Noch kein Spartempo/)).toBeInTheDocument()
  })

  it('never lets a withdrawal or transfer take more than is there', async () => {
    const user = userEvent.setup()
    const trip = await newTripPot()
    await repos.pots.deposit(trip.id, 20_000, '2026-09-22')
    renderAt(`/pots/${encodeURIComponent(trip.id)}`)

    await user.click(await screen.findByRole('button', { name: 'Auszahlen' }))
    const dialog = await screen.findByRole('dialog', { name: 'Auszahlen' })
    await user.type(await amountField(), '200,01')
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'So viel ist in diesem Topf nicht vorhanden.',
    )
    expect(within(dialog).getByRole('button', { name: 'Auszahlen' })).toBeDisabled()

    await user.clear(await amountField())
    await user.type(await amountField(), '200')
    await user.click(within(dialog).getByRole('button', { name: 'Auszahlen' }))
    await waitFor(async () => expect((await balances())[trip.id]).toBe(0))
  })

  it('deposits with a note, deletes the booking again and brings it back with undo', async () => {
    const user = userEvent.setup()
    const trip = await newTripPot()
    renderAt(`/pots/${encodeURIComponent(trip.id)}`)

    await user.click(await screen.findByRole('button', { name: 'Einzahlen' }))
    await user.type(await amountField(), '250')
    await user.type(screen.getByRole('textbox', { name: 'Notiz' }), 'Geburtstag')
    await user.click(
      within(screen.getByRole('dialog', { name: 'Einzahlen' })).getByRole('button', {
        name: 'Einzahlen',
      }),
    )
    expect(await screen.findByText('Geburtstag')).toBeInTheDocument()

    // The accessible path of swipe-to-delete: its delete button.
    await user.click(screen.getByRole('button', { name: 'Geburtstag löschen' }))
    await waitFor(async () => expect((await balances())[trip.id]).toBeUndefined())
    expect(await screen.findByText(/Noch keine Buchungen/)).toBeInTheDocument()

    const [message, options] = vi.mocked(toast).mock.calls.at(-1)!
    expect(message).toBe('Geburtstag (+A$250,00) gelöscht')
    const action = options?.action as { label: string; onClick: () => void }
    expect(action.label).toBe('Rückgängig')
    action.onClick()
    await waitFor(async () => expect((await balances())[trip.id]).toBe(25_000))
    expect(await screen.findByText('Geburtstag')).toBeInTheDocument()
  })

  it('names weekly savings and pot-paid expenses in the history – and they cannot be deleted', async () => {
    await repos.weeks.close('2026-09-14', { incomeCents: 200_000 })
    await repos.expenses.add({
      date: '2026-09-22',
      amountCents: 60_000,
      categoryId: 'cat:travel',
      note: 'Flug',
      fundedByPotId: PRIMARY_POT_ID,
    })
    renderAt('/pots/pot%3Aprimary')

    expect(await screen.findByText('Wochenabschluss')).toBeInTheDocument()
    expect(screen.getByText(/Woche 14\.–20\. Sep\. 2026/)).toBeInTheDocument()
    expect(screen.getByText('Flug')).toBeInTheDocument()
    expect(screen.getByText(/Aus dem Topf bezahlt · Reisen/)).toBeInTheDocument()
    expect(screen.getByText('Startguthaben')).toBeInTheDocument()
    // only the manual opening balance offers deletion
    expect(screen.getAllByRole('button', { name: / löschen$/ })).toHaveLength(1)
  })

  it('archives only an empty pot, and an archived one can be restored', async () => {
    const user = userEvent.setup()
    const trip = await newTripPot()
    await repos.pots.deposit(trip.id, 5_000, '2026-09-22')
    renderAt(`/pots/${encodeURIComponent(trip.id)}`)

    await user.click(await screen.findByRole('button', { name: 'Topf bearbeiten' }))
    const dialog = await screen.findByRole('dialog', { name: 'Topf bearbeiten' })
    expect(within(dialog).getByRole('button', { name: 'Archivieren' })).toBeDisabled()
    expect(within(dialog).getByText(/Nur ein leerer Topf/)).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await repos.pots.withdraw(trip.id, 5_000, '2026-09-23')
    await user.click(await screen.findByRole('button', { name: 'Topf bearbeiten' }))
    await user.click(await screen.findByRole('button', { name: 'Archivieren' }))

    expect(await screen.findByText(/Archiviert – der Verlauf bleibt/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Einzahlen' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Wiederherstellen' }))
    expect(await screen.findByRole('button', { name: 'Einzahlen' })).toBeInTheDocument()
  })

  it('keeps "Nur gespart" protected and says so for an unknown pot', async () => {
    const user = userEvent.setup()
    const first = renderAt('/pots/pot%3Aprimary')
    await user.click(await screen.findByRole('button', { name: 'Topf bearbeiten' }))
    const dialog = await screen.findByRole('dialog', { name: 'Topf bearbeiten' })
    expect(within(dialog).queryByRole('button', { name: 'Archivieren' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Farbe')).not.toBeInTheDocument()
    first.unmount()

    renderAt('/pots/nope')
    expect(await screen.findByText('Diesen Topf gibt es nicht (mehr).')).toBeInTheDocument()
  })

  it('leaves the books consistent after all of it', async () => {
    const trip = await newTripPot()
    await repos.pots.transfer({
      fromPotId: PRIMARY_POT_ID,
      toPotId: trip.id,
      amountCents: 100_000,
      date: '2026-09-23',
    })
    expect(checkLedgerInvariants(await loadAppData(db))).toEqual([])
  })
})
