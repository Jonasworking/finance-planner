import { toast } from 'sonner'
import { repos } from '@/db'
import type { AnalyticsRange, Granularity } from '@/lib/analytics'
import { SegmentedControl, type SegmentedOption } from '@/shared/components/SegmentedControl'
import { errorMessage } from '@/shared/lib/errorMessages'
import { useUiStore } from '@/shared/stores/uiStore'
import { GRANULARITY_OPTIONS, RANGE_OPTIONS } from '../labels'

type Currency = 'AUD' | 'EUR'

const CURRENCY_OPTIONS: readonly SegmentedOption<Currency>[] = [
  { value: 'AUD', label: 'A$', ariaLabel: 'Australische Dollar' },
  { value: 'EUR', label: '€', ariaLabel: 'Euro' },
]

export interface FilterBarProps {
  granularity: Granularity
  range: AnalyticsRange
  onGranularityChange: (granularity: Granularity) => void
  onRangeChange: (range: AnalyticsRange) => void
  /** Whether amounts are shown in EUR right now. */
  showsEur: boolean
  /** Null = no rate yet: choosing EUR asks for it first. */
  eurRate: number | null
}

/** One row of filters above everything they scope (two lines on a phone). */
export function FilterBar({
  granularity,
  range,
  onGranularityChange,
  onRangeChange,
  showsEur,
  eurRate,
}: FilterBarProps) {
  const openEurRate = useUiStore((state) => state.openEurRate)

  const setCurrency = (currency: Currency) => {
    if (currency === 'EUR' && eurRate === null) {
      openEurRate({ enableOnSave: true })
      return
    }
    repos.settings
      .update({ showEur: currency === 'EUR' })
      .catch((error: unknown) => toast.error(errorMessage(error)))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        label="Gruppierung"
        options={GRANULARITY_OPTIONS}
        value={granularity}
        onChange={onGranularityChange}
      />
      <SegmentedControl
        label="Währung"
        options={CURRENCY_OPTIONS}
        value={showsEur ? 'EUR' : 'AUD'}
        onChange={setCurrency}
        className="ml-auto sm:order-last"
      />
      <SegmentedControl
        label="Zeitraum"
        options={RANGE_OPTIONS}
        value={range}
        onChange={onRangeChange}
        className="w-full sm:w-auto"
      />
    </div>
  )
}
