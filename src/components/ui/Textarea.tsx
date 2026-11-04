import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = ComponentPropsWithoutRef<'textarea'> & { invalid?: boolean }

export function Textarea({ className, invalid = false, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-24 w-full rounded-md border bg-surface-1 px-3 py-2 text-[15px] text-fg placeholder:text-fg-subtle transition-colors',
        'border-line hover:border-line-strong focus:border-accent',
        invalid && 'border-danger focus:border-danger',
        className,
      )}
      {...props}
    />
  )
}
