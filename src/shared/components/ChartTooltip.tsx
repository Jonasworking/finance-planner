import type { ReactNode } from 'react'

export interface TooltipRow {
  label: string
  value: string
  /** CSS color of the series key; omit for rows that are not a series. */
  color?: string
  pale?: boolean
}

export interface ChartTooltipProps {
  title: string
  rows: readonly TooltipRow[]
  note?: ReactNode
}

/** One readout for every series at the hovered position: values lead, labels follow. */
export function ChartTooltip({ title, rows, note }: ChartTooltipProps) {
  return (
    <div className="max-w-56 rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-label shadow-card">
      <p className="mb-1 text-fg-muted">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.color ?? 'transparent', opacity: row.pale ? 0.4 : 1 }}
            />
            <span className="font-semibold whitespace-nowrap text-fg tabular-nums">
              {row.value}
            </span>
            <span className="text-fg-muted">{row.label}</span>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-1 text-fg-subtle">{note}</p> : null}
    </div>
  )
}
