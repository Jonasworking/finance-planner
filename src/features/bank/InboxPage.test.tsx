import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import sample from '@/lib/__fixtures__/commbank-sample.csv?raw'
import { MotionFeatures, stubDesktopViewport } from '@/test/ui'
import { InboxPage } from './InboxPage'

const TODAY = '2026-09-20'
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-20' }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

beforeAll(() => stubDesktopViewport())

beforeEach(async () => {
  vi.clearAllMocks()
  await repos.backup.wipeAll()
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

const renderPage = () =>
  render(
    <MemoryRouter>
      <MotionFeatures>
        <InboxPage />
      </MotionFeatures>
    </MemoryRouter>,
  )

const csv = (text: string = sample, name = 'CSVData.csv') =>
  new File([text], name, { type: 'text/csv' })

/** Picks a file and confirms the preview. */
async function importFile(user: ReturnType<typeof userEvent.setup>, file: File = csv()) {
  await user.upload(await screen.findByLabelText('Bank-Export wählen'), file)
  const dialog = await screen.findByRole('dialog', { name: 'CSV importieren' })
  const confirm = await within(dialog).findByRole('button', { name: 'Importieren' })
  await waitFor(() => expect(confirm).toBeEnabled())
  await user.click(confirm)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

/** The plain list instead of the card stack (the default view). */
const showList = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(await screen.findByRole('radio', { name: 'Liste' }))

const count = (dialog: HTMLElement, label: string) =>
  within(dialog).getByText(label).nextElementSibling?.textContent

const lastToastAction = () => {
  const [, options] = vi.mocked(toast).mock.calls.at(-1)! as unknown as [
    string,
    { action: { onClick: () => void } },
  ]
  return options.action.onClick
}

describe('InboxPage – import', () => {
  it('explains itself before the first import', async () => {
    renderPage()
    expect(await screen.findByText('Noch nichts importiert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CSV importieren' })).toBeInTheDocument()
  })

  it('previews a file, imports it into the inbox and creates no expense', async () => {
    await repos.expenses.add({
      date: '2026-09-16',
      amountCents: 3_764,
      categoryId: 'cat:groceries',
    })
    const user = userEvent.setup()
    renderPage()

    await user.upload(await screen.findByLabelText('Bank-Export wählen'), csv())
    const dialog = await screen.findByRole('dialog', { name: 'CSV importieren' })
    await within(dialog).findByText('Neu in der Inbox')
    expect(count(dialog, 'Neu in der Inbox')).toBe('15')
    expect(count(dialog, 'Schon von Hand erfasst')).toBe('1')
    expect(count(dialog, 'Bereits importiert')).toBe('0')
    expect(count(dialog, 'Gutschriften')).toBe('2')
    expect(count(dialog, 'Vor deinem Tracking-Beginn')).toBe('1')
    // nothing is stored before the user says so
    expect(await db.bankTransactions.count()).toBe(0)

    await user.click(within(dialog).getByRole('button', { name: 'Importieren' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith('15 Buchungen in der Inbox', {
      description: '1 schon erfasst und verknüpft',
    })

    expect(await screen.findByText('15 Buchungen offen')).toBeInTheDocument()
    await showList(user)
    expect(screen.getByText('Seaside Tavern Fremantle')).toBeInTheDocument()
    expect(screen.queryByText(/Fast Transfer From/)).not.toBeInTheDocument() // credits stay out
    expect(screen.getByText('Erledigt: 1 schon erfasst · 1 keine Ausgabe · 2 Gutschriften'))
    expect(await db.expenses.count()).toBe(1)
  })

  it('offers nothing to import when the same file comes again', async () => {
    const user = userEvent.setup()
    renderPage()
    await importFile(user)
    expect(await db.bankTransactions.count()).toBe(19)

    await user.upload(screen.getByLabelText('Bank-Export wählen'), csv())
    const dialog = await screen.findByRole('dialog', { name: 'CSV importieren' })
    const button = await within(dialog).findByRole('button', { name: 'Nichts Neues' })
    expect(button).toBeDisabled()
    expect(count(dialog, 'Bereits importiert')).toBe('19')
    expect(count(dialog, 'Neu in der Inbox')).toBe('0')
  })

  it('lets the user keep an automatic match in the inbox ("Lösen")', async () => {
    await repos.expenses.add({
      date: '2026-09-16',
      amountCents: 3_764,
      categoryId: 'cat:groceries',
    })
    const user = userEvent.setup()
    renderPage()

    await user.upload(await screen.findByLabelText('Bank-Export wählen'), csv())
    const dialog = await screen.findByRole('dialog', { name: 'CSV importieren' })
    await user.click(
      await within(dialog).findByRole('button', { name: 'WOOLWORTHS 1234 MIDLAND WA AUS: lösen' }),
    )
    expect(count(dialog, 'Neu in der Inbox')).toBe('16')
    expect(count(dialog, 'Schon von Hand erfasst')).toBe('0')

    await user.click(within(dialog).getByRole('button', { name: 'Importieren' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const rows = await db.bankTransactions.toArray()
    expect(rows.filter((tx) => tx.status === 'matched')).toEqual([])
    // the line now shows that it may be a duplicate
    await showList(user)
    expect(await screen.findByText(/vielleicht schon erfasst/)).toBeInTheDocument()
  })

  it('rejects files that are no bank export and reports unreadable lines', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = await screen.findByLabelText('Bank-Export wählen')

    await user.upload(input, csv('{"app":"finance-planner"}', 'backup.csv'))
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/kein CommBank-Export/))
    await user.upload(input, csv('', 'leer.csv'))
    expect(toast.error).toHaveBeenCalledWith('Die Datei ist leer.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.upload(input, csv(`${sample}99/99/2026,"-1.00","KAPUTT","+1.00"\r\n`))
    const dialog = await screen.findByRole('dialog', { name: 'CSV importieren' })
    await within(dialog).findByText('Unlesbare Zeilen')
    expect(count(dialog, 'Unlesbare Zeilen')).toBe('1')
  })

  it('warns when a file does not connect to the last import', async () => {
    const lines = sample.trim().split('\r\n')
    const user = userEvent.setup()
    renderPage()
    await importFile(user, csv(lines.filter((line) => line.slice(0, 2) <= '10').join('\r\n')))

    await user.upload(
      screen.getByLabelText('Bank-Export wählen'),
      csv(lines.filter((line) => line.slice(0, 2) >= '18').join('\r\n')),
    )
    const dialog = await screen.findByRole('dialog', { name: 'CSV importieren' })
    expect(await within(dialog).findByText(/schließt nicht an den letzten Import an/)).toBeVisible()
  })
})

describe('InboxPage – assigning', () => {
  it('turns a line into an expense by picking a category, with undo', async () => {
    const user = userEvent.setup()
    renderPage()
    await importFile(user)
    await showList(user)

    await user.click(await screen.findByRole('button', { name: /Seaside Tavern Fremantle/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Buchung zuordnen' })
    await user.click(within(dialog).getByRole('radio', { name: 'Essen gehen' }))

    await waitFor(() =>
      expect(screen.queryByText('Seaside Tavern Fremantle')).not.toBeInTheDocument(),
    )
    expect(await db.expenses.toArray()).toMatchObject([
      { date: '2026-09-19', amountCents: 1_680, note: 'Seaside Tavern Fremantle' },
    ])
    expect(toast).toHaveBeenLastCalledWith(
      'Seaside Tavern Fremantle → Essen gehen',
      expect.anything(),
    )

    lastToastAction()()
    expect(await screen.findByText('Seaside Tavern Fremantle')).toBeInTheDocument()
    // the rule the assignment had taught is forgotten again
    expect((await db.merchantRules.toArray()).filter((rule) => rule.deletedAt === null)).toEqual([])
    expect((await db.expenses.toArray()).filter((expense) => expense.deletedAt === null)).toEqual(
      [],
    )
  })

  it('says so when the expense lands in a closed week', async () => {
    await repos.weeks.close('2026-09-14', { incomeCents: 200_000 })
    const user = userEvent.setup()
    renderPage()
    await importFile(user)
    await showList(user)

    await user.click(
      await screen.findByRole('button', { name: /Seaside Tavern.*Woche abgeschlossen/ }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Buchung zuordnen' })
    expect(within(dialog).getByText(/ist abgeschlossen – als neue Ausgabe sinkt/)).toBeVisible()

    await user.click(within(dialog).getByRole('radio', { name: 'Essen gehen' }))
    await waitFor(async () =>
      expect((await db.potTransactions.get('auto:2026-09-14'))!.amountCents).toBe(198_320),
    )
  })

  it('links a line to a hand-entered expense instead ("ist dieselbe"), with undo', async () => {
    // two identical vending lines, one entered by hand → the import cannot decide
    const manual = await repos.expenses.add({
      date: '2026-09-10',
      amountCents: 320,
      categoryId: 'cat:groceries',
      note: 'Automat',
    })
    const user = userEvent.setup()
    renderPage()
    await importFile(user)
    await showList(user)

    const [first] = await screen.findAllByRole('button', {
      name: /Quick Vending.*vielleicht schon erfasst/,
    })
    await user.click(first!)
    const dialog = await screen.findByRole('dialog', { name: 'Buchung zuordnen' })
    await user.click(within(dialog).getByRole('button', { name: /^Ist dieselbe: Lebensmittel/ }))

    await waitFor(async () =>
      expect((await db.bankTransactions.toArray()).filter((tx) => tx.status === 'matched')).toEqual(
        [expect.objectContaining({ expenseId: manual.id })],
      ),
    )
    expect(await db.expenses.count()).toBe(1)
    // the other identical line no longer claims the same expense
    await waitFor(() =>
      expect(screen.queryByText(/vielleicht schon erfasst/)).not.toBeInTheDocument(),
    )

    lastToastAction()()
    expect(await screen.findAllByText(/vielleicht schon erfasst/)).toHaveLength(2)
  })

  it('takes a line out as "Keine Ausgabe", with undo', async () => {
    const user = userEvent.setup()
    renderPage()
    await importFile(user)
    await showList(user)

    await user.click(await screen.findByRole('button', { name: /Harbour Hostel/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Buchung zuordnen' })
    await user.click(within(dialog).getByRole('button', { name: 'Keine Ausgabe' }))

    await waitFor(() => expect(screen.queryByText(/Harbour Hostel/)).not.toBeInTheDocument())
    expect(await db.expenses.count()).toBe(0)

    lastToastAction()()
    expect(await screen.findByText(/Harbour Hostel/)).toBeInTheDocument()
  })

  it('says "Alles zugeordnet" once the inbox is empty', async () => {
    const user = userEvent.setup()
    renderPage()
    await importFile(user, csv('20/09/2026,"-9.25","4321-EXPRESS FUEL STOP PERTH AU","+10.00"'))
    await showList(user)

    await user.click(await screen.findByRole('button', { name: /Express Fuel Stop/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Buchung zuordnen' })
    await user.click(within(dialog).getByRole('radio', { name: 'Transport' }))

    expect(await screen.findByText('Alles zugeordnet')).toBeInTheDocument()
    expect(screen.getByText('Erledigt: 1 zugeordnet')).toBeInTheDocument()
  })
})
