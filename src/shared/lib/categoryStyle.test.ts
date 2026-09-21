import { describe, expect, it } from 'vitest'
import { CATEGORY_COLORS, CHART_OTHER, chartColor } from './categoryStyle'

describe('chartColor', () => {
  it('gives every category color its own chart step', () => {
    for (const color of CATEGORY_COLORS) {
      expect(chartColor(color)).toEqual({
        fill: `var(--chart-${color})`,
        swatch: `bg-chart-${color}`,
      })
    }
  })

  it('falls back to the neutral "other" color', () => {
    expect(chartColor('saved')).toBe(CHART_OTHER)
    expect(chartColor('nope')).toBe(CHART_OTHER)
  })
})
