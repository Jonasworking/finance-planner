import type { ReactNode } from 'react'
import { useIsDesktop } from '@/shared/hooks/useMediaQuery'
import { cn } from '@/shared/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/ui/drawer'

export interface ResponsiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * Bottom sheet below `lg`, centered dialog from `lg` up. Features only ever use this wrapper,
 * so the underlying primitives (vaul drawer / Radix dialog) stay swappable.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveSheetProps) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('rounded-xl bg-surface-2 sm:max-w-md', className)}>
          <DialogHeader>
            <DialogTitle className="text-h2 font-semibold">{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          'bg-surface-2 shadow-sheet data-[vaul-drawer-direction=bottom]:max-h-[92dvh]',
          className,
        )}
      >
        <DrawerHeader>
          <DrawerTitle className="text-h2 font-semibold">{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
        {footer ? (
          <DrawerFooter className="pb-safe-4">{footer}</DrawerFooter>
        ) : (
          <div className="pb-safe" />
        )}
      </DrawerContent>
    </Drawer>
  )
}
