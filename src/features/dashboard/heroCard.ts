/*
 * Which card of the home screen's hero was shown last. Per device (localStorage): a preference
 * of this screen, not data – it is not part of the backup.
 */
const KEY = 'fp.homeHero'

export const HERO_CARDS = ['savings', 'week'] as const
export type HeroCard = (typeof HERO_CARDS)[number]

const isHeroCard = (value: unknown): value is HeroCard =>
  (HERO_CARDS as readonly unknown[]).includes(value)

/** The card to start with – the savings unless this device remembers another one. */
export function lastHeroCard(): HeroCard {
  try {
    const stored = localStorage.getItem(KEY)
    return isHeroCard(stored) ? stored : 'savings'
  } catch {
    return 'savings'
  }
}

export function rememberHeroCard(card: HeroCard): void {
  try {
    localStorage.setItem(KEY, card)
  } catch {
    // Storage unavailable: the hero starts with the savings next time – harmless.
  }
}
