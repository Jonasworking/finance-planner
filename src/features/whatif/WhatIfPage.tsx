import { FlaskConical } from 'lucide-react'
import { PlaceholderPage } from '@/shared/components/PlaceholderPage'

export function WhatIfPage() {
  return (
    <PlaceholderPage
      title="Was-wäre-wenn"
      icon={FlaskConical}
      phase={5}
      planned={[
        '„Wenn ich X A$/Woche weniger für Essen ausgebe …"',
        'Ergebnis sofort als Kurve: Basis vs. Szenario bis zum Zieldatum',
        'Szenario optional als Budget übernehmen',
      ]}
    />
  )
}
