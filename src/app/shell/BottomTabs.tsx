import { Plus } from 'lucide-react'
import { m } from 'motion/react'
import { NavLink } from 'react-router'
import { cn } from '@/shared/lib/utils'
import { spring, tap } from '@/shared/motion'
import { useUiStore } from '@/shared/stores/uiStore'
import { primaryNav, type NavItem } from './navItems'

function TabLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex h-full flex-col items-center justify-center gap-1 outline-none',
          'text-caption tracking-normal normal-case transition-colors',
          'focus-visible:text-fg',
          isActive ? 'text-fg' : 'text-fg-subtle',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <m.span
              layoutId="tab-indicator"
              transition={spring.snappy}
              className="absolute top-0 h-0.5 w-8 rounded-full bg-saved"
            />
          ) : null}
          <m.span whileTap={tap} className="grid place-items-center">
            <Icon className="size-6" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
          </m.span>
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function BottomTabs({ className }: { className?: string }) {
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen)
  const [left, right] = [primaryNav.slice(0, 2), primaryNav.slice(2)]

  return (
    <nav aria-label="Hauptnavigation" className={cn('border-t glass px-safe pb-safe', className)}>
      <div className="mx-auto grid h-(--tabbar-height) max-w-md grid-cols-5 items-stretch">
        {left.map((item) => (
          <TabLink key={item.to} item={item} />
        ))}
        <div className="grid place-items-center">
          <m.button
            type="button"
            whileTap={{ scale: 0.92 }}
            transition={spring.snappy}
            onClick={() => setQuickAddOpen(true)}
            aria-label="Neue Ausgabe"
            className="grid size-14 -translate-y-3 place-items-center rounded-full bg-saved text-on-saved shadow-glow-saved outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </m.button>
        </div>
        {right.map((item) => (
          <TabLink key={item.to} item={item} />
        ))}
      </div>
    </nav>
  )
}
