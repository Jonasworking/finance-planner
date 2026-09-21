import { useState } from 'react'
import { toast } from 'sonner'
import { GlassCard } from '@/shared/components/GlassCard'
import { Money } from '@/shared/components/Money'
import { Page } from '@/shared/components/Page'
import { ProgressRing } from '@/shared/components/ProgressRing'
import { ResponsiveSheet } from '@/shared/components/ResponsiveSheet'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'

const colorGroups: { title: string; swatches: { name: string; className: string }[] }[] = [
  {
    title: 'Flächen',
    swatches: [
      { name: 'bg', className: 'bg-bg' },
      { name: 'surface-1', className: 'bg-surface-1' },
      { name: 'surface-2', className: 'bg-surface-2' },
      { name: 'surface-3', className: 'bg-surface-3' },
    ],
  },
  {
    title: 'Bedeutung',
    swatches: [
      { name: 'saved', className: 'bg-saved' },
      { name: 'spent', className: 'bg-spent' },
      { name: 'income', className: 'bg-income' },
      { name: 'warning', className: 'bg-warning' },
      { name: 'danger', className: 'bg-danger' },
      { name: 'saved-soft', className: 'bg-saved-soft' },
      { name: 'spent-soft', className: 'bg-spent-soft' },
      { name: 'income-soft', className: 'bg-income-soft' },
    ],
  },
  {
    title: 'Kategorien',
    swatches: [
      { name: 'cat-1', className: 'bg-cat-1' },
      { name: 'cat-2', className: 'bg-cat-2' },
      { name: 'cat-3', className: 'bg-cat-3' },
      { name: 'cat-4', className: 'bg-cat-4' },
      { name: 'cat-5', className: 'bg-cat-5' },
      { name: 'cat-6', className: 'bg-cat-6' },
      { name: 'cat-7', className: 'bg-cat-7' },
      { name: 'cat-8', className: 'bg-cat-8' },
      { name: 'cat-9', className: 'bg-cat-9' },
      { name: 'cat-10', className: 'bg-cat-10' },
    ],
  },
  {
    title: 'Chart-Flächen',
    swatches: [
      { name: 'chart-income', className: 'bg-chart-income' },
      { name: 'chart-spent', className: 'bg-chart-spent' },
      { name: 'chart-saved', className: 'bg-chart-saved' },
      { name: 'chart-other', className: 'bg-chart-other' },
      { name: 'chart-cat-1', className: 'bg-chart-cat-1' },
      { name: 'chart-cat-2', className: 'bg-chart-cat-2' },
      { name: 'chart-cat-3', className: 'bg-chart-cat-3' },
      { name: 'chart-cat-4', className: 'bg-chart-cat-4' },
      { name: 'chart-cat-5', className: 'bg-chart-cat-5' },
      { name: 'chart-cat-6', className: 'bg-chart-cat-6' },
      { name: 'chart-cat-7', className: 'bg-chart-cat-7' },
      { name: 'chart-cat-8', className: 'bg-chart-cat-8' },
      { name: 'chart-cat-9', className: 'bg-chart-cat-9' },
      { name: 'chart-cat-10', className: 'bg-chart-cat-10' },
    ],
  },
]

const typeScale = [
  { name: 'display · 44/48 · 700', className: 'text-display', sample: 'A$1.600,00' },
  { name: 'h1 · 28/34 · 700', className: 'text-h1', sample: 'Diese Woche' },
  { name: 'h2 · 20/26 · 600', className: 'text-h2', sample: 'Nur gespart' },
  { name: 'body · 16/24', className: 'text-body', sample: 'Lebensmittel bei Woolworths' },
  {
    name: 'label · 13/18 · 500',
    className: 'text-label',
    sample: 'Bei aktuellem Tempo erreicht am 12.03.',
  },
  { name: 'caption · 11/14 · 600', className: 'text-caption uppercase', sample: 'Ausgegeben' },
]

const radii = [
  { name: 'sm · 10', className: 'rounded-sm' },
  { name: 'md · 14', className: 'rounded-md' },
  { name: 'lg · 20', className: 'rounded-lg' },
  { name: 'xl · 28', className: 'rounded-xl' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-caption text-fg-subtle uppercase">{title}</h2>
      {children}
    </section>
  )
}

