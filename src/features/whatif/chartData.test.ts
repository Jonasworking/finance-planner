import { describe, expect, it } from 'vitest'
import { projectScenario } from '@/lib/whatif'
import { monthTicks, scenarioTableRows, toScenarioRows } from './chartData'

const scenario = projectScenario({
  startBalanceCents: 1_000_000,
  baselineWeeklySavingCents: 150_050,
  adjustments: [{ categoryId: 'cat:eating-out', deltaCentsPerWeek: 2_000 }],
  from: '2026-09-23',
  until: '2026-11-10',
})

describe('scenario chart rows', () => {
  it('draws both lines and the band between them in whole A$', () => {
    const rows = toScenarioRows(scenario.points)
    expect(rows).toHaveLength(8)
    expect(rows[0]).toEqual({
      key: '2026-09-21',
      tick: 'Sep 26',
      title: 'bis 21.–27. Sep. 2026',
      baseline: 11_500.5,
      scenario: 11_520.5,
      gain: [11_500.5, 11_520.5],
      diff: 20,
      baselineCents: 1_150_050,
      scenarioCents: 1_152_050,
    })
    expect(rows.at(-1)?.scenarioCents).toBe(scenario.points.at(-1)?.scenarioCents)
    expect(rows.at(-1)?.diff).toBe(160) // 8 weeks × A$20
  })

  it('ticks each month once and keeps a month-end row per month for the table', () => {
    const rows = toScenarioRows(scenario.points)
    // Sep 21 is September's; Sep 28 (Thursday Oct 1) opens October; Nov 2 opens November.
    expect(monthTicks(rows)).toEqual(['2026-09-21', '2026-09-28', '2026-11-02'])
    expect(scenarioTableRows(rows).map((row) => row.key)).toEqual([
      '2026-09-21',
      '2026-10-26',
      '2026-11-09',
    ])
    expect(monthTicks([])).toEqual([])
  })
})
