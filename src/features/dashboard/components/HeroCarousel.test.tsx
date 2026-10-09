import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HeroCarousel } from './HeroCarousel'

const SLIDES = [
  { id: 'savings', label: 'Gesamt gespart', content: <a href="/pots">Karte eins</a> },
  { id: 'week', label: 'Diese Woche', content: <a href="/budget">Karte zwei</a> },
] as const

// jsdom has no layout: a 358 px row whose two cards overflow by 266 px, like on a phone.
const MAX_SCROLL = 266
let scrollTo: ReturnType<typeof vi.fn>
let reducedMotion = false

beforeEach(() => {
  localStorage.clear()
  reducedMotion = false
  scrollTo = vi.fn()
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(358 + MAX_SCROLL)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(358)
  HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reducedMotion && query.includes('reduce') })),
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const renderCarousel = () => {
  render(<HeroCarousel slides={SLIDES} />)
  const scroller = screen.getByText('Karte eins').closest('.snap-x') as HTMLDivElement
  return scroller
}
/** What a swipe leaves behind: a new scroll position, noticed on the next frame. */
const scrollBy = async (scroller: HTMLDivElement, left: number) => {
  scroller.scrollLeft = left
  fireEvent.scroll(scroller)
  await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
}
const nextButton = () => screen.getByRole('button', { name: /^Weiter zu/ })

describe('HeroCarousel', () => {
  it('starts with the savings card', () => {
    const scroller = renderCarousel()
    expect(nextButton()).toHaveAccessibleName('Weiter zu Diese Woche')
    expect(scroller.scrollLeft).toBe(0)
  })

  it('follows a swipe and remembers the card for the next visit', async () => {
    const scroller = renderCarousel()
    await scrollBy(scroller, 100) // not even half way
    expect(nextButton()).toHaveAccessibleName('Weiter zu Diese Woche')
    await scrollBy(scroller, MAX_SCROLL)
    expect(nextButton()).toHaveAccessibleName('Weiter zu Gesamt gespart')
    expect(localStorage.getItem('fp.homeHero')).toBe('week')
  })

  it('opens on the card shown last, already scrolled there', () => {
    localStorage.setItem('fp.homeHero', 'week')
    const scroller = renderCarousel()
    expect(nextButton()).toHaveAccessibleName('Weiter zu Gesamt gespart')
    expect(scroller.scrollLeft).toBe(MAX_SCROLL)
    expect(scrollTo).not.toHaveBeenCalled() // no animation on the way in
  })

  it('switches with the button below the cards, there and back', () => {
    renderCarousel()
    fireEvent.click(nextButton())
    expect(scrollTo).toHaveBeenLastCalledWith({ left: MAX_SCROLL, behavior: 'smooth' })
    expect(nextButton()).toHaveAccessibleName('Weiter zu Gesamt gespart')
    fireEvent.click(nextButton())
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' })
    expect(localStorage.getItem('fp.homeHero')).toBe('savings')
  })

  it('does not flicker back while a jump is still scrolling', async () => {
    const scroller = renderCarousel()
    fireEvent.click(nextButton())
    await scrollBy(scroller, 40) // the smooth scroll has only just started
    expect(nextButton()).toHaveAccessibleName('Weiter zu Gesamt gespart')
    await scrollBy(scroller, MAX_SCROLL)
    // arrived – from here on the scroll position leads again
    await scrollBy(scroller, 0)
    expect(nextButton()).toHaveAccessibleName('Weiter zu Diese Woche')
  })

  it('moves with the arrow keys and stops at both ends', () => {
    renderCarousel()
    const card = screen.getByText('Karte eins')
    fireEvent.keyDown(card, { key: 'ArrowLeft' })
    expect(scrollTo).not.toHaveBeenCalled()
    fireEvent.keyDown(card, { key: 'ArrowRight' })
    expect(nextButton()).toHaveAccessibleName('Weiter zu Gesamt gespart')
    fireEvent.keyDown(card, { key: 'ArrowRight' })
    expect(scrollTo).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(card, { key: 'ArrowLeft' })
    expect(nextButton()).toHaveAccessibleName('Weiter zu Diese Woche')
  })

  it('jumps without animation when motion is reduced', () => {
    reducedMotion = true
    renderCarousel()
    fireEvent.click(nextButton())
    expect(scrollTo).toHaveBeenLastCalledWith({ left: MAX_SCROLL, behavior: 'auto' })
  })

  it('leaves the remembered card alone where nothing scrolls (cards side by side)', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(358)
    localStorage.setItem('fp.homeHero', 'week')
    const scroller = renderCarousel()
    await scrollBy(scroller, 0)
    expect(localStorage.getItem('fp.homeHero')).toBe('week')
  })
})
