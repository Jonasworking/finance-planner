import { ListChecks } from 'lucide-react'
import { PlaceholderPage } from '@/shared/components/PlaceholderPage'

export function TasksPage() {
  return (
    <PlaceholderPage
      title="Tasks"
      icon={ListChecks}
      phase={5}
      planned={[
        'Finanz-To-dos mit Fälligkeit und Kategorie',
        'Optional an einen Spartopf gekoppelt',
        'Abhaken mit Animation, überfällige Tasks hervorgehoben',
      ]}
    />
  )
}
