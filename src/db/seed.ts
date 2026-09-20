import { weekStartOf } from '@/lib/dates'
import { categoryId } from '@/lib/ids'
import {
  PRIMARY_POT_ID,
  SETTINGS_ID,
  type AppData,
  type Category,
  type CategoryGroup,
  type ISODate,
} from '@/lib/types'

const CATEGORY_SEEDS: [
  slug: string,
  name: string,
  icon: string,
  color: string,
  group: CategoryGroup,
][] = [
  ['rent', 'Miete/Wohnen', 'House', 'cat-1', 'Fixkosten'],
  ['groceries', 'Lebensmittel', 'ShoppingBasket', 'cat-7', 'Variabel'],
  ['eating-out', 'Essen gehen', 'Utensils', 'cat-6', 'Freizeit'],
  ['transport', 'Transport', 'Bus', 'cat-5', 'Variabel'],
  ['phone', 'Handy/Internet', 'Smartphone', 'cat-2', 'Fixkosten'],
  ['fun', 'Freizeit', 'PartyPopper', 'cat-3', 'Freizeit'],
  ['travel', 'Reisen', 'Plane', 'cat-9', 'Reisen'],
  ['shopping', 'Shopping', 'ShoppingBag', 'cat-4', 'Variabel'],
  ['health', 'Gesundheit', 'HeartPulse', 'cat-8', 'Sonstiges'],
  ['other', 'Sonstiges', 'Ellipsis', 'cat-10', 'Sonstiges'],
]

export const DEFAULT_WEEKLY_INCOME_CENTS = 200_000
export const DEFAULT_TOTAL_LIMIT_CENTS = 40_000

type Seed = Pick<AppData, 'categories' | 'pots' | 'budgets' | 'settings'>

/**
 * First-run data. All ids are deterministic, so two devices seed identical rows (no duplicate
 * "Nur gespart" after a future sync). The first budget row makes sure every week can be resolved.
 */
export function buildSeed(now: number, today: ISODate): Seed {
  const base = { createdAt: now, updatedAt: now, deletedAt: null }

  const categories: Category[] = CATEGORY_SEEDS.map(([slug, name, icon, color, group], index) => ({
    ...base,
    id: categoryId(slug),
    name,
    icon,
    color,
    group,
    defaultWeeklyLimitCents: null,
    sortOrder: index,
    archived: false,
  }))

  return {
    categories,
    pots: [
      {
        ...base,
        id: PRIMARY_POT_ID,
        name: 'Nur gespart',
        targetCents: null,
        deadline: null,
        color: 'saved',
        icon: 'PiggyBank',
        sortOrder: 0,
        archived: false,
      },
    ],
    budgets: [
      {
        ...base,
        id: weekStartOf(today),
        totalLimitCents: DEFAULT_TOTAL_LIMIT_CENTS,
        categoryLimits: {},
      },
    ],
    settings: [
      {
        id: SETTINGS_ID,
        currency: 'AUD',
        eurRate: null,
        eurRateUpdatedAt: null,
        showEur: false,
        theme: 'dark',
        defaultWeeklyIncomeCents: DEFAULT_WEEKLY_INCOME_CENTS,
        trackingSince: today,
        lastBackupAt: null,
        installHintDismissedAt: null,
        onboardingDone: false,
        updatedAt: now,
      },
    ],
  }
}
