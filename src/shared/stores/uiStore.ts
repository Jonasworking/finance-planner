import { create } from 'zustand'

interface UiState {
  quickAddOpen: boolean
  setQuickAddOpen: (open: boolean) => void
}

/** Ephemeral UI state only – persistent data lives in Dexie. */
export const useUiStore = create<UiState>((set) => ({
  quickAddOpen: false,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
}))
