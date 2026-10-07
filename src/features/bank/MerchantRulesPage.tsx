import { useLiveQuery } from 'dexie-react-hooks'
import { Ban, Store, Wallet } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { toast } from 'sonner'
import { db, loadMerchantRules, repos } from '@/db'
import { displayPattern } from '@/lib/merchantRules'
import type { Category, MerchantRule } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { GlassCard } from '@/shared/components/GlassCard'
import { Page } from '@/shared/components/Page'
import { SwipeRow } from '@/shared/components/SwipeRow'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Skeleton } from '@/shared/ui/skeleton'

async function removeWithUndo(rule: MerchantRule) {
  try {
    await repos.bank.removeRule(rule.id)
    toast(`Regel „${displayPattern(rule.pattern)}" gelöscht`, {
      action: {
        label: 'Rückgängig',
        onClick: () => {
          repos.bank.restoreRule(rule.id).catch((error) => toast.error(errorMessage(error)))
        },
      },
    })
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

function RuleRow({ rule, category }: { rule: MerchantRule; category: Category | undefined }) {
  const target =
    rule.action === 'ignore' ? 'Keine Ausgabe' : rule.action === 'income' ? 'Lohn' : category?.name
  const Icon = rule.action === 'ignore' ? Ban : Wallet
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-3">
      {rule.action === 'categorize' ? (
        <CategoryIcon icon={category?.icon ?? 'Ellipsis'} color={category?.color ?? 'cat-10'} />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-3 text-fg-muted">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{displayPattern(rule.pattern)}</span>
        <span className="block truncate text-label text-fg-muted">
          → {target ?? 'Kategorie fehlt'} · {rule.confirmations}× bestätigt
        </span>
      </span>
    </div>
  )
}

/** What the inbox has learned: merchant → category. Swipe a rule away to forget it. */
export function MerchantRulesPage() {
  const data = useLiveQuery(() => loadMerchantRules(db), [])
  const categoryById = new Map(data?.categories.map((category) => [category.id, category]))

  return (
    <Page title="Händler-Regeln" subtitle="Gelernt aus deinen Zuordnungen">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {data === undefined ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : data.rules.length === 0 ? (
          <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-surface-3 text-fg-muted">
              <Store className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-h2">Noch keine Regeln</p>
              <p className="text-label text-fg-muted">
                Jede Buchung, die du in der Inbox zuordnest, merkt sich ihren Händler. Beim nächsten
                Mal steht die Kategorie schon bereit.
              </p>
            </div>
          </GlassCard>
        ) : (
          <>
            <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
              <AnimatePresence initial={false}>
                {data.rules.map((rule) => (
                  <m.div
                    key={rule.id}
                    layout
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <SwipeRow
                      onDelete={() => void removeWithUndo(rule)}
                      deleteLabel={`Regel ${displayPattern(rule.pattern)} löschen`}
                    >
                      <RuleRow rule={rule} category={categoryById.get(rule.categoryId ?? '')} />
                    </SwipeRow>
                  </m.div>
                ))}
              </AnimatePresence>
            </GlassCard>
            <p className="px-1 text-label text-fg-muted">
              Ab zwei Bestätigungen bietet die Inbox an, einen Händler automatisch zuzuordnen –
              immer mit Vorschau. Wegwischen löscht eine Regel; deine Ausgaben bleiben.
            </p>
          </>
        )}
      </div>
    </Page>
  )
}
