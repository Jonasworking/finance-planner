import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MotionFeatures } from '@/test/ui'
import { SwipeRow } from './SwipeRow'

/*
 * Regression: browsers fire a `click` on the element under the pointer after a drag ends. Without
 * SwipeRow swallowing it, a swipe-delete also "tapped" the row – the edit sheet opened (empty,
 * for the expense that had just been deleted) and its overlay covered the undo toast.
 */

const frame = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)))

/** A real pointer drag as motion sees it: down on the row, moves and up on the window. */
async function swipeLeft(target: HTMLElement, distance: number) {
  const at = (clientX: number) => ({
    clientX,
    clientY: 20,
    pointerId: 1,
    isPrimary: true,
    button: 0,
  })
  fireEvent.pointerDown(target, { ...at(300), buttons: 1 })
  await frame()
  for (let step = 1; step <= 6; step++) {
    fireEvent.pointerMove(window, { ...at(300 - (distance / 6) * step), buttons: 1 })
    await frame()
  }
  fireEvent.pointerUp(window, at(300 - distance))
  // What the browser does next, because pointerdown and pointerup hit the same element:
  fireEvent.click(target, { detail: 1 })
  await frame()
}

function setup() {
  const onOpen = vi.fn()
  const onDelete = vi.fn()
  render(
    <MotionFeatures>
      <SwipeRow onDelete={onDelete} deleteLabel="Kaffee löschen">
        <button type="button" onClick={onOpen}>
          Kaffee
        </button>
      </SwipeRow>
    </MotionFeatures>,
  )
  const row = screen.getByRole('button', { name: 'Kaffee' })
  const offset = () => row.parentElement!.style.transform
  return { onOpen, onDelete, row, offset }
}

describe('SwipeRow', () => {
  it('lets a plain tap through to the row', () => {
    const { onOpen, onDelete, row } = setup()
    fireEvent.click(row, { detail: 1 })
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes on a long swipe and swallows the click that follows the drag', async () => {
    const { onOpen, onDelete, row } = setup()
    await swipeLeft(row, 240)

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce())
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('only reveals the delete button on a short swipe; the next tap closes it instead of opening the row', async () => {
    const { onOpen, onDelete, row, offset } = setup()
    await swipeLeft(row, 70)
    await waitFor(() => expect(offset()).toContain('translateX(-88px)'))
    expect(onOpen).not.toHaveBeenCalled()

    fireEvent.click(row, { detail: 1 }) // tap on the displaced row
    expect(onOpen).not.toHaveBeenCalled()
    await waitFor(() => expect(offset()).not.toContain('-88px'))
    await waitFor(() => expect(offset() === '' || offset() === 'none').toBe(true))

    fireEvent.click(row, { detail: 1 }) // back at rest: a tap is a tap again
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('offers the revealed delete button as the accessible path', async () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Kaffee löschen' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce())
  })
})
