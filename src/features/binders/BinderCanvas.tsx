import { useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { BinderPage, PrintingDetail } from './api'
import { slotLabel } from './binder-utils'
import { useDragSource, useDropTarget } from './dnd'
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
 * Enter/Space activate (place / select / move), Delete clears a filled slot. Filled slots can
 * also be dragged (pointer) onto other slots or page tabs; every slot is a drop target.
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
      className="grid gap-2 rounded-lg border border-line bg-canvas/55 p-3"
      style={{ gridTemplateColumns: `repeat(${page.columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Slot
          key={i}
          pageId={page.id}
          index={i}
          placement={placements.get(i)}
          details={details}
          tabbable={i === safeFocus}
          selected={selectedSlot === i}
          placing={placing}
          moving={moving}
          disabled={disabled}
          onFocus={setFocusIndex}
          onActivate={onActivate}
        />
      ))}
    </div>
  )
}

type SlotProps = {
  pageId: string
  index: number
  placement: Placement | undefined
  details: ReadonlyMap<string, PrintingDetail>
  tabbable: boolean
  selected: boolean
  placing: boolean
  moving: boolean
  disabled: boolean
  onFocus: (index: number) => void
  onActivate: (index: number) => void
}

/** One slot: a button (click / keyboard path), a drag source when filled, and a drop target. */
function Slot({ pageId, index, placement, details, tabbable, selected, placing, moving, disabled, onFocus, onActivate }: SlotProps) {
  const detail = placement ? details.get(placement.printingId) : undefined
  const { dragRef, isDragging } = useDragSource(`slot:${pageId}:${index}`, { kind: 'slot', pageId, slotIndex: index }, disabled || placement === undefined)
  const { dropRef, isDropTarget } = useDropTarget(`drop:${pageId}:${index}`, { kind: 'slot', pageId, slotIndex: index }, ['printing', 'slot'], disabled)
  return (
    <button
      ref={(el) => {
        dragRef(el)
        dropRef(el)
      }}
      type="button"
      data-slot={index}
      tabIndex={tabbable ? 0 : -1}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${slotLabel(index, detail, placement !== undefined)}${selected ? ', selected' : ''}`}
      onFocus={() => onFocus(index)}
      onClick={() => onActivate(index)}
      className={cn(
        'relative flex aspect-[5/7] min-h-16 flex-col overflow-hidden rounded-md border p-1.5 text-left transition-colors',
        placement ? 'cursor-grab border-line-strong bg-surface-2 hover:border-accent active:cursor-grabbing' : 'border-dashed border-line bg-surface-1/40 text-fg-subtle hover:border-line-strong',
        (placing || moving) && !selected && 'hover:border-accent hover:bg-accent-soft',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas',
        isDropTarget && 'border-accent bg-accent-soft',
        isDragging && 'opacity-40',
        disabled && 'opacity-50',
      )}
    >
      <span className="font-mono text-[10px] leading-none text-fg-subtle">{placement && detail?.number ? `#${detail.number}` : index + 1}</span>
      {placement ? (
        <>
          <span className="mt-auto line-clamp-2 text-xs font-normal leading-tight text-fg">{detail?.name ?? '…'}</span>
          {detail && detail.variantPosition !== 0 ? <span className="truncate text-[10px] leading-tight text-fg-muted">{detail.variantName}</span> : null}
        </>
      ) : (
        <span className="mt-auto text-[10px] leading-tight">{isDropTarget ? 'Drop here' : placing ? 'Place here' : moving ? 'Move here' : 'Empty'}</span>
      )}
    </button>
  )
}
