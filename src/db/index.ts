import { createRepos } from './repos'
import { FinanceDB } from './schema'

/** The app's database and its write API. Reads go through `useLiveQuery(() => db.…)`. */
export const db = new FinanceDB()
export const repos = createRepos(db)

export { DomainError, type DomainErrorCode } from './errors'
export {
  DASHBOARD_WEEKS,
  loadAppData,
  loadCategories,
  loadCloseWeek,
  loadDashboard,
  loadExpenseFormData,
  loadExpensesOfWeek,
  loadRecurring,
} from './queries'
export { createRepos, type Repos } from './repos'
export { FinanceDB } from './schema'
