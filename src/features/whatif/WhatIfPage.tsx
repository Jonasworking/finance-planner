import { useLiveQuery } from 'dexie-react-hooks'
import { Wallet } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { db, loadWhatIf, repos } from '@/db'
import {
  budgetFromScenario,
  horizonUntil,
  projectScenario,
  toAdjustments,
  whatIfBase,
  type ScenarioBudget,
} from '@/lib/whatif'
import { Page } from '@/shared/components/Page'
import { useToday } from '@/shared/hooks/useToday'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { AdoptBudgetSheet } from './components/AdoptBudgetSheet'
import { CutsCard } from './components/CutsCard'
import { ResultCard } from './components/ResultCard'
import { ScenarioCard } from './components/ScenarioCard'
import { useWhatIfStore } from './whatIfStore'

export function WhatIfPage() {
  const today = useToday()
  const data = useLiveQuery(() => loadWhatIf(db), [])
  const { cuts, horizon, view, setCut, setCuts, resetCuts, setHorizon, setView } = useWhatIfStore()
  const [adopting, setAdopting] = useState<ScenarioBudget | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const settings = data?.settings
  const base = useMemo(
    () =>
      data && settings
        ? whatIfBase({
            today,
            defaultWeeklyIncomeCents: settings.defaultWeeklyIncomeCents,
            weeks: data.weeks,
            expenses: data.expenses,
            budgets: data.budgets,
            categories: data.categories,
            pots: data.pots,
            potTransactions: data.potTransactions,
          })
        : null,
    [data, settings, today],
  )
  const until = horizonUntil(today, horizon)
  const adjustments = useMemo(
    () => (base ? toAdjustments(base.categories, cuts) : []),
    [base, cuts],
  )
  const scenario = useMemo(
    () =>
      base
        ? projectScenario({
            startBalanceCents: base.startBalanceCents,
            baselineWeeklySavingCents: base.baselineWeeklySavingCents,
            adjustments,
            from: base.fromWeek,
            until,
          })
        : null,
    [base, adjustments, until],
  )
  // The numbers follow the thumb at once; the curve may trail a frame while it is dragged.
  const chartPoints = useDeferredValue(scenario?.points ?? [])

  if (!data || !base || !scenario) {
    return (
      <Page title="Was-wäre-wenn">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </Page>
    )
  }

  const proposal = budgetFromScenario(base.budget, base.categories, adjustments)

  const adopt = async () => {
    const previous = base.budget
    if (!adopting || !previous) return
    const previousCuts = cuts
    setBusy(true)
    try {
      await repos.budgets.set(today, {
        totalLimitCents: adopting.totalLimitCents,
        categoryLimits: adopting.categoryLimits,
      })
      setSheetOpen(false)
      // The cuts are in the budget now – leaving them on would offer to cut a second time.
      resetCuts()
      toast.success('Budget übernommen', {
        description: 'Gilt ab dieser Woche.',
        action: {
          label: 'Rückgängig',
          onClick: () => {
            repos.budgets
              .set(today, {
                totalLimitCents: previous.totalLimitCents,
                categoryLimits: previous.categoryLimits,
              })
              .then(() => setCuts(previousCuts))
              .catch((error: unknown) => toast.error(errorMessage(error)))
          },
        },
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Was-wäre-wenn" subtitle="Was weniger Ausgaben bringen">
      {/* minmax(0,…) + min-w-0: grid tracks must not grow to fit long non-wrapping rows */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <ResultCard
            base={base}
            scenario={scenario}
            today={today}
            until={until}
            horizon={horizon}
            onHorizonChange={setHorizon}
          />
          <ScenarioCard
            points={chartPoints}
            weeks={scenario.weeks}
            hasGain={scenario.extraPerWeekCents > 0}
            view={view}
            onViewChange={setView}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <CutsCard
            ranges={base.categories}
            categories={data.categories}
            cuts={cuts}
            scenario={scenario}
            until={until}
            onCut={setCut}
            onReset={resetCuts}
          />
          {base.categories.length > 0 && base.budget ? (
            <Button
              type="button"
              variant="secondary"
              size="touch"
              disabled={!proposal}
              onClick={() => {
                setAdopting(proposal)
                setSheetOpen(true)
              }}
            >
              <Wallet aria-hidden />
              Als Budget übernehmen
            </Button>
          ) : null}
        </div>
      </div>
      <AdoptBudgetSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        proposal={adopting}
        categories={data.categories}
        today={today}
        busy={busy}
        onConfirm={() => void adopt()}
      />
    </Page>
  )
}
