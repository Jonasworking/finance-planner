import { useReducedMotion } from 'motion/react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney, type MoneyDisplay } from '@/lib/money'
import type { DonutRow } from '../chartData'
import { ChartTooltip } from './ChartTooltip'
import { ANIMATION_MS } from './theme'

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })

interface DonutTooltipProps {
  active?: boolean
  payload?: readonly { payload?: DonutRow }[]
  display: MoneyDisplay
}

function DonutTooltip({ active, payload, display }: DonutTooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <ChartTooltip
      title={row.name}
      rows={[
        {
          label: percent.format(row.share),
          value: formatMoney(row.amountCents, display),
          color: row.fill,
        },
      ]}
    />
  )
}

export interface CategoryDonutProps {
  rows: readonly DonutRow[]
  display: MoneyDisplay
  onSelect: (id: string) => void
}

/**
 * Part-to-whole at a glance: at most a handful of slices, largest first from twelve o'clock,
 * separated by a gap in the surface color. The list next to it carries names and numbers –
 * a slice is never identified by its color alone.
 */
export function CategoryDonut({ rows, display, onSelect }: CategoryDonutProps) {
  const animate = !useReducedMotion()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip isAnimationActive={false} content={<DonutTooltip display={display} />} />
        <Pie
          data={rows as DonutRow[]}
          dataKey="value"
          nameKey="name"
          innerRadius="68%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          stroke="var(--surface-1)"
          strokeWidth={2}
          isAnimationActive={animate}
          animationDuration={ANIMATION_MS}
          onClick={(_, index) => {
            const row = rows[index]
            if (row) onSelect(row.id)
          }}
          className="cursor-pointer outline-none"
        >
          {rows.map((row) => (
            <Cell key={row.id} fill={row.fill} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}
