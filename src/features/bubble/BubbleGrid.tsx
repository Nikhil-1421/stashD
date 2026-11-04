import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { PILL_BASE, PILL_GAP, PILL_HEIGHT, PILL_SELECTED, PILL_STATE, PILL_WIDTH, ROW_HEIGHT } from './bubble-styles'
import { bubbleStateLabel, type Bubble } from './domain/bubbles'

type Props = {
  bubbles: readonly Bubble[]
  selected: ReadonlySet<string>
  /** In selection mode a plain click selects instead of toggling ownership. */
  selecting: boolean
  /** Printing ids with an in-flight write. */
  pending: ReadonlySet<string>
  disabled: boolean
  onToggle: (bubble: Bubble) => void
  onSelect: (bubble: Bubble, range: boolean) => void
  'aria-label': string
}

const OVERSCAN_ROWS = 6

type Viewport = { width: number; top: number; height: number }

/**
 * Wrapped grid of fixed-size pills, virtualised by row against the window scroll position so a
 * set with thousands of printings only renders what is on screen. Keyboard: arrows move, Home/End
 * jump within the row (Ctrl: whole grid), Space/Enter activate, Shift+Space selects a range.
 */
export function BubbleGrid({ bubbles, selected, selecting, pending, disabled, onToggle, onSelect, 'aria-label': ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ width: 0, top: 0, height: 0 })
  const [focusIndex, setFocusIndex] = useState(0)
  /** Index that should receive focus once its pill is rendered (keyboard navigation). */
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)
  const frame = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      frame.current = 0
      const rect = el.getBoundingClientRect()
      const next = { width: el.clientWidth, top: rect.top, height: window.innerHeight }
      setViewport((prev) => (prev.width === next.width && prev.top === next.top && prev.height === next.height ? prev : next))
    }
    const schedule = () => {
      if (frame.current === 0) frame.current = window.requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(el)
    return () => {
      if (frame.current !== 0) window.cancelAnimationFrame(frame.current)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [])

  const cols = Math.max(1, Math.floor((viewport.width + PILL_GAP) / (PILL_WIDTH + PILL_GAP)))
  const rowCount = Math.ceil(bubbles.length / cols)
  const viewportHeight = viewport.height || 800
  const firstVisibleRow = Math.floor(-viewport.top / ROW_HEIGHT)
  const start = Math.max(0, firstVisibleRow - OVERSCAN_ROWS)
  const end = Math.min(rowCount, Math.ceil((viewportHeight - viewport.top) / ROW_HEIGHT) + OVERSCAN_ROWS)
  const safeFocus = Math.min(focusIndex, Math.max(0, bubbles.length - 1))

  // A pill outside the rendered rows cannot be focused yet: scroll its row into view first; the
  // scroll handler re-renders and the pill then focuses itself (see Pill).
  useEffect(() => {
    if (pendingFocus === null) return
    const row = Math.floor(pendingFocus / cols)
    if (row >= start && row < end) return
    const rect = ref.current?.getBoundingClientRect()
    if (rect) window.scrollTo({ top: window.scrollY + rect.top + row * ROW_HEIGHT - viewportHeight / 2 })
  }, [pendingFocus, start, end, cols, viewportHeight])
  const clearPendingFocus = useCallback(() => setPendingFocus(null), [])

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(bubbles.length - 1, next))
    setFocusIndex(clamped)
    setPendingFocus(clamped)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const raw = (e.target as HTMLElement).dataset.index
    if (raw === undefined) return
    const i = Number(raw)
    const rowStart = i - (i % cols)
    let next: number | null = null
    switch (e.key) {
      case 'ArrowRight': next = i + 1; break
      case 'ArrowLeft': next = i - 1; break
      case 'ArrowDown': next = i + cols; break
      case 'ArrowUp': next = i - cols; break
      case 'Home': next = e.ctrlKey || e.metaKey ? 0 : rowStart; break
      case 'End': next = e.ctrlKey || e.metaKey ? bubbles.length - 1 : rowStart + cols - 1; break
      case ' ': {
        const current = bubbles[i]
        if (e.shiftKey && current) {
          e.preventDefault()
          onSelect(current, true)
        }
        return
      }
      default: return
    }
    e.preventDefault()
    moveFocus(next)
  }

  const rows: number[] = []
  for (let r = start; r < end; r += 1) rows.push(r)

  return (
    <div ref={ref} role="group" aria-label={ariaLabel} onKeyDown={onKeyDown} className="relative w-full" style={{ height: rowCount * ROW_HEIGHT }}>
      {rows.map((r) => (
        <div key={r} className="absolute left-0 flex" style={{ top: r * ROW_HEIGHT, gap: PILL_GAP }}>
          {bubbles.slice(r * cols, (r + 1) * cols).map((b, j) => {
            const index = r * cols + j
            return (
              <Pill
                key={b.key}
                bubble={b}
                index={index}
                tabbable={index === safeFocus}
                focusRequested={index === pendingFocus}
                onFocused={clearPendingFocus}
                selected={selected.has(b.key)}
                pending={b.printingIds.some((id) => pending.has(id))}
                disabled={disabled}
                selecting={selecting}
                onToggle={onToggle}
                onSelect={onSelect}
                onFocus={setFocusIndex}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

type PillProps = {
  bubble: Bubble
  index: number
  tabbable: boolean
  focusRequested: boolean
  onFocused: () => void
  selected: boolean
  pending: boolean
  disabled: boolean
  selecting: boolean
  onToggle: (bubble: Bubble) => void
  onSelect: (bubble: Bubble, range: boolean) => void
  onFocus: (index: number) => void
}

const Pill = memo(function Pill({ bubble: b, index, tabbable, focusRequested, onFocused, selected, pending, disabled, selecting, onToggle, onSelect, onFocus }: PillProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!focusRequested) return
    buttonRef.current?.focus()
    onFocused()
  }, [focusRequested, onFocused])
  const pressed = b.unit === 'printing' ? b.quantity > 0 : b.state === 'complete'
  const subject = b.unit === 'printing' && b.variantName ? `${b.name} ${b.variantName}` : b.name
  const extra = `${b.state === 'excluded' && b.quantity > 0 ? ', owned' : ''}${b.unit === 'printing' && b.quantity > 1 ? ` ×${b.quantity}` : ''}${selected ? ', selected' : ''}`
  function onClick(e: MouseEvent<HTMLButtonElement>) {
    if (selecting || e.shiftKey || e.metaKey || e.ctrlKey) onSelect(b, e.shiftKey)
    else onToggle(b)
  }
  return (
    <button
      ref={buttonRef}
      type="button"
      data-index={index}
      tabIndex={tabbable ? 0 : -1}
      aria-pressed={pressed}
      aria-label={`${subject}: ${bubbleStateLabel(b.state)}${extra}`}
      title={`${b.number ? `${b.number} · ` : ''}${subject}`}
      disabled={disabled || pending}
      onClick={onClick}
      onFocus={() => onFocus(index)}
      className={cn(PILL_BASE, PILL_STATE[b.state], selected && PILL_SELECTED, pending && 'opacity-50')}
      style={{ width: PILL_WIDTH, height: PILL_HEIGHT }}
    >
      <span className="max-w-full truncate px-1">{b.label}</span>
    </button>
  )
})
