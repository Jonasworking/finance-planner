import { createBrowserRouter, type RouteObject } from 'react-router'
import { DashboardPage } from '@/features/dashboard'
import { lazyPage } from './routes/lazyPage'
import { AppShell } from './shell/AppShell'
import { MorePage } from './shell/MorePage'

// Dev-only style guide; the dynamic import is dropped from production bundles.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/tokens',
        lazy: async () => ({ Component: (await import('./dev/TokensPage')).TokensPage }),
      },
    ]
  : []

/*
 * Only the home screen is in the start chunk. Every other screen loads on first visit – the
 * `pages` modules are the features' route entries (their index.ts holds what the shell needs).
 */
const ExpensesPage = lazyPage('Ausgaben', () =>
  import('@/features/expenses/pages').then((m) => m.ExpensesPage),
)
const CategoriesPage = lazyPage('Kategorien', () =>
  import('@/features/expenses/pages').then((m) => m.CategoriesPage),
)
const RecurringPage = lazyPage('Daueraufträge', () =>
  import('@/features/expenses/pages').then((m) => m.RecurringPage),
)
const PotsPage = lazyPage('Töpfe', () => import('@/features/pots/pages').then((m) => m.PotsPage))
const PotDetailPage = lazyPage('Topf', () =>
  import('@/features/pots/pages').then((m) => m.PotDetailPage),
)
const AnalyticsPage = lazyPage('Analyse', () =>
  import('@/features/analytics').then((m) => m.AnalyticsPage),
)
const BudgetPage = lazyPage('Budget', () =>
  import('@/features/budget/pages').then((m) => m.BudgetPage),
)
const TasksPage = lazyPage('Tasks', () => import('@/features/tasks/pages').then((m) => m.TasksPage))
const WhatIfPage = lazyPage('Was-wäre-wenn', () =>
  import('@/features/whatif').then((m) => m.WhatIfPage),
)
const SettingsPage = lazyPage('Einstellungen', () =>
  import('@/features/settings/pages').then((m) => m.SettingsPage),
)

export const router = createBrowserRouter([
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: DashboardPage },
      { path: 'expenses', Component: ExpensesPage },
      { path: 'categories', Component: CategoriesPage },
      { path: 'recurring', Component: RecurringPage },
      { path: 'pots', Component: PotsPage },
      { path: 'pots/:potId', Component: PotDetailPage },
      { path: 'analytics', Component: AnalyticsPage },
      { path: 'budget', Component: BudgetPage },
      { path: 'tasks', Component: TasksPage },
      { path: 'what-if', Component: WhatIfPage },
      { path: 'settings', Component: SettingsPage },
      { path: 'more', Component: MorePage },
      ...devRoutes,
      { path: '*', Component: DashboardPage },
    ],
  },
])
