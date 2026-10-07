import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import { displayMerchant, type AutoAssignment } from '@/lib/merchantRules'
import type { Category } from '@/lib/types'
import { Money } from '@/shared/components/Money'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'

export interface AutoAssignSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Inbox lines of well-known merchants with the rule that would sort them. */
  items: readonly AutoAssignment[]
  categories: readonly Category[]
}

/** Shows what the learned rules would do – nothing happens before "Übernehmen". */
export function AutoAssignSheet({ open, onOpenChange, items, categories }: AutoAssignSheetProps) {
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const chosen = items.filter(({ tx }) => !skipped.has(tx.id))

  const toggle = (id: string) =>
    setSkipped((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const apply = async () => {
    setBusy(true)
    try {
      const done = await repos.bank.applyRules(
        chosen.map(({ tx, rule }) => ({
          txId: tx.id,
          target: { action: rule.action, categoryId: rule.categoryId },
        })),
      )
      onOpenChange(false)
      toast(done.length === 1 ? '1 Buchung zugeordnet' : `${done.length} Buchungen zugeordnet`, {
        action: {
          label: 'Rückgängig',
          onClick: () => {
            repos.bank.undoApplyRules(done).catch((error) => toast.error(errorMessage(error)))
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
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Bekannte Händler"
      description="So würden deine Regeln diese Buchungen zuordnen."
      footer={
        <Button
          type="button"
          size="touch"
          disabled={busy || chosen.length === 0}
          onClick={() => void apply()}
        >
          {chosen.length === 0 ? 'Nichts ausgewählt' : `Übernehmen (${chosen.length})`}
        </Button>
      }
    >
      <ul className="flex flex-col divide-y divide-border rounded-md bg-surface-3">
        {items.map(({ tx, rule }) => {
          const target =
            rule.action === 'ignore'
              ? 'keine Ausgabe'
              : (categories.find((category) => category.id === rule.categoryId)?.name ?? '')
          const merchant = displayMerchant(tx.description)
          const on = !skipped.has(tx.id)
          return (
            <li key={tx.id}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(tx.id)}
                  aria-label={`${merchant} → ${target}`}
                  className="size-5 shrink-0 accent-(--saved)"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{merchant}</span>
                  <span className="block truncate text-label text-fg-muted">→ {target}</span>
                </span>
                <Money cents={-tx.amountCents} className="font-semibold" />
              </label>
            </li>
          )
        })}
      </ul>
    </ResponsiveSheet>
  )
}
