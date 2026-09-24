import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/*
 * Calendar days are local 'YYYY-MM-DD' strings. These constructs silently switch to UTC
 * (Monday 08:00 in Sydney becomes Sunday) or drift across DST, so they are banned everywhere
 * except src/lib/dates.ts, which wraps date-fns.
 */
const dateTraps = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length>0]",
    message: 'Do not construct Dates from values here – use the helpers in src/lib/dates.ts.',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='parse']",
    message: 'Date.parse treats date-only strings as UTC – use src/lib/dates.ts.',
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(slice|split|substring|substr)$/][callee.object.callee.property.name='toISOString']",
    message: 'toISOString() is UTC – use toISODate() from src/lib/dates.ts for calendar days.',
  },
]

/* src/lib is pure: the current time is always passed in as `today` / `now`. */
const impureClock = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'src/lib is pure – pass `today`/`now` in as a parameter.',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'src/lib is pure – pass `now` in as a parameter.',
  },
]

/*
 * The bare "cn" merger does not know our custom font sizes (text-h2, text-label, …) and would
 * drop them as conflicting colors. Everything imports the configured `cn` from
 * '@/shared/lib/utils'; after `shadcn add`, run `npm run ui:fix-imports`.
 */
const bareCn = {
  name: 'cn',
  message: "Import cn from '@/shared/lib/utils' (run `npm run ui:fix-imports` after shadcn add).",
}

/*
 * Recharts weighs ~100 KB gzip. It is imported only in a feature's `charts/` folder, which that
 * screen loads lazily – an import anywhere else would silently pull it into the start chunk.
 */
const rechartsOutsideCharts = {
  group: ['recharts', 'recharts/*'],
  message: 'Import Recharts only in src/features/<name>/charts (lazy chunk).',
}

/*
 * `motion.*` bundles every animation feature into the start chunk. Components use `m.*`; the
 * features come lazily through `LazyMotion` (app/providers).
 */
const fullMotion = {
  name: 'motion/react',
  importNames: ['motion'],
  message: "Use `m` from 'motion/react' – the features load lazily via LazyMotion (app/providers).",
}

// Folder-specific configs replace (not merge) the rule, so each one carries the shared bans too.
const restrictImports = (patterns = [], { allowRecharts = false } = {}) => [
  'error',
  { paths: [bareCn, fullMotion], patterns: allowRecharts ? patterns : [...patterns, rechartsOutsideCharts] },
]

const featureRules = [
  {
    group: ['@/features/*/*'],
    message:
      'Import other features via their index.ts only (use relative imports inside a feature).',
  },
  {
    group: ['@/app/*'],
    message: 'Features must not depend on the app shell.',
  },
]

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-restricted-syntax': ['error', ...dateTraps],
      'no-restricted-imports': restrictImports(),
    },
  },

  // --- Layer rules (see CLAUDE.md → Architektur) ---
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports([
        {
          group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'react-router', 'react-router/*'],
          message: 'src/lib is framework-free: pure functions only.',
        },
        {
          group: ['dexie', 'dexie-react-hooks', 'zustand', 'zustand/*'],
          message: 'src/lib must not touch storage or state.',
        },
        {
          group: ['@/db', '@/db/*', '@/features/*', '@/shared/*', '@/app/*'],
          message: 'src/lib may only import from src/lib, date-fns and zod.',
        },
      ]),
      'no-restricted-syntax': ['error', ...dateTraps, ...impureClock],
    },
  },
  {
    // The one place that is allowed to build Date objects (from parts, via date-fns).
    files: ['src/lib/dates.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...impureClock],
    },
  },
  {
    files: ['src/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports([
        {
          group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'react-router', 'react-router/*'],
          message: 'src/db is UI-free.',
        },
        {
          group: ['@/features/*', '@/shared/*', '@/app/*'],
          message: 'src/db may only import from src/lib.',
        },
      ]),
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports([
        {
          group: ['@/features/*', '@/app/*'],
          message: 'src/shared must not depend on features or the app shell.',
        },
      ]),
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(featureRules),
    },
  },
  {
    files: ['src/features/*/charts/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(featureRules, { allowRecharts: true }),
    },
  },

  // Tests build fixtures and fake clocks, so they may construct Dates directly.
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // Generated shadcn/ui code: exports variants next to components by design.
  {
    files: ['src/shared/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
