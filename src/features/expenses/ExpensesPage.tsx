import { ReceiptText } from 'lucide-react'
import { PlaceholderPage } from '@/shared/components/PlaceholderPage'

export function ExpensesPage() {
  return (
    <PlaceholderPage
      title="Ausgaben"
      icon={ReceiptText}
      phase={2}
      planned={[
        'Schnellerfassung in 3 Taps: Betrag → Kategorie → Speichern',
        'Liste nach Tagen mit Wochen-Umschalter, Swipe-to-delete mit Rückgängig',
        'Kategorien, Tags und wiederkehrende Ausgaben (z. B. wöchentliche Miete)',
      ]}
    />
  )
}