/** Dev-only style guide (route `/dev/tokens`), excluded from production builds. */
export function TokensPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [ring, setRing] = useState([62])

  return (
    <Page title="Design-Tokens" subtitle="Nur im Dev-Build">
      <div className="flex flex-col gap-8">
        <Section title="Farbschema">
          <ThemeToggle className="max-w-sm" />
        </Section>

        {colorGroups.map((group) => (
          <Section key={group.title} title={group.title}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {group.swatches.map((swatch) => (
                <div key={swatch.name} className="flex flex-col gap-1.5">
                  <div className={`h-14 rounded-md border ${swatch.className}`} />
                  <span className="text-label text-fg-muted">{swatch.name}</span>
                </div>
              ))}
            </div>
          </Section>
        ))}

        <Section title="Text">
          <GlassCard className="flex flex-col gap-4">
            <p>
              <span className="text-fg">fg</span> · <span className="text-fg-muted">fg-muted</span>{' '}
              · <span className="text-fg-subtle">fg-subtle</span>
            </p>
            {typeScale.map((step) => (
              <div key={step.name}>
                <p className="text-caption tracking-normal text-fg-subtle">{step.name}</p>
                <p className={`${step.className} tabular-nums`}>{step.sample}</p>
              </div>
            ))}
          </GlassCard>
        </Section>

        <Section title="Radien">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {radii.map((radius) => (
              <div
                key={radius.name}
                className={`grid h-20 place-items-center border bg-surface-1 text-label text-fg-muted ${radius.className}`}
              >
                {radius.name}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Beträge">
          <GlassCard className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Money cents={160000} tone="saved" className="text-h1" />
            <Money cents={-31250} tone="auto" className="text-h1" />
            <Money cents={200000} tone="income" className="text-h1" />
            <Money cents={5000} signed tone="auto" className="text-h2" />
            <Money cents={160049} decimals={false} tone="muted" className="text-h2" />
          </GlassCard>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="touch">Speichern</Button>
            <Button size="touch" variant="secondary">
              Sekundär
            </Button>
            <Button size="touch" variant="outline">
              Outline
            </Button>
            <Button size="touch" variant="ghost">
              Ghost
            </Button>
            <Button size="touch" variant="destructive">
              Löschen
            </Button>
            <Button>Default 32</Button>
            <Button size="touch" disabled>
              Deaktiviert
            </Button>
          </div>
        </Section>

        <Section title="Cards, Ring, Glas">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassCard className="flex items-center gap-5">
              <ProgressRing
                value={(ring[0] ?? 0) / 100}
                label="Beispielring"
                size={120}
                strokeWidth={10}
              >
                <span className="text-h2 tabular-nums">{ring[0]} %</span>
              </ProgressRing>
              <div className="flex flex-1 flex-col gap-3">
                <p className="text-label text-fg-muted">Slider steuert den Ring</p>
                <Slider
                  value={ring}
                  onValueChange={setRing}
                  max={100}
                  step={1}
                  aria-label="Ringwert"
                />
              </div>
            </GlassCard>
            <div className="relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 bg-linear-to-br from-income via-saved to-spent" />
              <GlassCard variant="glass" className="relative m-4">
                <p className="text-h2">Glas</p>
                <p className="text-label text-fg-muted">
                  Nur für Tab-Bar, Sticky-Header, Sheet-Griff.
                </p>
              </GlassCard>
            </div>
          </div>
        </Section>

        <Section title="Formular, Laden, Feedback">
          <GlassCard className="flex flex-col gap-4">
            <Input placeholder="Notiz (16 px – kein iOS-Zoom)" className="h-11" />
            <label className="flex items-center justify-between gap-3">
              <span>EUR-Gegenwert anzeigen</span>
              <Switch />
            </label>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="touch" variant="secondary" onClick={() => setSheetOpen(true)}>
                Sheet öffnen
              </Button>
              <Button
                size="touch"
                variant="secondary"
                onClick={() =>
                  toast('Ausgabe gelöscht', {
                    action: {
                      label: 'Rückgängig',
                      onClick: () => toast.success('Wiederhergestellt'),
                    },
                  })
                }
              >
                Toast mit Rückgängig
              </Button>
            </div>
          </GlassCard>
        </Section>
      </div>

      <ResponsiveSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="ResponsiveSheet"
        description="Bottom-Sheet unter 1024 px, Dialog darüber."
        footer={
          <Button size="touch" onClick={() => setSheetOpen(false)}>
            Verstanden
          </Button>
        }
      >
        <p className="text-label text-fg-muted">
          Alle Eingabe-Flows (Ausgabe, Wochenabschluss, Umbuchung) nutzen diese Komponente.
        </p>
      </ResponsiveSheet>
    </Page>
  )
}
