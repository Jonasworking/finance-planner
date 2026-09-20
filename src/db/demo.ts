import { addDaysISO, addWeeksISO, daysBetween, weekStartOf } from '@/lib/dates'
import { categoryId } from '@/lib/ids'
import { PRIMARY_POT_ID, type ISODate } from '@/lib/types'
import type { Repos } from './repos'

/** Small deterministic PRNG (mulberry32) – the same demo data on every run. */
function createRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fills an EMPTY database with `weeks` finished weeks plus the running one, entirely through the
 * repos – so every invariant holds and `checkLedgerInvariants` stays clean. Dev builds and tests
 * only. Contains on purpose: a week without work (minus week), weeks over budget, a budget change,
 * transfers, a pot-funded flight and recurring rent.
 */
export async function seedDemoData(repos: Repos, today: ISODate, weeks = 12): Promise<void> {
  const random = createRandom(20260920)
  const dollars = (min: number, max: number) => Math.round((min + random() * (max - min)) * 20) * 5
  const chance = (probability: number) => random() < probability

  const currentWeek = weekStartOf(today)
  const firstWeek = addWeeksISO(currentWeek, -weeks)

  await repos.settings.update({ trackingSince: firstWeek, onboardingDone: true, eurRate: 0.6 })
  await repos.budgets.set(firstWeek, { totalLimitCents: 40_000 })
  await repos.pots.deposit(PRIMARY_POT_ID, 850_000, firstWeek, 'Startguthaben')

  const trip = await repos.pots.create({
    name: 'Reisen',
    targetCents: 300_000,
    deadline: addWeeksISO(currentWeek, 20),
    color: 'cat-9',
    icon: 'Plane',
  })
  await repos.pots.create({
    name: 'Notgroschen',
    targetCents: 500_000,
    color: 'cat-5',
    icon: 'ShieldCheck',
  })

  await repos.recurring.create({
    title: 'Miete',
    amountCents: 18_000,
    categoryId: categoryId('rent'),
    interval: 'weekly',
    anchorDate: addDaysISO(firstWeek, 4), // Fridays
  })
  await repos.recurring.create({
    title: 'Handyvertrag',
    amountCents: 3_000,
    categoryId: categoryId('phone'),
    interval: 'monthly',
    anchorDate: addDaysISO(firstWeek, 2),
  })
  await repos.recurring.materialize(today)

  const spend =
    (weekStart: ISODate, lastDay: number) => async (slug: string, cents: number, note?: string) => {
      const date = addDaysISO(weekStart, Math.floor(random() * (lastDay + 1)))
      await repos.expenses.add({ date, amountCents: cents, categoryId: categoryId(slug), note })
    }

  async function fillWeek(weekStart: ISODate, lastDay: number) {
    const add = spend(weekStart, lastDay)
    const share = (lastDay + 1) / 7 // the running week only gets part of a week's spending
    for (let index = 0; index < Math.round(2 * share) + (chance(0.5) ? 1 : 0); index++) {
      await add('groceries', dollars(28, 65), chance(0.5) ? 'Woolworths' : 'Coles')
    }
    if (chance(0.8 * share)) await add('eating-out', dollars(14, 42))
    if (chance(0.4 * share)) await add('eating-out', dollars(6, 12), 'Kaffee')
    for (let index = 0; index < Math.round(2 * share); index++)
      await add('transport', dollars(6, 16))
    if (chance(0.6 * share)) await add('fun', dollars(12, 48))
    if (chance(0.2 * share)) await add('shopping', dollars(25, 90))
    if (chance(0.1 * share)) await add('health', dollars(15, 60), 'Apotheke')
  }

  for (let index = 0; index < weeks; index++) {
    const weekStart = addWeeksISO(firstWeek, index)
    if (index === 6) await repos.budgets.set(weekStart, { totalLimitCents: 45_000 })
    await fillWeek(weekStart, 6)

    if (index === 8) {
      await repos.expenses.add({
        date: addDaysISO(weekStart, 2),
        amountCents: 65_000,
        categoryId: categoryId('travel'),
        note: 'Flug nach Cairns',
        fundedByPotId: trip.id,
      })
    }

    const noWork = index === 5
    await repos.weeks.close(weekStart, {
      incomeCents: noWork ? 0 : dollars(1_800, 2_200),
      note: noWork ? 'Keine Schichten' : undefined,
    })

    if (index % 2 === 0) {
      await repos.pots.transfer({
        fromPotId: PRIMARY_POT_ID,
        toPotId: trip.id,
        amountCents: 30_000,
        date: addDaysISO(weekStart, 6),
        note: 'Reisekasse',
      })
    }
  }

  await fillWeek(currentWeek, daysBetween(currentWeek, today))

  await repos.tasks.add({
    title: 'Steuernummer (TFN) prüfen',
    category: 'Behörden',
    dueDate: addDaysISO(today, 5),
  })
  await repos.tasks.add({
    title: 'Super-Fonds zusammenlegen',
    category: 'Finanzen',
    dueDate: addDaysISO(today, -2),
  })
  await repos.tasks.add({
    title: 'Flug für Reise buchen',
    category: 'Sonstiges',
    linkedPotId: trip.id,
  })
}
