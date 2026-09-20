import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'

/** Phase 0 stand-in: proves the sheet plumbing (FAB, shortcut "N"). The numpad flow lands in phase 2. */
export function QuickAddSheet() {
  const open = useUiStore((state) => state.quickAddOpen)
  const setOpen = useUiStore((state) => state.setQuickAddOpen)

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title="Neue Ausgabe"
      description="Die Schnellerfassung mit Numpad und Kategorien folgt in Phase 2."
      footer={
        <Button size="touch" onClick={() => setOpen(false)}>
          Schließen
        </Button>
      }
    >
      <p className="py-6 text-center text-display text-fg-subtle tabular-nums">A$0,00</p>
    </ResponsiveSheet>
  )
}
