import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface-1 px-6 py-12 text-center">
      <h2 className="text-lg font-light text-fg">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}
