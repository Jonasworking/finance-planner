import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import sample from '@/lib/__fixtures__/commbank-sample.csv?raw'
import { parseBankFile } from '@/lib/bankImport'
import { MotionFeatures, stubDesktopViewport } from '@/test/ui'
import { InboxPage } from './InboxPage'
import { MerchantRulesPage } from './MerchantRulesPage'

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

/** The sample export, already in the inbox (16 debits, newest first). */
async function importSample() {
  const parsed = parseBankFile(sample)
  if (!parsed.ok) throw new Error(parsed.reason)
  await repos.bank.import(parsed.rows)
}

const renderPage = (page = <InboxPage />) =>
  render(
    <MemoryRouter>
      <MotionFeatures>{page}</MotionFeatures>
    </MemoryRouter>,
  )

const frame = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)))

/** A real pointer drag, as in SwipeRow.test – followed by the click browsers fire afterwards. */
async function drag(target: Element, distance: number) {
  const pointer = { pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientY: 20 }
  fireEvent.pointerDown(target, { ...pointer, clientX: 300 })
  await frame()
  for (let step = 1; step <= 6; step++) {
    fireEvent.pointerMove(window, { ...pointer, clientX: 300 + (distance * step) / 6 })
    await frame()
  }
  fireEvent.pointerUp(window, { ...pointer, clientX: 300 + distance, buttons: 0 })
  fireEvent.click(target, { detail: 1 })
  await frame()
}

const card = (name: RegExp) => screen.findByRole('group', { name })
const active = async () =>
  (await db.expenses.toArray()).filter((expense) => expense.deletedAt === null)
const lastToastAction = () => {
  const [, options] = vi.mocked(toast).mock.calls.at(-1)! as unknown as [
    string,
    { action: { onClick: () => void } },
  ]
  return options.action.onClick
}

