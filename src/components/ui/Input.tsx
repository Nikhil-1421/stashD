import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type InputProps = ComponentPropsWithoutRef<'input'> & { invalid?: boolean }

export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-md border bg-surface-1 px-3 text-[15px] text-fg placeholder:text-fg-subtle transition-colors',
        'border-line hover:border-line-strong focus:border-accent',
        invalid && 'border-danger focus:border-danger',
        className,
      )}
      {...props}
    />
  )
}
