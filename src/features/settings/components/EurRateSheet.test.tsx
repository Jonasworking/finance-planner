import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import { useUiStore } from '@/shared/stores/uiStore'
import { stubDesktopViewport } from '@/test/ui'
import { EurRateSheet } from './EurRateSheet'

vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

beforeAll(stubDesktopViewport)

beforeEach(async () => {
  await db.delete()
  await db.open()
  act(() => useUiStore.setState({ eurRateOpen: false }))
})

const open = (options?: { enableOnSave?: boolean }) =>
  act(() => useUiStore.getState().openEurRate(options))
const field = () => screen.findByRole('textbox', { name: 'EUR-Kurs' })
const saveButton = () => screen.getByRole('button', { name: 'Speichern' })

describe('EurRateSheet', () => {
  it('saves a typed rate and shows what it means', async () => {
    const user = userEvent.setup()
    render(<EurRateSheet />)
    open()

    expect(await field()).toHaveValue('')
    expect(saveButton()).toBeDisabled()

    await user.type(await field(), '0,61')
    // (the matcher normalizes the non-breaking space before the euro sign)
    expect(screen.getByText(/A\$1\.000,00 entsprechen 610,00\s€\./)).toBeInTheDocument()
    await user.click(saveButton())

    await waitFor(async () => expect((await repos.settings.get()).eurRate).toBe(0.61))
    // Editing the rate alone does not switch the EUR display on.
    expect((await repos.settings.get()).showEur).toBe(false)
    await waitFor(() => expect(useUiStore.getState().eurRateOpen).toBe(false))
  })

  it('switches EUR on as well when the currency switch asked for the rate', async () => {
    const user = userEvent.setup()
    render(<EurRateSheet />)
    open({ enableOnSave: true })

    await user.type(await field(), '0.6')
    await user.click(saveButton())
    await waitFor(async () =>
      expect(await repos.settings.get()).toMatchObject({ eurRate: 0.6, showEur: true }),
    )
  })

  it('pre-fills the stored rate and refuses nonsense', async () => {
    await repos.settings.update({ eurRate: 0.6075 })
    const user = userEvent.setup()
    render(<EurRateSheet />)
    open()

    expect(await field()).toHaveValue('0,6075')
    expect(screen.getByText(/Zuletzt geändert/)).toBeInTheDocument()

    await user.clear(await field())
    await user.type(await field(), '0,6,1')
    expect(await field()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Bitte einen Kurs wie 0,61 eingeben.')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    expect((await repos.settings.get()).eurRate).toBe(0.6075)
  })

  it('starts from the stored value again every time it opens', async () => {
    await repos.settings.update({ eurRate: 0.6 })
    const user = userEvent.setup()
    render(<EurRateSheet />)
    open()
    await user.clear(await field())
    await user.type(await field(), '0,99')
    act(() => useUiStore.getState().closeEurRate())
    open()
    await waitFor(async () => expect(await field()).toHaveValue('0,60'))
  })
})
