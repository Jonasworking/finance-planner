import { PiggyBank } from 'lucide-react'
import { PlaceholderPage } from '@/shared/components/PlaceholderPage'

export function PotsPage() {
  return (
    <PlaceholderPage
      title="Spartöpfe"
      icon={PiggyBank}
      phase={3}
      planned={[
        'Primär-Topf „Nur gespart" mit automatischer Gutschrift beim Wochenabschluss',
        'Weitere Töpfe mit Ziel, Deadline, Fortschritt und Prognose',
        'Ein-/Auszahlen, Umbuchen und „aus Topf bezahlt" für große Ausgaben',
      ]}
    />
  )
}
