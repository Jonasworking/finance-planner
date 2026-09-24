import { domMax, LazyMotion } from 'motion/react'
import { createElement, type ReactNode } from 'react'
/** Helpers for component tests that render sheets and pages. */

/**
 * jsdom has no matchMedia. "Desktop" makes `ResponsiveSheet` render the Radix dialog, which works
 * in jsdom (the mobile drawer needs real layout).
 */
export function stubDesktopViewport(): void {
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

/** jsdom has no ResizeObserver; Radix sliders measure their thumb with one. */
export function stubResizeObserver(): void {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

/**
 * The app loads motion's features lazily (`LazyMotion` in app/providers); `m.*` components
 * rendered without them neither animate nor drag. Wrap gesture tests in this to get them at once.
 */
export function MotionFeatures({ children }: { children: ReactNode }) {
  return createElement(LazyMotion, { features: domMax }, children)
}
