/** Browser facts the setup screens need. Read at call time – they can change (installing). */

/** Running as an installed app (home screen, dock) rather than in a browser tab. */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}

/** iPhone/iPad – iPadOS reports itself as a Mac, but with touch. */
export function isIOS(): boolean {
  const { userAgent, maxTouchPoints } = navigator
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}
