import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FormFieldProps = {
  id: string
  label: string
  error?: string | undefined
  hint?: string | undefined
  className?: string
  children: ReactNode
}

/** Label + control + hint/error wiring with the aria attributes a screen reader needs. */
export function FormField({ id, label, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
