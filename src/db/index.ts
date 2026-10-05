import { createRepos } from './repos'
import { FinanceDB } from './schema'

/** The app's database and its write API. Reads go through `useLiveQuery(() => db.…)`. */
export const db = new FinanceDB()
export const repos = createRepos(db)

// A newer version of the app (another tab, an updated installation) is upgrading the schema:
// Dexie closes this connection so the upgrade can run, and this page could only fail on its next
// query. Reload instead – that also picks up the code that knows the new schema.
db.on('versionchange', (event) => {
  if (event.newVersion !== null && event.newVersion > 0) window.location.reload()
})

export { DomainError, type DomainErrorCode } from './errors'
export {
  loadAnalytics,
  loadAppData,
  loadBudget,
  loadCategories,
  loadCloseWeek,
  loadDashboard,
  loadExpenseFormData,
  loadExpensesOfWeek,
  loadPots,
  loadRecurring,
  loadTasks,
  loadWhatIf,
} from './queries'
export { createRepos, type Repos } from './repos'
export { FinanceDB } from './schema'
