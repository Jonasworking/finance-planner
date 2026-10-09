import { formatMonth, monthOfWeek } from '@/lib/dates'
import type { Cents, ISODate } from '@/lib/types'

/** The plot is drawn in a 100 × 100 box that the SVG stretches to its size. */
const TOP = 10
const BOTTOM = 90
/** Month labels closer than this (in % of the width) would run into each other. */
const MIN_LABEL_GAP = 14

export interface TrendGeometry {
  /** Path of the line, and of the area below it down to the bottom edge. */
  line: string
  area: string
  /** Where the line ends – the dot for "now", in % of the box. */
  end: { x: number; y: number }
  /** Month names along the bottom, in % of the width. */
  months: { label: string; x: number; align: 'start' | 'center' | 'end' }[]
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * What the savings curve of the home screen draws. The scale runs from the lowest to the
 * highest point: the line shows the shape of the last weeks, it has no value axis. Null with
 * fewer than two points – there is no line to draw then.
 */
export function trendGeometry(
  points: readonly { weekStart: ISODate; totalCents: Cents }[],
): TrendGeometry | null {
  if (points.length < 2) return null
  const values = points.map((point) => point.totalCents)
  const min = Math.min(...values)
  const span = Math.max(...values) - min
  const xy = points.map((point, index) => ({
    x: round((index / (points.length - 1)) * 100),
    y: span === 0 ? 50 : round(BOTTOM - ((point.totalCents - min) / span) * (BOTTOM - TOP)),
  }))
  const line = xy.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')

  const starts = points.flatMap((point, index) => {
    const month = monthOfWeek(point.weekStart)
    const previous = points[index - 1]
    return previous && monthOfWeek(previous.weekStart) === month
      ? []
      : [{ label: formatMonth(month, 'name'), x: xy[index]?.x ?? 0 }]
  })
  // When two month starts are too close, the later one wins: it has more weeks to its right.
  const months = starts
    .filter((label, index) => {
      const next = starts[index + 1]
      return !next || next.x - label.x >= MIN_LABEL_GAP
    })
    .map((label) => ({
      ...label,
      align:
        label.x < 7 ? ('start' as const) : label.x > 93 ? ('end' as const) : ('center' as const),
    }))

  return {
    line,
    area: `${line} L100,100 L0,100 Z`,
    end: xy[xy.length - 1] ?? { x: 100, y: 50 },
    months,
  }
}
