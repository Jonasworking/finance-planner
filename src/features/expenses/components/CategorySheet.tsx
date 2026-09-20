import { Archive } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { repos } from '@/db'
import type { Category, CategoryGroup } from '@/lib/types'
import { CategoryIcon } from '@/shared/components/CategoryIcon'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_NAMES,
  iconFor,
  solidClass,
} from '@/shared/lib/categoryStyle'
import { errorMessage } from '@/shared/lib/errorMessages'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

const GROUPS: CategoryGroup[] = ['Fixkosten', 'Variabel', 'Freizeit', 'Reisen', 'Sonstiges']

type Draft = Pick<Category, 'name' | 'icon' | 'color' | 'group'>
const EMPTY: Draft = { name: '', icon: 'Sparkles', color: 'cat-1', group: 'Variabel' }

interface CategoryFormProps {
  category: Category | null
  onDone: () => void
}

function CategoryForm({ category, onDone }: CategoryFormProps) {
  const [draft, setDraft] = useState<Draft>(
    category
      ? { name: category.name, icon: category.icon, color: category.color, group: category.group }
      : EMPTY,
  )
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }))
  const name = draft.name.trim()

  const run = async (work: () => Promise<unknown>, message: string) => {
    try {
      await work()
      onDone()
      toast.success(message)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const save = () =>
    run(
      () =>
        category
          ? repos.categories.update(category.id, { ...draft, name })
          : repos.categories.create({ ...draft, name }),
      category ? 'Kategorie gespeichert' : 'Kategorie angelegt',
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={draft.icon} color={draft.color} size="lg" />
        <Input
          value={draft.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="Name der Kategorie"
          aria-label="Name"
          maxLength={24}
          enterKeyHint="done"
          className="h-11 rounded-md"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-caption text-fg-subtle uppercase">Gruppe</legend>
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={draft.group === group}
              onClick={() => patch({ group })}
              className={cn(
                'h-9 rounded-full border px-3.5 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                draft.group === group
                  ? 'border-transparent bg-saved text-on-saved'
                  : 'text-fg-muted',
              )}
            >
              {group}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="pb-2 text-caption text-fg-subtle uppercase">Farbe</legend>
        <div className="flex flex-wrap gap-2.5">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Farbe ${color.replace('cat-', '')}`}
              aria-pressed={draft.color === color}
              onClick={() => patch({ color })}
              className={cn(
                'size-9 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                solidClass(color),
                draft.color === color && 'ring-2 ring-fg ring-offset-2 ring-offset-surface-2',
              )}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="pb-2 text-caption text-fg-subtle uppercase">Icon</legend>
        <div className="grid max-h-44 grid-cols-7 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-8">
          {CATEGORY_ICON_NAMES.map((iconName) => {
            const Icon = iconFor(iconName)
            return (
              <button
                key={iconName}
                type="button"
                aria-label={iconName}
                aria-pressed={draft.icon === iconName}
                onClick={() => patch({ icon: iconName })}
                className={cn(
                  'grid aspect-square place-items-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  draft.icon === iconName
                    ? 'bg-saved-soft text-saved'
                    : 'bg-surface-3 text-fg-muted',
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex gap-2">
        {category ? (
          <Button
            type="button"
            variant="secondary"
            size="touch"
            onClick={() =>
              void run(
                () => repos.categories.update(category.id, { archived: true }),
                'Kategorie archiviert',
              )
            }
          >
            <Archive aria-hidden />
            Archivieren
          </Button>
        ) : null}
        <Button
          type="button"
          size="touch"
          className="flex-1"
          disabled={name === ''}
          onClick={() => void save()}
        >
          Speichern
        </Button>
      </div>
    </div>
  )
}

export interface CategorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = create a new category. */
  category: Category | null
  /** Changes per opening, so the form starts fresh each time. */
  session: number
}

export function CategorySheet({ open, onOpenChange, category, session }: CategorySheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={category ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
      description={
        category ? 'Archivierte Kategorien bleiben an alten Ausgaben sichtbar.' : undefined
      }
    >
      <CategoryForm key={session} category={category} onDone={() => onOpenChange(false)} />
    </ResponsiveSheet>
  )
}
