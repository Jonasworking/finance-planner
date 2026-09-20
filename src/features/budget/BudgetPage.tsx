import { Gauge } from 'lucide-react'
import { PlaceholderPage } from '@/shared/components/PlaceholderPage'

export function BudgetPage() {
  return (
    <PlaceholderPage
      title="Wochenbudget"
      icon={Gauge}
      phase={3}
      planned={[
        'Gesamtlimit und Limits pro Kategorie per Slider',
        'Warnungen bei 80 % und 100 %',
        'Streak: Wochen in Folge unter Budget',
      ]}
    />
  )
}
