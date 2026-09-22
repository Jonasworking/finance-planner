import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import { useUiStore } from '@/shared/stores/uiStore'
import { stubDesktopViewport } from '@/test/ui'
import { TasksPage } from './TasksPage'
import { TaskSheet } from './components/TaskSheet'

vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' })) // Wednesday
// The real toaster needs pointer capture, which jsdom lacks – capture the calls instead.
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

beforeAll(stubDesktopViewport)

beforeEach(async () => {
  vi.clearAllMocks()
  useUiStore.setState({ taskOpen: false, taskId: null })
  await db.delete()
  await db.open()
})

// The sheet is mounted once in the shell; the page only opens it.
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/tasks']}>
      <TasksPage />
      <TaskSheet />
    </MemoryRouter>,
  )

const lastUndo = () => {
  const [, options] = vi.mocked(toast).mock.calls.at(-1)!
  const action = options?.action as { label: string; onClick: () => void }
  expect(action.label).toBe('Rückgängig')
  return action.onClick
}

const openTitles = () =>
  screen
    .getAllByRole('checkbox', { name: /erledigen$/ })
    .map((box) => box.getAttribute('aria-label')?.replace(/^„(.*)" erledigen$/, '$1'))

describe('TasksPage', () => {
  it('explains itself while there are no tasks', async () => {
    renderPage()
    expect(await screen.findByText('Was steht an?')).toBeInTheDocument()
    expect(screen.getByText('Nichts offen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Task anlegen' })).toBeInTheDocument()
  })

  it('creates a task from the sheet with a due-date preset', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Neu' }))

    const dialog = await screen.findByRole('dialog', { name: 'Neuer Task' })
    expect(within(dialog).getByRole('button', { name: 'Task anlegen' })).toBeDisabled()
    // Only "Nur gespart" exists: nothing worth pointing at, so no pot row.
    expect(within(dialog).queryByRole('radiogroup', { name: 'Topf' })).not.toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Titel' }), 'TFN beantragen')
    await user.click(within(dialog).getByRole('button', { name: 'Morgen' }))
    expect(within(dialog).getByLabelText('Fällig am')).toHaveValue('2026-09-24')
    await user.click(within(dialog).getByRole('radio', { name: 'Behörden' }))
    await user.click(within(dialog).getByRole('button', { name: 'Task anlegen' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('TFN beantragen')).toBeInTheDocument()
    expect(screen.getByText('Morgen fällig')).toBeInTheDocument()
    expect(screen.getByText('Behörden')).toBeInTheDocument()
    expect(screen.getByText('1 offen')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('„TFN beantragen" angelegt')
    expect(await db.tasks.toArray()).toEqual([
      expect.objectContaining({ title: 'TFN beantragen', dueDate: '2026-09-24', done: false }),
    ])
  })

  it('leads with overdue tasks, marks them and counts them in the subtitle', async () => {
    await repos.tasks.add({ title: 'Irgendwann' })
    await repos.tasks.add({ title: 'Miete überweisen', dueDate: '2026-09-25' })
    await repos.tasks.add({ title: 'Steuer', dueDate: '2026-09-20' })
    renderPage()

    expect(await screen.findByText('3 offen · 1 überfällig')).toBeInTheDocument()
    expect(openTitles()).toEqual(['Steuer', 'Miete überweisen', 'Irgendwann'])
    expect(screen.getByText('Seit 3 Tagen überfällig')).toBeInTheDocument()
    expect(screen.getByText('In 2 Tagen fällig')).toBeInTheDocument()
  })

  it('shows a linked pot as a reference with its progress – nothing gets booked', async () => {
    const bali = await repos.pots.create({ name: 'Bali', targetCents: 300_000 })
    await repos.pots.deposit(bali.id, 100_000, '2026-09-22')
    await repos.tasks.add({ title: 'Flug buchen', linkedPotId: bali.id })
    renderPage()

    expect(await screen.findByText('Flug buchen')).toBeInTheDocument()
    const potLink = screen.getByRole('link', { name: 'Topf Bali' })
    expect(potLink).toHaveAttribute('href', `/pots/${encodeURIComponent(bali.id)}`)
    expect(within(potLink).getByText('A$1.000 von A$3.000')).toBeInTheDocument()
    expect(
      within(potLink).getByRole('progressbar', { name: 'Bali: Ziel erreicht zu' }),
    ).toHaveAttribute('aria-valuenow', '33')
    expect(await db.potTransactions.count()).toBe(1) // the deposit only
  })

  it('ticks a task off with undo, moves it to "Erledigt" and back', async () => {
    const user = userEvent.setup()
    const task = await repos.tasks.add({ title: 'Super prüfen' })
    renderPage()

    await user.click(await screen.findByRole('checkbox', { name: '„Super prüfen" erledigen' }))
    // The tick shows first (optimistic), the write follows a moment later.
    expect(screen.getByRole('checkbox', { name: '„Super prüfen" erledigen' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await waitFor(async () => expect((await db.tasks.get(task.id))?.done).toBe(true))
    expect(await screen.findByRole('checkbox', { name: '„Super prüfen" wieder öffnen' }))
    expect(screen.getByText('Alles erledigt')).toBeInTheDocument()
    // The repo stamps doneAt with the real clock, so only the shape of the label is fixed.
    expect(screen.getByText(/^(Heute|Gestern) erledigt$|^Erledigt am /)).toBeInTheDocument()
    expect(screen.getByText('Nichts offen')).toBeInTheDocument()

    expect(vi.mocked(toast).mock.calls.at(-1)?.[0]).toBe('„Super prüfen" erledigt')
    lastUndo()()
    await waitFor(async () => expect((await db.tasks.get(task.id))?.done).toBe(false))
    expect(await screen.findByRole('checkbox', { name: '„Super prüfen" erledigen' }))
    expect(screen.queryByText('Alles erledigt')).not.toBeInTheDocument()

    // Unticking from the "Erledigt" list writes at once.
    await user.click(screen.getByRole('checkbox', { name: '„Super prüfen" erledigen' }))
    await waitFor(async () => expect((await db.tasks.get(task.id))?.done).toBe(true))
    await user.click(await screen.findByRole('checkbox', { name: '„Super prüfen" wieder öffnen' }))
    await waitFor(async () => expect((await db.tasks.get(task.id))?.done).toBe(false))
  })

  it('edits a task and deletes it from the sheet with undo', async () => {
    const user = userEvent.setup()
    const task = await repos.tasks.add({ title: 'Super prüfen', dueDate: '2026-09-30' })
    renderPage()

    await user.click(await screen.findByText('Super prüfen')) // the row's title opens the sheet
    const dialog = await screen.findByRole('dialog', { name: 'Task bearbeiten' })
    const title = await within(dialog).findByRole('textbox', { name: 'Titel' })
    expect(title).toHaveValue('Super prüfen')
    await user.clear(title)
    await user.type(title, 'Super wechseln')
    await user.click(within(dialog).getByRole('button', { name: 'Fälligkeit entfernen' }))
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Super wechseln')).toBeInTheDocument()
    expect(screen.queryByText(/fällig/i)).not.toBeInTheDocument()

    await user.click(screen.getByText('Super wechseln'))
    await user.click(await screen.findByRole('button', { name: 'Task löschen' }))
    await waitFor(async () => expect((await db.tasks.get(task.id))?.deletedAt).not.toBeNull())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Was steht an?')).toBeInTheDocument()
    expect(vi.mocked(toast).mock.calls.at(-1)?.[0]).toBe('„Super wechseln" gelöscht')

    lastUndo()()
    await waitFor(async () => expect((await db.tasks.get(task.id))?.deletedAt).toBeNull())
    expect(await screen.findByText('Super wechseln')).toBeInTheDocument()
  })

  it('closes the sheet when its task disappears underneath it', async () => {
    const user = userEvent.setup()
    const task = await repos.tasks.add({ title: 'Kurzlebig' })
    renderPage()
    await user.click(await screen.findByText('Kurzlebig'))
    await screen.findByRole('dialog', { name: 'Task bearbeiten' })

    await repos.tasks.remove(task.id)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('offers pots in the form once there is one beyond "Nur gespart"', async () => {
    const user = userEvent.setup()
    const bali = await repos.pots.create({ name: 'Bali' })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Neu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Neuer Task' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Titel' }), 'Flug buchen')
    await user.click(within(dialog).getByRole('radio', { name: 'Bali' }))
    await user.click(within(dialog).getByRole('button', { name: 'Task anlegen' }))
    await waitFor(async () =>
      expect(await db.tasks.toArray()).toEqual([expect.objectContaining({ linkedPotId: bali.id })]),
    )
  })
})
