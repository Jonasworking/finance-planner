import { create } from 'zustand'
import type { Cents, ISODate } from '@/lib/types'

export type HorizonMonths = 3 | 6 | 12 | 24
/** The curve as the lead over the baseline, or both balances in full. */
export type ScenarioView = 'gain' | 'total'

interface WhatIfState {
  /** Category id → how much less per week. */
  cuts: Record<string, Cents>
  /** A preset horizon, or a date picked by hand. */
  horizon: HorizonMonths | ISODate
  view: ScenarioView
  setCut: (categoryId: string, cents: Cents) => void
  setCuts: (cuts: Record<string, Cents>) => void
  resetCuts: () => void
  setHorizon: (horizon: HorizonMonths | ISODate) => void
  setView: (view: ScenarioView) => void
}

/** The scenario survives leaving and re-entering the screen (not a reload – it is a sketch). */
export const useWhatIfStore = create<WhatIfState>((set) => ({
  cuts: {},
  horizon: 12,
  view: 'gain',
  setCut: (categoryId, cents) => set((state) => ({ cuts: { ...state.cuts, [categoryId]: cents } })),
  setCuts: (cuts) => set({ cuts }),
  resetCuts: () => set({ cuts: {} }),
  setHorizon: (horizon) => set({ horizon }),
  setView: (view) => set({ view }),
}))
