import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Insight } from '@/lib/insights'
import { useUiStore } from '@/shared/stores/uiStore'
import { describeInsight } from '../insightCopy'
import { InsightCard } from './InsightCard'

const frame = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)))

/** A real pointer drag as motion sees it: down on the card, moves and up on the window. */
async function swipe(target: HTMLElement, distance: number) {
  const at = (clientX: number) => ({
    clientX,
    clientY: 20,
    pointerId: 1,
    isPrimary: true,
    button: 0,
  })
  fireEvent.pointerDown(target, { ...at(100), buttons: 1 })
  await frame()
  for (let step = 1; step <= 6; step++) {
    fireEvent.pointerMove(window, { ...at(100 + (distance / 6) * step), buttons: 1 })
    await frame()
  }
  fireEvent.pointerUp(window, at(100 + distance))
  await frame()
}

const budgetOver: Insight = {
  kind: 'budget-over',
  id: 'budget-over:2026-09-21',
  severity: 'warning',
  priority: 100,
  overCents: 5_000,
}
const refs = { categories: [], pots: [], today: '2026-09-23' }

function setup(insight: Insight = budgetOver) {
  const onDismiss = vi.fn()
  render(
    <MemoryRouter>
      <InsightCard insight={insight} copy={describeInsight(insight, refs)} onDismiss={onDismiss} />
    </MemoryRouter>,
  )
  return { onDismiss, card: screen.getByRole('article') }
}

describe('InsightCard', () => {
  it('renders title, text and the action link', () => {
    setup()
    expect(screen.getByRole('article', { name: 'A$50,00 über dem Budget' })).toBeInTheDocument()
    expect(screen.getByText(/über deinem Wochenlimit/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Budget' })).toHaveAttribute('href', '/budget')
  })

  it('dismisses via the accessible button', async () => {
    const { onDismiss } = setup()
    fireEvent.click(
      screen.getByRole('button', { name: 'Hinweis ausblenden: A$50,00 über dem Budget' }),
    )
    await waitFor(() => expect(onDismiss).toHaveBeenCalledWith(budgetOver))
  })

  it('dismisses on a long swipe and swallows the click that follows the drag', async () => {
    const { onDismiss, card } = setup()
    const link = screen.getByRole('link', { name: 'Budget' })
    const followed = vi.fn((event: Event) => event.preventDefault())
    link.addEventListener('click', followed)

    await swipe(card, 220)
    // The browser fires a click on what is under the pointer once the drag ends.
    fireEvent.click(link, { detail: 1 })
    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce())
    expect(followed).not.toHaveBeenCalled()
  })

  it('springs back after a short swipe and keeps the card', async () => {
    const { onDismiss, card } = setup()
    await swipe(card, 40)
    await waitFor(() =>
      expect(card.style.transform === '' || card.style.transform === 'none').toBe(true),
    )
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('opens the EUR-rate sheet for the stale-rate insight', () => {
    useUiStore.setState({ eurRateOpen: false })
    setup({
      kind: 'eur-rate-stale',
      id: 'eur-rate:2026-09',
      severity: 'info',
      priority: 20,
      days: 40,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kurs prüfen' }))
    expect(useUiStore.getState().eurRateOpen).toBe(true)
  })
})
