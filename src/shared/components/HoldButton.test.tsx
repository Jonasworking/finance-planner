import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HoldButton } from './HoldButton'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const setup = () => {
  const onConfirm = vi.fn()
  render(<HoldButton onConfirm={onConfirm}>Gedrückt halten zum Löschen</HoldButton>)
  return { onConfirm, button: screen.getByRole('button', { name: 'Gedrückt halten zum Löschen' }) }
}

describe('HoldButton', () => {
  it('fires only after being held for the whole duration', () => {
    const { onConfirm, button } = setup()
    fireEvent.pointerDown(button, { pointerId: 1 })
    act(() => vi.advanceTimersByTime(1400))
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(100))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('cancels when let go early – a tap never deletes', () => {
    const { onConfirm, button } = setup()
    fireEvent.pointerDown(button, { pointerId: 1 })
    act(() => vi.advanceTimersByTime(1000))
    fireEvent.pointerUp(button, { pointerId: 1 })
    act(() => vi.advanceTimersByTime(2000))
    fireEvent.click(button)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('works with a held key, and a key repeat does not restart it', () => {
    const { onConfirm, button } = setup()
    fireEvent.keyDown(button, { key: ' ' })
    act(() => vi.advanceTimersByTime(1000))
    fireEvent.keyDown(button, { key: ' ', repeat: true })
    act(() => vi.advanceTimersByTime(500))
    expect(onConfirm).toHaveBeenCalledOnce()

    fireEvent.keyDown(button, { key: 'Enter' })
    act(() => vi.advanceTimersByTime(700))
    fireEvent.keyUp(button, { key: 'Enter' })
    act(() => vi.advanceTimersByTime(2000))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
