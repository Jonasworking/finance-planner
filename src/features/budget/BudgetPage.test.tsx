import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import { stubResizeObserver } from '@/test/ui'
import { BudgetPage } from './BudgetPage'

const TODAY = '2026-09-23' // Wednesday of the week starting 2026-09-21
const THIS_WEEK = '2026-09-21'
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' }))

beforeAll(stubResizeObserver)

beforeEach(async () => {
  await db.delete()
  await db.open()
  await repos.onboarding.complete(
    {
      defaultWeeklyIncomeCents: 200_000,
      totalLimitCents: 40_000,
      openingBalanceCents: 0,
      trackingSince: '2026-09-07',
    },
    '2026-09-09', // onboarded two weeks ago → that budget row belongs to the week of 09-07
  )
  // The seeded default row is dated by the real clock – keep only the one this test knows.
  await db.budgets.where('id').notEqual('2026-09-07').delete()
  await repos.expenses.add({ date: '2026-09-22', amountCents: 9_000, categoryId: 'cat:groceries' })
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <BudgetPage />
    </MemoryRouter>,
  )
const totalField = () => screen.findByRole('textbox', { name: 'Wochenbudget' })
const saveButton = () => screen.queryByRole('button', { name: 'Speichern' })

describe('BudgetPage', () => {
  it('shows the budget in force and what this week looks like against it', async () => {
    renderPage()
    expect(await totalField()).toHaveValue('400')
    expect(screen.getByText(/Diese Woche: A\$90,00 ausgegeben/)).toBeInTheDocument()
    expect(screen.getByText('A$310,00 übrig')).toBeInTheDocument()
    expect(
      screen.getByText(/das aktuelle gilt seit der Woche 7\.–13\. Sep\. 2026/),
    ).toBeInTheDocument()
    expect(screen.getByText('optional')).toBeInTheDocument() // no category limits yet
    expect(saveButton()).not.toBeInTheDocument() // nothing to save
  })

  it('writes a changed budget for this week only – older rows stay as they were', async () => {
    const user = userEvent.setup()
    renderPage()
    const before = await db.budgets.get('2026-09-07')

    await user.clear(await totalField())
    await user.type(await totalField(), '300')
    expect(screen.getByText('A$210,00 übrig')).toBeInTheDocument() // reacts before saving
    expect(await db.budgets.get(THIS_WEEK)).toBeUndefined()

    await user.click(saveButton()!)
    await waitFor(async () =>
      expect(await db.budgets.get(THIS_WEEK)).toMatchObject({ totalLimitCents: 30_000 }),
    )
    expect(await db.budgets.get('2026-09-07')).toEqual(before)
    await waitFor(() => expect(saveButton()).not.toBeInTheDocument())
    expect(await totalField()).toHaveValue('300')
  })

  it('sets category limits by typing or by slider and shows what is unallocated', async () => {
    const user = userEvent.setup()
    renderPage()
    const limitField = await screen.findByRole('textbox', { name: 'Limit Lebensmittel' })

    await user.type(limitField, '100')
    expect(screen.getByText('A$300,00 unverteilt')).toBeInTheDocument()
    expect(screen.getByText('A$10,00 übrig')).toHaveClass('text-warning') // 90 % of the limit

    const slider = screen.getByRole('slider', { name: 'Limit Lebensmittel' })
    slider.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}') // two A$5 steps
    expect(screen.getByRole('textbox', { name: 'Limit Lebensmittel' })).toHaveValue('110')
    expect(screen.getByText('A$290,00 unverteilt')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Limit Miete/Wohnen' }), '350')
    expect(screen.getByText('A$60,00 überbucht')).toHaveClass('text-warning')

    await user.click(saveButton()!)
    await waitFor(async () =>
      expect((await db.budgets.get(THIS_WEEK))?.categoryLimits).toEqual({
        'cat:groceries': 11_000,
        'cat:rent': 35_000,
      }),
    )
  })

  it('takes a limit away again and stores no entry for it', async () => {
    const user = userEvent.setup()
    await repos.budgets.set(TODAY, {
      totalLimitCents: 40_000,
      categoryLimits: { 'cat:groceries': 8_000 },
    })
    renderPage()
    const limitField = await screen.findByRole('textbox', { name: 'Limit Lebensmittel' })
    expect(limitField).toHaveValue('80')
    expect(screen.getByText('A$10,00 drüber')).toHaveClass('text-spent')

    await user.clear(limitField)
    await user.click(saveButton()!)
    await waitFor(async () => expect((await db.budgets.get(THIS_WEEK))?.categoryLimits).toEqual({}))
  })

  it('discards a draft and refuses to save an empty amount', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.clear(await totalField())
    expect(saveButton()).not.toBeInTheDocument() // empty is not a budget

    await user.type(await totalField(), '250')
    await user.click(screen.getByRole('button', { name: 'Verwerfen' }))
    expect(await totalField()).toHaveValue('400')
    expect(saveButton()).not.toBeInTheDocument()
    expect(await db.budgets.get(THIS_WEEK)).toBeUndefined()
  })
})
