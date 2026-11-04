import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center gap-2 text-fg-muted', className)}>
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner label={label} />
    </div>
  )
}
