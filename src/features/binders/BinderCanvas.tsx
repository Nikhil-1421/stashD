import { useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { BinderPage, PrintingDetail } from './api'
import { slotLabel } from './binder-utils'
import { slotCount } from './domain/layout'
import type { Placement } from './domain/placements'

type Props = {
  page: BinderPage
  placements: ReadonlyMap<number, Placement>
  details: ReadonlyMap<string, PrintingDetail>
  selectedSlot: number | null
  /** Something is armed for placing (a card from the panel or a duplicate). */
  placing: boolean
  /** A slot is selected and waiting for its destination. */
  moving: boolean
  disabled: boolean
  onActivate: (slotIndex: number) => void
  onRemove: (slotIndex: number) => void
}

/**
 * One binder page as a rows × columns grid of slot buttons. Arrow keys move between slots,
 * Enter/Space activate (place / select / move), Delete clears a filled slot.
 */
export function BinderCanvas({ page, placements, details, selectedSlot, placing, moving, disabled, onActivate, onRemove }: Props) {
  const count = slotCount(page)
  const [focusIndex, setFocusIndex] = useState(0)
  const safeFocus = Math.min(focusIndex, count - 1)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const raw = (e.target as HTMLElement).dataset.slot
    if (raw === undefined) return
    const i = Number(raw)
    let next: number | null = null
    switch (e.key) {
      case 'ArrowRight': next = Math.min(count - 1, i + 1); break
      case 'ArrowLeft': next = Math.max(0, i - 1); break
      case 'ArrowDown': next = Math.min(count - 1, i + page.columns); break
      case 'ArrowUp': next = Math.max(0, i - page.columns); break
      case 'Home': next = 0; break
      case 'End': next = count - 1; break
      case 'Delete':
      case 'Backspace':
        if (placements.has(i)) {
          e.preventDefault()
          onRemove(i)
        }
        return
      default: return
    }
    e.preventDefault()
    setFocusIndex(next)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-slot="${next}"]`)?.focus()
  }

  return (
    <div
      role="group"
      aria-label={`Page ${page.page_order + 1}${page.label ? ` (${page.label})` : ''}, ${page.rows} by ${page.columns}`}
      onKeyDown={onKeyDown}
      className="grid gap-2 rounded-lg border border-line bg-canvas p-3"
      style={{ gridTemplateColumns: `repeat(${page.columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => {
        const placement = placements.get(i)
        const detail = placement ? details.get(placement.printingId) : undefined
        const selected = selectedSlot === i
        return (
          <button
            key={i}
            type="button"
            data-slot={i}
            tabIndex={i === safeFocus ? 0 : -1}
            disabled={disabled}
            aria-pressed={selected}
            aria-label={`${slotLabel(i, detail, placement !== undefined)}${selected ? ', selected' : ''}`}
            onFocus={() => setFocusIndex(i)}
            onClick={() => onActivate(i)}
            className={cn(
              'relative flex aspect-[5/7] min-h-16 flex-col overflow-hidden rounded-md border p-1.5 text-left transition-colors',
              placement ? 'border-line-strong bg-surface-2 hover:border-accent' : 'border-dashed border-line bg-surface-1/40 text-fg-subtle hover:border-line-strong',
              (placing || moving) && !selected && 'hover:border-accent hover:bg-accent-soft',
              selected && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas',
              disabled && 'opacity-50',
            )}
          >
            <span className="font-mono text-[10px] leading-none text-fg-subtle">{placement && detail?.number ? `#${detail.number}` : i + 1}</span>
            {placement ? (
              <>
                <span className="mt-auto line-clamp-2 text-xs font-medium leading-tight text-fg">{detail?.name ?? '…'}</span>
                {detail && detail.variantPosition !== 0 ? <span className="truncate text-[10px] leading-tight text-fg-muted">{detail.variantName}</span> : null}
              </>
            ) : (
              <span className="mt-auto text-[10px] leading-tight">{placing ? 'Place here' : moving ? 'Move here' : 'Empty'}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
