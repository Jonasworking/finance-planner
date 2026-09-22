import { describe, expect, it } from 'vitest'
import { makeTask, NOW } from '@/test/fixtures'
import {
  describeDone,
  describeDue,
  dueState,
  isOverdue,
  sortTasks,
  splitTasks,
  tasksForDashboard,
} from './tasks'

const TODAY = '2026-09-23' // Wednesday

describe('dueState / isOverdue', () => {
  it('classifies a due date relative to today', () => {
    expect(dueState(null, TODAY)).toBe('none')
    expect(dueState('2026-09-22', TODAY)).toBe('overdue')
    expect(dueState('2026-09-23', TODAY)).toBe('today')
    expect(dueState('2026-09-24', TODAY)).toBe('soon')
    expect(dueState('2026-09-29', TODAY)).toBe('soon') // 6 days
    expect(dueState('2026-09-30', TODAY)).toBe('later') // 7 days
  })

  it('only an open task is overdue', () => {
    expect(isOverdue(makeTask({ dueDate: '2026-09-01' }), TODAY)).toBe(true)
    expect(isOverdue(makeTask({ dueDate: '2026-09-01', done: true, doneAt: NOW }), TODAY)).toBe(
      false,
    )
    expect(isOverdue(makeTask({ dueDate: TODAY }), TODAY)).toBe(false)
    expect(isOverdue(makeTask({ dueDate: null }), TODAY)).toBe(false)
  })
})

describe('sortTasks / splitTasks', () => {
  const overdue = makeTask({ id: 'overdue', dueDate: '2026-09-20', createdAt: NOW - 5 })
  const today = makeTask({ id: 'today', dueDate: TODAY, createdAt: NOW - 4 })
  const later = makeTask({ id: 'later', dueDate: '2026-10-10', createdAt: NOW - 3 })
  const undatedOld = makeTask({ id: 'undated-old', createdAt: NOW - 2 })
  const undatedNew = makeTask({ id: 'undated-new', createdAt: NOW - 1 })
  const doneEarly = makeTask({ id: 'done-early', done: true, doneAt: NOW - 100 })
  const doneLate = makeTask({
    id: 'done-late',
    done: true,
    doneAt: NOW - 10,
    dueDate: '2026-01-01',
  })
  const deleted = makeTask({ id: 'deleted', dueDate: '2026-01-01', deletedAt: NOW })

  const shuffled = [doneEarly, undatedOld, later, doneLate, undatedNew, today, overdue]

  it('leads with the soonest due date, undated tasks newest first, done tasks last', () => {
    expect(sortTasks(shuffled).map((task) => task.id)).toEqual([
      'overdue',
      'today',
      'later',
      'undated-new',
      'undated-old',
      'done-late',
      'done-early',
    ])
  })

  it('splits live rows into open and done and counts what is overdue', () => {
    const overview = splitTasks([...shuffled, deleted], TODAY)
    expect(overview.open.map((task) => task.id)).toEqual([
      'overdue',
      'today',
      'later',
      'undated-new',
      'undated-old',
    ])
    expect(overview.done.map((task) => task.id)).toEqual(['done-late', 'done-early'])
    expect(overview.overdueCount).toBe(1)
  })

  it('does not treat a task that was finished late as overdue', () => {
    expect(splitTasks([doneLate], TODAY).overdueCount).toBe(0)
  })

  it('is deterministic for equal due dates and even equal creation times', () => {
    const a = makeTask({ id: 'a', dueDate: TODAY, createdAt: NOW - 1 })
    const b = makeTask({ id: 'b', dueDate: TODAY, createdAt: NOW - 2 })
    expect(sortTasks([b, a]).map((task) => task.id)).toEqual(['a', 'b'])
    expect(sortTasks([a, b]).map((task) => task.id)).toEqual(['a', 'b'])
    const c = makeTask({ id: 'c', createdAt: NOW })
    const d = makeTask({ id: 'd', createdAt: NOW })
    expect(sortTasks([d, c]).map((task) => task.id)).toEqual(['c', 'd'])
  })
})

describe('tasksForDashboard', () => {
  it('returns the first open tasks with the counts the header needs', () => {
    const tasks = [
      makeTask({ id: 'later', dueDate: '2026-10-10' }),
      makeTask({ id: 'overdue', dueDate: '2026-09-01' }),
      makeTask({ id: 'undated' }),
      makeTask({ id: 'today', dueDate: TODAY }),
      makeTask({ id: 'done', done: true, doneAt: NOW }),
    ]
    const widget = tasksForDashboard(tasks, TODAY)
    expect(widget.tasks.map((task) => task.id)).toEqual(['overdue', 'today', 'later'])
    expect(widget.openCount).toBe(4)
    expect(widget.overdueCount).toBe(1)
  })

  it('is empty when every task is done – the card is then omitted', () => {
    const widget = tasksForDashboard([makeTask({ done: true, doneAt: NOW })], TODAY)
    expect(widget).toEqual({ tasks: [], openCount: 0, overdueCount: 0 })
  })

  it('respects the limit', () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => makeTask({ id: `t${n}` }))
    expect(tasksForDashboard(tasks, TODAY, 2).tasks).toHaveLength(2)
  })
})

describe('describeDue', () => {
  it('speaks relative for the coming week and absolute beyond it', () => {
    expect(describeDue(null, TODAY)).toBeNull()
    expect(describeDue(TODAY, TODAY)).toBe('Heute fällig')
    expect(describeDue('2026-09-24', TODAY)).toBe('Morgen fällig')
    expect(describeDue('2026-09-26', TODAY)).toBe('In 3 Tagen fällig')
    expect(describeDue('2026-09-29', TODAY)).toBe('In 6 Tagen fällig')
    expect(describeDue('2026-09-30', TODAY)).toBe('Fällig am Mi., 30. Sep.')
    expect(describeDue('2027-01-04', TODAY)).toBe('Fällig am Mo., 4. Jan. 2027')
  })

  it('names how long a task is overdue', () => {
    expect(describeDue('2026-09-22', TODAY)).toBe('Gestern fällig')
    expect(describeDue('2026-09-20', TODAY)).toBe('Seit 3 Tagen überfällig')
  })
})

describe('describeDone', () => {
  // NOW is 2026-09-20 11:00 in Sydney / 03:00 in Berlin – the same calendar day in both zones.
  const DONE_DAY = '2026-09-20'

  it('speaks relative for today and yesterday, absolute otherwise', () => {
    expect(describeDone(NOW, DONE_DAY)).toBe('Heute erledigt')
    expect(describeDone(NOW, '2026-09-21')).toBe('Gestern erledigt')
    expect(describeDone(NOW, TODAY)).toBe('Erledigt am So., 20. Sep.')
  })
})
