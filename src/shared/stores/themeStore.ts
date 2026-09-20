import { create } from 'zustand'

export type ThemePreference = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

/** Mirrored by the inline script in index.html so the theme is set before first paint. */
const STORAGE_KEY = 'fp.theme'
const THEME_COLOR: Record<ResolvedTheme, string> = { dark: '#0B0C0F', light: '#F4F5F7' }

const systemQuery = () => window.matchMedia('(prefers-color-scheme: light)')

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference
  return systemQuery().matches ? 'light' : 'dark'
}

function applyToDocument(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
}

interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

export const useThemeStore = create<ThemeState>((set) => {
  const preference = readPreference()
  return {
    preference,
    resolved: resolve(preference),
    setPreference: (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // private mode: theme still applies for this session
      }
      const resolved = resolve(next)
      applyToDocument(resolved)
      set({ preference: next, resolved })
    },
  }
})

/** Follow OS changes while the preference is "system". Call once at app start. */
export function watchSystemTheme(): () => void {
  const query = systemQuery()
  const onChange = () => {
    const { preference } = useThemeStore.getState()
    if (preference !== 'system') return
    const resolved = resolve('system')
    applyToDocument(resolved)
    useThemeStore.setState({ resolved })
  }
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
