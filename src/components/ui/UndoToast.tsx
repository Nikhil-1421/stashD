import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Props = { label: string; busy: boolean; error: string | null; onUndo: () => void; onDismiss: () => void; onPause: () => void; onResume: () => void }

/** Bottom-centre toast offering to undo the latest action; sits above the mobile nav. */
export function UndoToast({ label, busy, error, onUndo, onDismiss, onPause, onResume }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      <div
        role="status"
        className="pointer-events-auto flex max-w-full items-center gap-3 rounded-lg border border-line bg-surface-3 py-2 pl-4 pr-2 text-sm text-fg shadow-elevated"
        onMouseEnter={onPause}
        onMouseLeave={onResume}
        onFocus={onPause}
        onBlur={onResume}
      >
        <span className="min-w-0 truncate">{error ? `Undo failed: ${error}` : label}</span>
        <Button variant="secondary" size="sm" loading={busy} onClick={onUndo}>
          Undo
          <kbd className="ml-1 hidden rounded border border-line px-1 font-mono text-[10px] text-fg-subtle sm:inline">⌘Z</kbd>
        </Button>
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
