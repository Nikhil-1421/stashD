import { useState, type ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'

type InlineConfirmProps = {
  label: ReactNode
  confirmLabel?: ReactNode
  description?: ReactNode
  onConfirm: () => void
  pending?: boolean
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
}

/** Two-step destructive action without a modal: the button expands into confirm/cancel in place. */
export function InlineConfirm({ label, confirmLabel = 'Confirm', description, onConfirm, pending = false, size = 'sm', variant = 'danger' }: InlineConfirmProps) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
    )
  }
  return (
    <span role="group" aria-label="Confirm action" className="inline-flex flex-wrap items-center gap-2">
      {description ? <span className="text-sm text-fg-muted">{description}</span> : null}
      <Button variant="danger" size={size} loading={pending} onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button variant="ghost" size={size} disabled={pending} onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </span>
  )
}