describe('InboxPage – card stack', () => {
  it('shows one booking as a receipt with the two likeliest categories at the edges', async () => {
    // history says: groceries most, then eating out
    for (const categoryId of ['cat:groceries', 'cat:groceries', 'cat:eating-out']) {
      await repos.expenses.add({ date: '2026-09-07', amountCents: 111, categoryId })
    }
    await importSample()
    renderPage()

    const top = await card(/^Express Fuel Stop, A\$9,25$/)
    expect(within(top).getByText('4321-EXPRESS FUEL STOP PERTH AU')).toBeInTheDocument()
    expect(within(top).getByText('Heute')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nach rechts: Lebensmittel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nach links: Essen gehen' })).toBeInTheDocument()
    expect(screen.getByText('1 von 16')).toBeInTheDocument()
    expect(screen.getByText('Wischen oder antippen')).toBeInTheDocument()
  })

  it('files the card by swiping – right and left – and learns the merchant', async () => {
    await importSample()
    renderPage()

    await drag(await card(/^Express Fuel Stop/), 200)
    await waitFor(async () => expect(await active()).toHaveLength(1))
    expect((await active())[0]).toMatchObject({
      categoryId: 'cat:rent',
      amountCents: 925,
      note: 'Express Fuel Stop',
    })
    expect(await screen.findByText('Zuletzt: Express Fuel Stop → Miete/Wohnen')).toBeInTheDocument()
    expect(screen.getByText('2 von 16')).toBeInTheDocument()

    await drag(await card(/^Seaside Tavern Fremantle/), -200)
    await waitFor(async () => expect(await active()).toHaveLength(2))
    expect((await active()).map((expense) => expense.categoryId).sort()).toEqual([
      'cat:groceries',
      'cat:rent',
    ])
    expect(
      (await db.merchantRules.toArray()).map((rule) => [rule.pattern, rule.categoryId]),
    ).toEqual([
      ['express fuel stop', 'cat:rent'],
      ['seaside tavern fremantle', 'cat:groceries'],
    ])
  })

  it('does nothing on a short drag, and the click after a drag opens nothing', async () => {
    await repos.expenses.add({ date: '2026-09-20', amountCents: 925, categoryId: 'cat:transport' })
    await repos.expenses.add({ date: '2026-09-19', amountCents: 925, categoryId: 'cat:transport' })
    await importSample()
    renderPage()

    // dragged by its "Vielleicht schon erfasst" button: letting go must not open the sheet
    const top = await card(/^Express Fuel Stop/)
    await drag(within(top).getByRole('button', { name: /Vielleicht schon erfasst/ }), 40)
    await frame()
    expect(await active()).toHaveLength(2)
    expect(screen.getByText('1 von 16')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // once the card has sprung back, a plain tap on it does
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 600)))
    await userEvent.setup().click(
      within(await card(/^Express Fuel Stop/)).getByRole('button', {
        name: /Vielleicht schon erfasst/,
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Buchung zuordnen' })
    expect(
      within(dialog).getAllByRole('button', { name: /^Ist dieselbe: Transport/ }),
    ).toHaveLength(2)
  })

  it('works with the keyboard and by tapping a target or another category', async () => {
    await importSample()
    const user = userEvent.setup()
    renderPage()

    ;(await card(/^Express Fuel Stop/)).focus()
    await user.keyboard('{ArrowRight}')
    await card(/^Seaside Tavern Fremantle/)
    await user.click(screen.getByRole('button', { name: 'Nach links: Lebensmittel' }))
    await card(/^Woolworths/)
    await user.click(screen.getByRole('radio', { name: 'Shopping' }))
    await card(/^Fitclubperth/)

    expect((await active()).map((expense) => expense.categoryId).sort()).toEqual([
      'cat:groceries',
      'cat:rent',
      'cat:shopping',
    ])
    expect(screen.getByText('4 von 16')).toBeInTheDocument()
  })

  it('skips a card to the end, marks "Keine Ausgabe" and takes the last step back', async () => {
    await importSample()
    const user = userEvent.setup()
    renderPage()
    const undo = () => screen.getByRole('button', { name: 'Rückgängig' })
    await card(/^Express Fuel Stop/)
    expect(undo()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Überspringen' }))
    await card(/^Seaside Tavern Fremantle/)
    expect(screen.getByText('1 von 16')).toBeInTheDocument() // skipping files nothing

    await user.click(screen.getByRole('button', { name: 'Keine Ausgabe' }))
    await card(/^Woolworths/)
    expect(
      screen.getByText('Zuletzt: Seaside Tavern Fremantle → keine Ausgabe'),
    ).toBeInTheDocument()
    expect(await active()).toEqual([])
    expect(await db.merchantRules.get('rule:seaside tavern fremantle')).toMatchObject({
      action: 'ignore',
    })

    await user.click(screen.getByRole('radio', { name: 'Lebensmittel' }))
    await card(/^Fitclubperth/)
    expect(await active()).toHaveLength(1)

    // undo: one step at a time, newest first
    await user.click(undo())
    await card(/^Woolworths/)
    expect(await active()).toEqual([])
    expect((await db.merchantRules.get('rule:woolworths'))!.deletedAt).not.toBeNull()

    await user.click(undo())
    await card(/^Seaside Tavern Fremantle/)
    expect((await db.merchantRules.get('rule:seaside tavern fremantle'))!.deletedAt).not.toBeNull()
    expect(undo()).toBeDisabled()
    expect(screen.getByText('1 von 16')).toBeInTheDocument()
  })

  it('points out a closed week on the card', async () => {
    await repos.weeks.close('2026-09-14', { incomeCents: 200_000 })
    await importSample()
    renderPage()
    const top = await card(/^Express Fuel Stop/)
    expect(within(top).getByText(/ist abgeschlossen – ihr Gespartes sinkt um/)).toBeInTheDocument()
  })

  it('puts the learned category on the right for the next branch of a merchant', async () => {
    await importSample()
    const [first] = (await db.bankTransactions.toArray()).filter((tx) =>
      tx.description.startsWith('WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 16'),
    )
    await repos.bank.assign(first!.id, 'cat:shopping')
    const user = userEvent.setup()
    renderPage()

    await card(/^Express Fuel Stop/)
    for (let skip = 0; skip < 4; skip++) {
      await user.click(screen.getByRole('button', { name: 'Überspringen' }))
    }
    await card(/^Woolworths, A\$11,05$/)
    expect(screen.getByRole('button', { name: 'Nach rechts: Shopping' })).toBeInTheDocument()
  })
})

describe('InboxPage – known merchants', () => {
  it('offers to sort bookings of confirmed merchants, with a preview and undo', async () => {
    await importSample()
    const woolworths = (await db.bankTransactions.toArray())
      .filter((tx) => tx.description.startsWith('WOOLWORTHS'))
      .sort((a, b) => b.date.localeCompare(a.date))
    const user = userEvent.setup()
    renderPage()
    await card(/^Express Fuel Stop/)
    expect(screen.queryByText(/von bekannten Händlern/)).not.toBeInTheDocument()

    // two Woolworths bookings by hand → the third is "known"
    await repos.bank.assign(woolworths[0]!.id, 'cat:groceries')
    await repos.bank.assign(woolworths[1]!.id, 'cat:groceries')
    expect(await screen.findByText('1 Buchung von bekannten Händlern')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Vorschau' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bekannte Händler' })
    const box = within(dialog).getByRole('checkbox', { name: 'Woolworths → Lebensmittel' })
    expect(box).toBeChecked()
    expect(await active()).toHaveLength(2) // a preview writes nothing

    await user.click(box)
    expect(within(dialog).getByRole('button', { name: 'Nichts ausgewählt' })).toBeDisabled()
    await user.click(box)
    await user.click(within(dialog).getByRole('button', { name: 'Übernehmen (1)' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(toast).toHaveBeenLastCalledWith('1 Buchung zugeordnet', expect.anything())
    expect(await active()).toHaveLength(3)
    await waitFor(() =>
      expect(screen.queryByText(/von bekannten Händlern/)).not.toBeInTheDocument(),
    )
    // applying a rule is no confirmation
    expect(await db.merchantRules.get('rule:woolworths')).toMatchObject({ confirmations: 2 })

    lastToastAction()()
    expect(await screen.findByText('1 Buchung von bekannten Händlern')).toBeInTheDocument()
    expect(await active()).toHaveLength(2)
  })
})

describe('MerchantRulesPage', () => {
  it('explains itself without rules', async () => {
    renderPage(<MerchantRulesPage />)
    expect(await screen.findByText('Noch keine Regeln')).toBeInTheDocument()
  })

  it('lists what was learned and forgets a rule on request, with undo', async () => {
    await importSample()
    const rows = await db.bankTransactions.toArray()
    const find = (start: string) => rows.find((tx) => tx.description.startsWith(start))!
    await repos.bank.assign(find('WOOLWORTHS 5678').id, 'cat:groceries')
    await repos.bank.assign(
      find('WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 16').id,
      'cat:groceries',
    )
    await repos.bank.ignore(find('HARBOUR HOSTEL').id)
    const user = userEvent.setup()
    renderPage(<MerchantRulesPage />)

    expect(await screen.findByText('Woolworths')).toBeInTheDocument()
    expect(screen.getByText('→ Lebensmittel · 2× bestätigt')).toBeInTheDocument()
    expect(screen.getByText('Harbour Hostel Perth')).toBeInTheDocument()
    expect(screen.getByText('→ Keine Ausgabe · 1× bestätigt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Regel Woolworths löschen' }))
    await waitFor(() => expect(screen.queryByText('Woolworths')).not.toBeInTheDocument())
    expect(toast).toHaveBeenLastCalledWith('Regel „Woolworths" gelöscht', expect.anything())
    expect((await db.merchantRules.get('rule:woolworths'))!.deletedAt).not.toBeNull()
    // expenses stay
    expect(await active()).toHaveLength(2)

    lastToastAction()()
    expect(await screen.findByText('Woolworths')).toBeInTheDocument()
  })
})
