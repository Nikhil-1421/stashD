import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type SelectProps = ComponentPropsWithoutRef<'select'> & { invalid?: boolean }

export function Select({ className, invalid = false, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-md border bg-surface-solid px-3 text-[15px] text-fg transition-colors',
        'border-line hover:border-line-strong focus:border-accent',
        invalid && 'border-danger focus:border-danger',
        className,
      )}
      {...props}
    />
  )
}
