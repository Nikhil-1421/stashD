import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChipProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'> & { active: boolean }

/** Toggle-style filter chip; `active` is exposed as aria-pressed. */
export function Chip({ active, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50',
        active ? 'border-line-strong bg-surface-3 text-fg' : 'border-line text-fg-muted hover:bg-surface-2 hover:text-fg',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
