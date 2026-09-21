import { ChartColumn, Table2 } from 'lucide-react'
import { Suspense, useState, type ReactNode } from 'react'
import { GlassCard } from '@/shared/components/GlassCard'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

export interface ChartTable {
  columns: readonly string[]
  rows: readonly { key: string; cells: readonly ReactNode[] }[]
}

export interface LegendItem {
  label: string
  /** Tailwind class of the swatch color. */
  swatch: string
  /** The swatch mirrors the mark: a block for bars and areas, a stroke for lines and markers. */
  mark?: 'block' | 'line'
  /** Paler swatch for "not final yet". */
  pale?: boolean
}

export interface ChartCardProps {
  title: string
  subtitle?: ReactNode
  legend?: readonly LegendItem[]
  /** The same numbers as a table – every chart has this twin. Null hides the switch. */
  table: ChartTable | null
  /** Shown instead of the chart when there is nothing to draw yet. */
  empty?: ReactNode
  /** Height of the plot INCLUDING its axis labels, so nothing scrolls inside the card. */
  plotClassName?: string
  children: ReactNode
}

export function ChartLegend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-label text-fg-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'shrink-0 rounded-[2px]',
              item.mark === 'line' ? 'h-0.5 w-3.5' : 'size-2.5',
              item.swatch,
              item.pale && 'opacity-40',
            )}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/** Frame of every chart: title, legend, the plot at a fixed height and its table twin. */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  empty,
  plotClassName = 'h-60',
  children,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false)
  const tableShown = showTable && table !== null && !empty

  return (
    <GlassCard className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-h2">{title}</h2>
          {subtitle ? <p className="text-label text-fg-muted">{subtitle}</p> : null}
        </div>
        {table && !empty ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            aria-pressed={showTable}
            aria-label={
              showTable ? `${title}: als Chart anzeigen` : `${title}: als Tabelle anzeigen`
            }
            onClick={() => setShowTable((shown) => !shown)}
            className="-mt-1.5 -mr-2 shrink-0 text-fg-muted"
          >
            {showTable ? (
              <ChartColumn className="size-5" aria-hidden />
            ) : (
              <Table2 className="size-5" aria-hidden />
            )}
          </Button>
        ) : null}
      </div>

      {empty ? (
        <p className="text-label text-fg-muted">{empty}</p>
      ) : tableShown ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full text-label tabular-nums">
            <thead>
              <tr className="border-b text-left text-fg-muted">
                {table.columns.map((column, index) => (
                  <th
                    key={column}
                    scope="col"
                    className={cn('py-2 font-medium', index > 0 && 'pl-3 text-right')}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {table.rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, index) =>
                    index === 0 ? (
                      <th key={index} scope="row" className="py-2 text-left font-normal">
                        {cell}
                      </th>
                    ) : (
                      <td key={index} className="py-2 pl-3 text-right whitespace-nowrap">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {legend ? <ChartLegend items={legend} /> : null}
          <div className={cn('min-w-0 tabular-nums', plotClassName)}>
            <Suspense fallback={<Skeleton className="size-full rounded-md" />}>{children}</Suspense>
          </div>
        </>
      )}
    </GlassCard>
  )
}
