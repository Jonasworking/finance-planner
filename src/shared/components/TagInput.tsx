import { X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { addTag, suggestTags } from '@/lib/tags'
import { cn } from '@/shared/lib/utils'

export interface TagInputProps {
  value: readonly string[]
  onChange: (tags: string[]) => void
  /** Known tags, most used first (see `collectTags`). */
  vocabulary: readonly string[]
  className?: string
}

/** Chips plus a text field with autocomplete. Enter, comma or a tap on a suggestion adds a tag. */
export function TagInput({ value, onChange, vocabulary, className }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const suggestions = suggestTags(vocabulary, draft, value)

  const commit = (raw: string) => {
    onChange([...addTag(value, raw)])
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim() !== '') {
      event.preventDefault()
      commit(draft)
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface-1 px-2 py-1.5 focus-within:ring-3 focus-within:ring-ring/50">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex h-8 items-center gap-1 rounded-full bg-surface-3 pr-1 pl-3 text-label"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((other) => other !== tag))}
              aria-label={`Tag ${tag} entfernen`}
              className="grid size-6 place-items-center rounded-full text-fg-muted outline-none hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() !== '' && commit(draft)}
          placeholder={value.length === 0 ? 'Tag hinzufügen …' : ''}
          aria-label="Tag hinzufügen"
          aria-controls={listId}
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint="done"
          className="h-8 min-w-24 flex-1 bg-transparent px-1 outline-none placeholder:text-fg-subtle"
        />
      </div>

      {suggestions.length > 0 ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Tag-Vorschläge"
          className="flex flex-wrap gap-1.5"
        >
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              role="option"
              aria-selected={false}
              // pointerdown + preventDefault: add the tag without blurring the input first.
              onPointerDown={(event) => {
                event.preventDefault()
                commit(tag)
              }}
              onClick={(event) => event.detail === 0 && commit(tag)}
              className="h-8 rounded-full border px-3 text-label text-fg-muted outline-none hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
