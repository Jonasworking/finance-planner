import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, repos } from '@/db'
import { PRIMARY_POT_ID } from '@/lib/types'
import { OnboardingFlow } from './OnboardingFlow'

vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-09-23' })) // Wednesday

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const defaults = { defaultWeeklyIncomeCents: 200_000, totalLimitCents: 40_000 }

describe('OnboardingFlow', () => {
  it('collects income, budget, opening balance and the tracking start, then saves everything', async () => {
    const user = userEvent.setup()
    render(<OnboardingFlow defaults={defaults} />)

    await user.click(screen.getByRole('button', { name: 'Los geht’s' }))

    const income = await screen.findByLabelText('Einkommen pro Woche')
    expect(income).toHaveValue('2000')
    await user.clear(income)
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled()
    await user.type(income, '2100')
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    expect(await screen.findByLabelText('Wochenbudget')).toHaveValue('400')
    await user.click(screen.getByRole('button', { name: 'A$500' }))
    expect(await screen.findByLabelText('Wochenbudget')).toHaveValue('500')
    expect(screen.getByText(/pro Woche zum Sparen/)).toHaveTextContent('A$1.600')
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    await user.type(await screen.findByLabelText('Startguthaben'), '8500')
    await user.click(screen.getByRole('radio', { name: /Ab letzter Woche/ }))
    await user.click(screen.getByRole('button', { name: 'Fertig' }))

    await waitFor(async () => expect((await repos.settings.get()).onboardingDone).toBe(true))
    expect(await repos.settings.get()).toMatchObject({
      defaultWeeklyIncomeCents: 210_000,
      trackingSince: '2026-09-14',
    })
    expect(await db.budgets.get('2026-09-14')).toMatchObject({ totalLimitCents: 50_000 })
    expect(await db.potTransactions.get('opening-balance')).toMatchObject({
      potId: PRIMARY_POT_ID,
      amountCents: 850_000,
      date: '2026-09-14',
    })
  })

  it('works with the defaults: start at zero, from this week, and lets you go back', async () => {
    const user = userEvent.setup()
    render(<OnboardingFlow defaults={defaults} />)

    await user.click(screen.getByRole('button', { name: 'Los geht’s' }))
    await user.click(await screen.findByRole('button', { name: 'Weiter' }))
    await screen.findByLabelText('Wochenbudget')
    await user.click(screen.getByRole('button', { name: 'Zurück' }))
    expect(await screen.findByLabelText('Einkommen pro Woche')).toHaveValue('2000')
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await user.click(await screen.findByRole('button', { name: 'Weiter' }))
    await user.click(await screen.findByRole('button', { name: 'Fertig' }))

    await waitFor(async () => expect((await repos.settings.get()).onboardingDone).toBe(true))
    expect((await repos.settings.get()).trackingSince).toBe('2026-09-21')
    expect(await db.potTransactions.count()).toBe(0)
  })

  it('accepts a custom start date in the past', async () => {
    const user = userEvent.setup()
    render(<OnboardingFlow defaults={defaults} />)
    await user.click(screen.getByRole('button', { name: 'Los geht’s' }))
    await user.click(await screen.findByRole('button', { name: 'Weiter' }))
    await user.click(await screen.findByRole('button', { name: 'Weiter' }))

    await user.click(await screen.findByRole('radio', { name: /Eigenes Datum/ }))
    // The field ignores an empty value on purpose, so set the date in one change event.
    fireEvent.change(screen.getByLabelText('Tracking-Beginn', { selector: 'input' }), {
      target: { value: '2026-08-05' },
    })
    await user.click(screen.getByRole('button', { name: 'Fertig' }))

    await waitFor(async () => expect((await repos.settings.get()).trackingSince).toBe('2026-08-05'))
    expect(await db.budgets.get('2026-08-03')).toBeDefined() // limit applies from that week on
  })
})
