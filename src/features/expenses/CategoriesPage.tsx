import { useLiveQuery } from 'dexie-react-hooks'
import { ArchiveRestore, GripVertical, Plus } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { db, loadCategories, repos } from '@/db'
import type { Category } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { GlassCard } from '@/shared/components/GlassCard'
import { Page } from '@/shared/components/Page'
import { errorMessage } from '@/shared/lib/errorMessages'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { CategorySheet } from './components/CategorySheet'

interface SortableRowProps {
  category: Category
  onEdit: () => void
  onDrop: () => void
}

function SortableRow({ category, onEdit, onDrop }: SortableRowProps) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={category.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="relative flex items-center bg-surface-1"
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left outline-none hover:bg-surface-3/40 focus-visible:bg-surface-3/60"
      >
        <CategoryIcon icon={category.icon} color={category.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{category.name}</span>
          <span className="block text-label text-fg-muted">{category.group}</span>
        </span>
      </button>
      {/* Only the handle starts a drag, so the list still scrolls on touch. */}
      <span
        onPointerDown={(event) => controls.start(event)}
        aria-hidden
        className="grid h-16 w-12 shrink-0 cursor-grab touch-none place-items-center text-fg-subtle active:cursor-grabbing"
      >
        <GripVertical className="size-5" />
      </span>
    </Reorder.Item>
  )
}

export function CategoriesPage() {
  const data = useLiveQuery(() => loadCategories(db), [])
  // While dragging, the local order wins; afterwards the live query is the truth again.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const [sheet, setSheet] = useState<{ open: boolean; category: Category | null; session: number }>(
    {
      open: false,
      category: null,
      session: 0,
    },
  )

  const openSheet = (category: Category | null) =>
    setSheet((current) => ({ open: true, category, session: current.session + 1 }))

  const active = data?.active ?? []
  const order = dragOrder ?? active.map((category) => category.id)
  const byId = new Map(active.map((category) => [category.id, category]))

  const persistOrder = async () => {
    if (!dragOrder) return
    try {
      await repos.categories.reorder(dragOrder)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDragOrder(null)
    }
  }

  return (
    <Page
      title="Kategorien"
      subtitle="Ziehen zum Sortieren – die Reihenfolge gilt auch in der Schnellerfassung"
      actions={
        <Button size="touch" onClick={() => openSheet(null)}>
          <Plus aria-hidden />
          Neu
        </Button>
      }
    >
      {data === undefined ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <GlassCard padded={false} className="overflow-hidden">
            <Reorder.Group
              axis="y"
              values={order}
              onReorder={setDragOrder}
              className="divide-y divide-border"
            >
              {order.map((id) => {
                const category = byId.get(id)
                return category ? (
                  <SortableRow
                    key={id}
                    category={category}
                    onEdit={() => openSheet(category)}
                    onDrop={() => void persistOrder()}
                  />
                ) : null
              })}
            </Reorder.Group>
          </GlassCard>

          {data.archived.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="px-1 text-caption text-fg-subtle uppercase">Archiviert</h2>
              <GlassCard padded={false} className="divide-y divide-border overflow-hidden">
                {data.archived.map((category) => (
                  <div
                    key={category.id}
                    className="flex min-h-16 items-center gap-3 py-2 pr-2 pl-4"
                  >
                    <CategoryIcon
                      icon={category.icon}
                      color={category.color}
                      className="opacity-60"
                    />
                    <span className="min-w-0 flex-1 truncate text-fg-muted">{category.name}</span>
                    <Button
                      variant="ghost"
                      size="touch"
                      onClick={() =>
                        repos.categories
                          .update(category.id, { archived: false })
                          .then(() => toast.success(`${category.name} wiederhergestellt`))
                          .catch((error) => toast.error(errorMessage(error)))
                      }
                    >
                      <ArchiveRestore aria-hidden />
                      Wiederherstellen
                    </Button>
                  </div>
                ))}
              </GlassCard>
            </section>
          ) : null}
        </div>
      )}

      <CategorySheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        category={sheet.category}
        session={sheet.session}
      />
    </Page>
  )
}
