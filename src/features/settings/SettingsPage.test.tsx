import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, loadAppData, repos } from '@/db'
import { buildBackup } from '@/lib/backup'
import { useDeviceStore } from '@/shared/stores/deviceStore'
import { stubDesktopViewport } from '@/test/ui'
import { reloadWith } from './importFlags'
import { SettingsPage } from './SettingsPage'

const TODAY = '2026-09-23'
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))
const save = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/saveFile', () => ({ saveFile: save }))
// An import, its undo and a wipe end in a page reload – jsdom cannot reload.
vi.mock('./importFlags', () => ({ reloadWith: vi.fn(), takeAfterReload: () => null }))

beforeAll(() => stubDesktopViewport())

beforeEach(async () => {
  vi.clearAllMocks()
  save.mockResolvedValue('downloaded')
  await repos.backup.wipeAll()
  await repos.onboarding.complete(
    {
      defaultWeeklyIncomeCents: 200_000,
      totalLimitCents: 40_000,
      openingBalanceCents: 0,
      trackingSince: '2026-09-14',
    },
    TODAY,
  )
  act(() => useDeviceStore.setState({ standalone: false, ios: false, storage: 'persisted' }))
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )

const addExpense = () =>
  repos.expenses.add({ date: '2026-09-22', amountCents: 4_500, categoryId: 'cat:groceries' })

describe('SettingsPage – backup', () => {
  it('saves a backup file and remembers it; a cancelled share sheet does not count', async () => {
    await addExpense()
    const user = userEvent.setup()
    renderPage()

    expect(
      await screen.findByText(/Noch kein Backup gespeichert\. Deine Daten liegen nur/),
    ).toBeInTheDocument()
    const button = await screen.findByRole('button', { name: 'Backup speichern' })
    await waitFor(() => expect(button).toBeEnabled())

    save.mockResolvedValueOnce('cancelled')
    await user.click(button)
    expect(save).toHaveBeenCalledOnce()
    expect((await repos.settings.get()).lastBackupAt).toBeNull()

    await user.click(button)
    const [file] = save.mock.calls[1]! as [File]
    expect(file.name).toBe(`finanzplaner-backup-${TODAY}.json`)
    const saved = JSON.parse(await file.text())
    expect(saved).toMatchObject({
      app: 'finance-planner',
      data: { expenses: [{ amountCents: 4_500 }] },
    })
    await waitFor(async () => expect((await repos.settings.get()).lastBackupAt).not.toBeNull())
    expect(toast.success).toHaveBeenCalledWith('Backup gespeichert', expect.anything())
    expect(await screen.findByText('Letztes Backup: heute.')).toBeInTheDocument()
    // the checklist ticks its fourth point
    expect(await screen.findByText('Backup ausprobiert')).toBeInTheDocument()
  })

  it('exports the expenses as CSV', async () => {
    await addExpense()
    const user = userEvent.setup()
    renderPage()
    const button = await screen.findByRole('button', { name: 'CSV exportieren' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    const [file] = save.mock.calls[0]! as [File]
    expect(file.name).toBe(`finanzplaner-ausgaben-${TODAY}.csv`)
    expect(await file.text()).toContain('2026-09-22;45,00;Lebensmittel')
  })

  it('shows what a backup holds, replaces everything on "Einspielen" and offers the undo', async () => {
    const other = buildBackup(await loadAppData(db), 1_790_000_000_000)
    await addExpense() // the current state has one expense more than the file
    const user = userEvent.setup()
    const { unmount } = renderPage()

    const file = new File([JSON.stringify(other)], 'alt.json', { type: 'application/json' })
    await user.upload(await screen.findByLabelText('Backup-Datei wählen'), file)
    const sheet = await screen.findByRole('dialog', { name: 'Backup einspielen' })
    expect(within(sheet).getByText('Ausgaben').nextSibling).toHaveTextContent('0')
    expect(within(sheet).getByText(/Ersetzt/)).toHaveTextContent(
      'Ersetzt alle Daten auf diesem Gerät',
    )

    await user.click(within(sheet).getByRole('button', { name: 'Einspielen' }))
    await waitFor(() => expect(reloadWith).toHaveBeenCalledWith('imported'))
    expect(await db.expenses.count()).toBe(0)

    // after the reload: the safety copy can be put back
    unmount()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Import rückgängig' }))
    await waitFor(() => expect(reloadWith).toHaveBeenCalledWith('import-undone'))
    expect(await db.expenses.count()).toBe(1)
  })

  it('refuses a file that is not a backup, without touching the data', async () => {
    await addExpense()
    const user = userEvent.setup()
    renderPage()
    const junk = new File(['{"hello":"world"}'], 'junk.json', { type: 'application/json' })
    await user.upload(await screen.findByLabelText('Backup-Datei wählen'), junk)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Die Datei ist kein Finanzplaner-Backup.'),
    )
    const broken = new File(['not json'], 'broken.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Backup-Datei wählen'), broken)
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await db.expenses.count()).toBe(1)
  })
})

describe('SettingsPage – data', () => {
  it('checks the books', async () => {
    await addExpense()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Daten prüfen' }))
    expect(await screen.findByText(/Alles stimmt – \d+ Einträge geprüft\./)).toBeInTheDocument()
  })

  it('deletes everything only after holding the button, and forgets the device log too', async () => {
    await addExpense()
    localStorage.setItem('fp.theme', 'light')
    localStorage.setItem('fp.budgetWarnings', '["x"]')
    localStorage.setItem('fp.insightsDismissed', '["y"]')
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Alle Daten löschen' }))
    const sheet = await screen.findByRole('dialog', { name: 'Alle Daten löschen' })
    const hold = within(sheet).getByRole('button', { name: 'Gedrückt halten zum Löschen' })
    await user.click(hold) // a tap does nothing
    expect(await db.expenses.count()).toBe(1)

    fireEvent.pointerDown(hold, { pointerId: 1 })
    await waitFor(() => expect(reloadWith).toHaveBeenCalledWith('wiped'), { timeout: 3000 })
    expect(await db.expenses.count()).toBe(0)
    expect(localStorage.getItem('fp.theme')).toBe('light')
    expect(localStorage.getItem('fp.budgetWarnings')).toBeNull()
    expect(localStorage.getItem('fp.insightsDismissed')).toBeNull()
    localStorage.removeItem('fp.theme')
  })

  it('changes the standard weekly income', async () => {
    const user = userEvent.setup()
    renderPage()
    const input = await screen.findByLabelText('Standard-Einkommen pro Woche')
    await user.clear(input)
    await user.type(input, '1850')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(async () =>
      expect((await repos.settings.get()).defaultWeeklyIncomeCents).toBe(185_000),
    )
  })
})
