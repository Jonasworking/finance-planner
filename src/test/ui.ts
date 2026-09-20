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
