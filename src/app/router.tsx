import { createBrowserRouter, type RouteObject } from 'react-router'
import { BudgetPage } from '@/features/budget'
import { DashboardPage } from '@/features/dashboard'
import { CategoriesPage, ExpensesPage, RecurringPage } from '@/features/expenses'
import { PotDetailPage, PotsPage } from '@/features/pots'
import { SettingsPage } from '@/features/settings'
import { TasksPage } from '@/features/tasks'
import { AnalyticsRoute } from './routes/AnalyticsRoute'
import { WhatIfRoute } from './routes/WhatIfRoute'
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
      { path: 'analytics', Component: AnalyticsRoute },
      { path: 'budget', Component: BudgetPage },
      { path: 'tasks', Component: TasksPage },
      { path: 'what-if', Component: WhatIfRoute },
      { path: 'settings', Component: SettingsPage },
      { path: 'more', Component: MorePage },
      ...devRoutes,
      { path: '*', Component: DashboardPage },
    ],
  },
])
