import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeCategory, makeExpense, makePot } from '@/test/fixtures'
import { ExpenseForm, type ExpenseFormProps } from './ExpenseForm'

const TODAY = '2026-09-23'
const categories = [
  makeCategory('cat:groceries', { name: 'Lebensmittel', icon: 'ShoppingBasket' }),
  makeCategory('cat:rent', { name: 'Miete/Wohnen', icon: 'House' }),
]

function setup(overrides: Partial<ExpenseFormProps> = {}) {
  const onSubmit = vi.fn()
  const onDelete = vi.fn()
  const user = userEvent.setup()
  render(
    <ExpenseForm
      initial={{ amountInput: '', categoryId: null, date: TODAY, note: '', tags: [] }}
      categories={categories}
      tagVocabulary={['cafe', 'woolworths']}
      today={TODAY}
      submitLabel="Speichern"
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  const numpad = within(screen.getByRole('group', { name: 'Ziffernblock' }))
  const press = async (...keys: string[]) => {
    for (const key of keys) await user.click(numpad.getByRole('button', { name: key }))
  }
  return { user, onSubmit, onDelete, press }
}

describe('ExpenseForm', () => {
  it('captures an expense with amount → category → save', async () => {
    const { user, onSubmit, press } = setup()
    const save = screen.getByRole('button', { name: 'Speichern' })
    expect(save).toBeDisabled()

    await press('1', '2', 'Komma', '5')
    expect(screen.getByLabelText('Betrag')).toHaveTextContent('A$12,5')
    expect(save).toBeDisabled() // still no category

    await user.click(screen.getByRole('radio', { name: 'Lebensmittel' }))
    await user.click(save)

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      amountCents: 1250,
      categoryId: 'cat:groceries',
      date: TODAY,
      note: undefined,
      tags: [],
      fundedByPotId: null,
    })
  })

  it('corrects the amount with backspace and ignores a third decimal', async () => {
    const { press } = setup()
    await press('9', '9', 'Komma', '9', '9', '9', 'Löschen')
    expect(screen.getByLabelText('Betrag')).toHaveTextContent('A$99,9')
  })

  it('accepts the hardware keyboard: digits, comma or dot, Enter saves', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('radio', { name: 'Miete/Wohnen' }))
    await user.keyboard('180.5{Backspace}{Backspace}{Enter}')
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 18_000, categoryId: 'cat:rent' }),
    )
  })

  it('adds note, tags (typed and suggested) and a date behind "Details"', async () => {
    const { user, onSubmit, press } = setup()
    await press('7')
    await user.click(screen.getByRole('radio', { name: 'Lebensmittel' }))

    expect(screen.queryByLabelText('Notiz')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Details/ }))
    await user.type(screen.getByLabelText('Notiz'), '  Flat White ')
    await user.type(screen.getByLabelText('Tag hinzufügen'), '#Treat{Enter}')
    await user.click(screen.getByRole('option', { name: 'cafe' }))
    // Typing digits into a text field must not leak into the amount.
    await user.type(screen.getByLabelText('Notiz'), '2')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onSubmit).toHaveBeenCalledWith({
      amountCents: 700,
      categoryId: 'cat:groceries',
      date: TODAY,
      note: 'Flat White 2',
      tags: ['treat', 'cafe'],
      fundedByPotId: null,
    })
  })

  it('starts from stored values in edit mode and offers delete', async () => {
    const onDelete = vi.fn()
    const { user, onSubmit } = setup({
      initial: {
        amountInput: '12,50',
        categoryId: 'cat:rent',
        date: '2026-09-21',
        note: 'Kaution',
        tags: ['umzug'],
      },
      submitLabel: 'Änderung speichern',
      onDelete,
    })
    expect(screen.getByLabelText('Betrag')).toHaveTextContent('A$12,50')
    expect(screen.getByRole('radio', { name: 'Miete/Wohnen' })).toBeChecked()
    expect(screen.getByLabelText('Notiz')).toHaveValue('Kaution') // details open because they are filled

    await user.click(screen.getByRole('button', { name: 'Änderung speichern' }))
    expect(onSubmit).toHaveBeenCalledWith({
      amountCents: 1250,
      categoryId: 'cat:rent',
      date: '2026-09-21',
      note: 'Kaution',
      tags: ['umzug'],
      fundedByPotId: null,
    })

    await user.click(screen.getByRole('button', { name: 'Ausgabe löschen' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  describe('paid from a pot ("aus Topf bezahlt")', () => {
    const pots = [
      makePot('pot:primary', { name: 'Nur gespart' }),
      makePot('pot:bali', { name: 'Bali' }),
    ]
    const potBalances = { 'pot:primary': 500_000, 'pot:bali': 80_000 }

    it('pays from the weekly budget unless a pot is chosen behind "Details"', async () => {
      const { user, onSubmit, press } = setup({ pots, potBalances })
      await press('6', '5', '0')
      await user.click(screen.getByRole('radio', { name: 'Lebensmittel' }))
      await user.click(screen.getByRole('button', { name: /Details/ }))

      expect(screen.getByRole('radio', { name: 'Wochenbudget' })).toBeChecked()
      await user.click(screen.getByRole('radio', { name: 'Bali' }))
      expect(
        screen.getByText('Zählt nicht zum Wochenbudget · A$800,00 im Topf'),
      ).toBeInTheDocument()
      // the collapsed summary says where the money comes from
      expect(screen.getByRole('button', { name: /aus „Bali"/ })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Speichern' }))
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 65_000, fundedByPotId: 'pot:bali' }),
      )
    })

    it('refuses to overdraw the pot and recovers when the amount fits or the budget pays', async () => {
      const { user, press } = setup({ pots, potBalances })
      await press('8', '0', '0', 'Komma', '0', '1')
      await user.click(screen.getByRole('radio', { name: 'Lebensmittel' }))
      await user.click(screen.getByRole('button', { name: /Details/ }))
      await user.click(screen.getByRole('radio', { name: 'Bali' }))

      expect(screen.getByRole('alert')).toHaveTextContent('In „Bali" sind nur A$800,00.')
      expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled()

      await user.click(screen.getByRole('radio', { name: 'Wochenbudget' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled()
    })

    it('gives an edited expense back what it already holds in its pot', async () => {
      const existing = makeExpense('2026-09-21', 70_000, { fundedByPotId: 'pot:bali' })
      const { press } = setup({
        pots,
        potBalances: { ...potBalances, 'pot:bali': 10_000 }, // what is left after this expense
        existing,
        initial: {
          amountInput: '700',
          categoryId: 'cat:groceries',
          date: '2026-09-21',
          note: '',
          tags: [],
          fundedByPotId: 'pot:bali',
        },
        submitLabel: 'Änderung speichern',
      })
      // details open by themselves because the expense is pot-funded
      expect(screen.getByRole('radio', { name: 'Bali' })).toBeChecked()
      expect(screen.getByText(/A\$800,00 im Topf/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Änderung speichern' })).toBeEnabled()

      await press('Löschen', 'Löschen', 'Löschen', '8', '0', '1')
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('offers no choice when there is nothing to pay from', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: /Details/ }))
      expect(screen.queryByRole('radiogroup', { name: 'Bezahlt aus' })).not.toBeInTheDocument()
    })
  })
})
