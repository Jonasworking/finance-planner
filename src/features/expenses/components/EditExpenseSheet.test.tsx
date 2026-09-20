import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db, repos } from '@/db'
import { useUiStore } from '@/shared/stores/uiStore'
import { EditExpenseSheet } from './EditExpenseSheet'

/*
 * Regression: an edit sheet without its expense must never stay open. It renders no content, but
 * its modal overlay blocks everything underneath – which is how a swipe-delete once made the undo
 * toast unreachable. Runs against the real database layer (fake-indexeddb) and live queries.
 */

beforeAll(() => {
  // jsdom has no matchMedia. "Desktop" makes ResponsiveSheet render the Radix dialog.
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
})

beforeEach(async () => {
  useUiStore.setState({ editingExpenseId: null, editOpen: false })
  await db.delete()
  await db.open()
})

const addExpense = (amountCents: number) =>
  repos.expenses.add({
    date: '2026-09-22',
    amountCents,
    categoryId: 'cat:groceries',
    note: 'Kaffee',
  })

const open = (id: string) => act(() => useUiStore.getState().openExpense(id))
const isOpen = () => useUiStore.getState().editOpen
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 150)))

describe('EditExpenseSheet', () => {
  it('shows the stored expense', async () => {
    const expense = await addExpense(1250)
    render(<EditExpenseSheet />)
    open(expense.id)

    expect(await screen.findByRole('dialog', { name: 'Ausgabe bearbeiten' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Betrag')).toHaveTextContent('A$12,50')
    expect(isOpen()).toBe(true)
  })

  it('closes itself when its expense is deleted while it is open', async () => {
    const expense = await addExpense(1250)
    render(<EditExpenseSheet />)
    open(expense.id)
    await screen.findByLabelText('Betrag')

    await act(() => repos.expenses.remove(expense.id))

    await waitFor(() => expect(isOpen()).toBe(false))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not stay open for an expense that is already gone (the swipe-delete race)', async () => {
    const expense = await addExpense(1250)
    await repos.expenses.remove(expense.id)
    render(<EditExpenseSheet />)
    open(expense.id)

    await waitFor(() => expect(isOpen()).toBe(false))
    expect(screen.queryByLabelText('Betrag')).not.toBeInTheDocument()

    // Same for an id that never existed.
    open('missing')
    await waitFor(() => expect(isOpen()).toBe(false))
  })

  it('is not closed by a stale "not found" when the next expense is opened', async () => {
    const gone = await addExpense(1250)
    const next = await addExpense(990)
    await repos.expenses.remove(gone.id)
    render(<EditExpenseSheet />)

    open(gone.id)
    await waitFor(() => expect(isOpen()).toBe(false))

    open(next.id)
    expect(await screen.findByLabelText('Betrag')).toHaveTextContent('A$9,90')
    await settle()
    expect(isOpen()).toBe(true)
  })

  it('reopens after an undo', async () => {
    const expense = await addExpense(1250)
    await repos.expenses.remove(expense.id)
    await repos.expenses.restore(expense.id)
    render(<EditExpenseSheet />)
    open(expense.id)

    expect(await screen.findByLabelText('Betrag')).toHaveTextContent('A$12,50')
    await settle()
    expect(isOpen()).toBe(true)
  })
})
