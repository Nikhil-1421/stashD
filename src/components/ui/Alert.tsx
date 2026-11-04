import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AlertProps = {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  children?: ReactNode
  className?: string
}

const tones = {
  info: { box: 'border-line bg-surface-2 text-fg', icon: Info, iconClass: 'text-accent' },
  success: { box: 'border-success/30 bg-success-soft text-fg', icon: CircleCheck, iconClass: 'text-success' },
  warning: { box: 'border-warning/30 bg-warning-soft text-fg', icon: TriangleAlert, iconClass: 'text-warning' },
  danger: { box: 'border-danger/30 bg-danger-soft text-fg', icon: TriangleAlert, iconClass: 'text-danger' },
} as const

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const t = tones[tone]
  const Icon = t.icon
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border p-3 text-sm', t.box, className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', t.iconClass)} aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-normal">{title}</p> : null}
        {children ? <div className="text-fg-muted">{children}</div> : null}
      </div>
    </div>
  )
}
