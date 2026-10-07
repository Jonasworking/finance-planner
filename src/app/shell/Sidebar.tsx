import { Plus } from 'lucide-react'
import { NavLink } from 'react-router'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/button'
import { primaryNav, secondaryNav, type NavItem } from './navItems'
import { useInboxCount } from './useInboxCount'

function SidebarLink({ item, count = 0 }: { item: NavItem; count?: number }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex h-11 items-center gap-3 rounded-md px-3 text-label transition-colors outline-none',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
          isActive ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-3/60 hover:text-fg',
        )
      }
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      {item.label}
      {count > 0 ? (
        <span
          aria-label={`${count} offen`}
          className="ml-auto rounded-full bg-income-soft px-2 py-0.5 font-semibold text-income tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </NavLink>
  )
}

export function Sidebar({ className }: { className?: string }) {
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen)
  const inboxCount = useInboxCount()

  return (
    <aside className={cn('flex-col gap-6 border-r bg-surface-1 p-4', className)}>
      <div className="flex items-center gap-3 px-2 pt-2">
        <span className="grid size-9 place-items-center rounded-full border-[3px] border-saved" />
        <span className="text-h2">Finanzplaner</span>
      </div>

      <Button size="touch" onClick={() => setQuickAddOpen(true)} className="justify-start gap-2">
        <Plus aria-hidden />
        Neue Ausgabe
        <kbd className="ml-auto rounded-sm bg-on-saved/10 px-1.5 text-caption tracking-normal">
          N
        </kbd>
      </Button>

      <nav aria-label="Hauptnavigation" className="flex flex-col gap-1">
        {primaryNav.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>

      <nav aria-label="Weitere Bereiche" className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-caption text-fg-subtle uppercase">Mehr</p>
        {secondaryNav.map((item) => (
          <SidebarLink key={item.to} item={item} count={item.badge === 'inbox' ? inboxCount : 0} />
        ))}
      </nav>

      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </aside>
  )
}
