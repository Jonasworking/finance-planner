import { create } from 'zustand'
import type { AnalyticsRange, Granularity } from '@/lib/analytics'

interface AnalyticsState {
  granularity: Granularity
  range: AnalyticsRange
  setGranularity: (granularity: Granularity) => void
  setRange: (range: AnalyticsRange) => void
}

/** The selection survives leaving and re-entering the screen (not a reload – it is a view). */
export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  granularity: 'week',
  range: 12,
  setGranularity: (granularity) => set({ granularity }),
  setRange: (range) => set({ range }),
}))
