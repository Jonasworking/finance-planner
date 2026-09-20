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
}))
