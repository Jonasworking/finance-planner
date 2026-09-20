import { ChartColumn } from 'lucide-react'
import { PlaceholderPage } from '@/shared/components/PlaceholderPage'

export function AnalyticsPage() {
  return (
    <PlaceholderPage
      title="Analyse"
      icon={ChartColumn}
      phase={4}
      planned={[
        'Wochen- und Monatsansicht: Verdient vs. Ausgegeben vs. Gespart',
        'Kategorien-Donut, kumulierter Sparverlauf, Vergleich zur Vorwoche',
        'Beste und schlechteste Woche, optional in EUR',
      ]}
    />
  )
}
