import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeCategory } from '@/test/fixtures'
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
    })

    await user.click(screen.getByRole('button', { name: 'Ausgabe löschen' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
