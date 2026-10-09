import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/shared/lib/utils'
import { lastHeroCard, rememberHeroCard, type HeroCard } from '../heroCard'

export interface HeroSlide {
  id: HeroCard
  /** What the card is about – named by the switch below the cards. */
  label: string
  content: ReactNode
}

export interface HeroCarouselProps {
  slides: readonly HeroSlide[]
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The head of the home screen: cards to swipe through, the next one peeking in from the right.
 * Native scroll snap instead of a drag handler – the browser tells a horizontal swipe from
 * scrolling the page. From `lg` on there is room for all cards next to each other.
 */
export function HeroCarousel({ slides }: HeroCarouselProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      slides.findIndex((slide) => slide.id === lastHeroCard()),
    ),
  )
  // While a jump (switch, arrow key) is still scrolling, the positions in between are not news.
  const jumpingTo = useRef<number | null>(null)
  const frame = useRef(0)
  const steps = slides.length - 1

  const maxScroll = () => {
    const el = scroller.current
    return el ? el.scrollWidth - el.clientWidth : 0
  }

  // Start where this device left off – before the first paint, without any motion.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && active > 0 && steps > 0) el.scrollLeft = (maxScroll() * active) / steps
    // only on mount: afterwards the scroll position leads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const show = (index: number) => {
    setActive(index)
    const slide = slides[index]
    if (slide) rememberHeroCard(slide.id)
  }

  const onScroll = () => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const el = scroller.current
      const max = maxScroll()
      // No overflow (desktop: cards side by side) → nothing to track.
      if (!el || max <= 0 || steps <= 0) return
      const index = Math.round((el.scrollLeft / max) * steps)
      if (jumpingTo.current !== null) {
        if (index !== jumpingTo.current) return
        jumpingTo.current = null
      }
      if (index !== active) show(index)
    })
  }

  const jump = (index: number) => {
    const target = Math.min(steps, Math.max(0, index))
    if (target === active) return
    const el = scroller.current
    const max = maxScroll()
    if (el && max > 0 && steps > 0) {
      jumpingTo.current = target
      el.scrollTo({
        left: (max * target) / steps,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
    }
    show(target)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') jump(active + 1)
    else if (event.key === 'ArrowLeft') jump(active - 1)
    else return
    event.preventDefault()
  }

  const next = slides[(active + 1) % slides.length]

  return (
    <div role="group" aria-roledescription="Karussell" aria-label="Überblick">
      <div
        ref={scroller}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        // a finger on the cards takes over from a jump that is still under way
        onPointerDown={() => (jumpingTo.current = null)}
        className={cn(
          // reaches to the screen edges (the page has a 16 px margin) and leaves room above and
          // below: a scroll container cuts off whatever leaves it, the cards' shadow included
          '-mx-4 -my-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain p-4',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'lg:m-0 lg:grid lg:snap-none lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:gap-4 lg:overflow-visible lg:p-0',
        )}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            // 36 px less than the page column: 12 px gap, and 40 px of the next card up to the edge
            className={cn(
              'flex min-w-0 shrink-0 basis-[calc(100%-36px)] lg:basis-auto',
              index === steps && index > 0 ? 'snap-end' : 'snap-start',
            )}
          >
            {slide.content}
          </div>
        ))}
      </div>
      {next && slides.length > 1 ? (
        <button
          type="button"
          onClick={() => jump((active + 1) % slides.length)}
          aria-label={`Weiter zu ${next.label}`}
          className="mx-auto flex h-11 items-center gap-1.5 rounded-md px-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
        >
          {slides.map((slide, index) => (
            <span
              key={slide.id}
              aria-hidden
              className={cn(
                'h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none',
                index === active ? 'w-5 bg-saved' : 'w-1.5 bg-surface-3',
              )}
            />
          ))}
        </button>
      ) : null}
    </div>
  )
}
