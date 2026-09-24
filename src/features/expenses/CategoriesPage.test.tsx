import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, loadCategories, repos } from '@/db'
import { MotionFeatures, stubDesktopViewport } from '@/test/ui'
import { CategoriesPage } from './CategoriesPage'

vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' }))

beforeAll(() => stubDesktopViewport()) // the category sheet is mounted (closed)

beforeEach(async () => {
  await repos.backup.wipeAll()
})

const names = async () => (await loadCategories(db)).active.map((category) => category.name)

describe('CategoriesPage', () => {
  it('sorts by keyboard: arrows on the handle move the category and say where it is now', async () => {
    const user = userEvent.setup()
    render(
      <MotionFeatures>
        <MemoryRouter>
          <CategoriesPage />
        </MemoryRouter>
      </MotionFeatures>,
    )
    const [first, second] = await names()
    const handle = await screen.findByRole('button', { name: `„${second}" verschieben` })
    expect(handle).toHaveAccessibleDescription('Mit Pfeil hoch und Pfeil runter verschieben.')

    handle.focus()
    await user.keyboard('{ArrowUp}')
    await waitFor(async () => expect((await names()).slice(0, 2)).toEqual([second, first]))
    expect(
      await screen.findByText(`„${second}" ist jetzt an Position 1 von 10.`),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `„${second}" verschieben` })).toHaveFocus()

    await user.keyboard('{ArrowUp}') // already first: nothing happens
    await user.keyboard('{ArrowDown}')
    await waitFor(async () => expect((await names()).slice(0, 2)).toEqual([first, second]))
  })
})
