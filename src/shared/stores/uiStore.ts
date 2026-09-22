import { create } from 'zustand'

interface UiState {
  quickAddOpen: boolean
  /** Increments on every opening – used as React key, so forms reset on open, not on close. */
  quickAddSession: number
  setQuickAddOpen: (open: boolean) => void

  /**
   * Edit sheet: the id stays set while the sheet animates out, so its content does not vanish
   * mid-animation. `editOpen` alone decides whether the sheet is shown.
   */
  editingExpenseId: string | null
  editOpen: boolean
  editSession: number
  openExpense: (id: string) => void
  closeExpense: () => void

  /** "Woche abschließen" / "Woche bearbeiten" for one week (its Monday). Same pattern as above. */
  closeWeekStart: string | null
  closeWeekOpen: boolean
  closeWeekSession: number
  openCloseWeek: (weekStart: string) => void
  dismissCloseWeek: () => void

  /**
   * "EUR-Kurs" sheet. `eurRateEnable` = also switch the EUR display on when the rate is saved
   * (the currency switch opens it that way; the settings screen only edits the rate).
   */
  eurRateOpen: boolean
  eurRateSession: number
  eurRateEnable: boolean
  openEurRate: (options?: { enableOnSave?: boolean }) => void
  closeEurRate: () => void

  /** Task sheet: `null` id = create a new task. Same keep-id-while-closing pattern as above. */
  taskId: string | null
  taskOpen: boolean
  taskSession: number
  openTask: (id?: string | null) => void
  closeTask: () => void
}

/** Ephemeral UI state only – persistent data lives in Dexie. */
export const useUiStore = create<UiState>((set) => ({
  quickAddOpen: false,
  quickAddSession: 0,
  setQuickAddOpen: (quickAddOpen) =>
    set((state) => ({
      quickAddOpen,
      quickAddSession: quickAddOpen ? state.quickAddSession + 1 : state.quickAddSession,
    })),

  editingExpenseId: null,
  editOpen: false,
  editSession: 0,
  openExpense: (editingExpenseId) =>
    set((state) => ({ editingExpenseId, editOpen: true, editSession: state.editSession + 1 })),
  closeExpense: () => set({ editOpen: false }),

  closeWeekStart: null,
  closeWeekOpen: false,
  closeWeekSession: 0,
  openCloseWeek: (closeWeekStart) =>
    set((state) => ({
      closeWeekStart,
      closeWeekOpen: true,
      closeWeekSession: state.closeWeekSession + 1,
    })),
  dismissCloseWeek: () => set({ closeWeekOpen: false }),

  eurRateOpen: false,
  eurRateSession: 0,
  eurRateEnable: false,
  openEurRate: (options) =>
    set((state) => ({
      eurRateOpen: true,
      eurRateSession: state.eurRateSession + 1,
      eurRateEnable: options?.enableOnSave === true,
    })),
  closeEurRate: () => set({ eurRateOpen: false }),

  taskId: null,
  taskOpen: false,
  taskSession: 0,
  openTask: (taskId = null) =>
    set((state) => ({ taskId, taskOpen: true, taskSession: state.taskSession + 1 })),
  closeTask: () => set({ taskOpen: false }),
}))
