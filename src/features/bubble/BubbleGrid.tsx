import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type Ref } from 'react'
import { cn } from '@/lib/utils'
import { GEOMETRY, PILL_BASE, PILL_SELECTED, PILL_STATE, type Geometry } from './bubble-styles'
import { bubbleStateLabel, type Bubble, type BubbleSection } from './domain/bubbles'

export type BubbleGridHandle = { scrollToSection: (index: number) => void }

type Props = {
  bubbles: readonly Bubble[]
  selected: ReadonlySet<string>
  /** In selection mode a plain click selects instead of toggling ownership. */
  selecting: boolean
  /** Printing ids with an in-flight write. */
  pending: ReadonlySet<string>
  disabled: boolean
  geometry?: Geometry
  /** Optional runs of pills; each gets a heading row and can be jumped to via the handle. */
  sections?: readonly BubbleSection[]
  onCurrentSectionChange?: (index: number) => void
  onToggle: (bubble: Bubble) => void
  onSelect: (bubble: Bubble, range: boolean) => void
  'aria-label': string
  ref?: Ref<BubbleGridHandle>
}

const OVERSCAN_ROWS = 6

type Viewport = { width: number; top: number; height: number }
type Row = { kind: 'heading'; section: number } | { kind: 'pills'; start: number; count: number }
type Layout = { rows: Row[]; pillRow: Int32Array; pillCol: Int32Array; sectionRow: number[] }

/**
 * Wrapped grid of fixed-size pills, virtualised by row against the window scroll position so a
 * set with thousands of printings only renders what is on screen. Heading rows (one per section)
 * share the row height so the maths stays flat. Keyboard: arrows move, Home/End jump within the
 * row (Ctrl: whole grid), Space/Enter activate, Shift+Space selects a range.
 */
export function BubbleGrid({ bubbles, selected, selecting, pending, disabled, geometry = GEOMETRY.comfortable, sections, onCurrentSectionChange, onToggle, onSelect, 'aria-label': ariaLabel, ref: handleRef }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ width: 0, top: 0, height: 0 })
  const [focusIndex, setFocusIndex] = useState(0)
  /** Index that should receive focus once its pill is rendered (keyboard navigation). */
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)
  const frame = useRef(0)
  const rowHeight = geometry.pillHeight + geometry.gap

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

  const cols = Math.max(1, Math.floor((viewport.width + geometry.gap) / (geometry.pillWidth + geometry.gap)))
  const layout = useMemo<Layout>(() => {
    const rows: Row[] = []
    const pillRow = new Int32Array(bubbles.length)
    const pillCol = new Int32Array(bubbles.length)
    const sectionRow: number[] = []
    const runs = sections && sections.length > 0 ? sections : [{ start: 0, end: bubbles.length }]
    runs.forEach((run, s) => {
      if (sections && sections.length > 0) {
        sectionRow.push(rows.length)
        rows.push({ kind: 'heading', section: s })
      }
      for (let start = run.start; start < run.end; start += cols) {
        const count = Math.min(cols, run.end - start)
        for (let j = 0; j < count; j += 1) {
          pillRow[start + j] = rows.length
          pillCol[start + j] = j
        }
        rows.push({ kind: 'pills', start, count })
      }
    })
    return { rows, pillRow, pillCol, sectionRow }
  }, [bubbles.length, sections, cols])

  const rowCount = layout.rows.length
  const viewportHeight = viewport.height || 800
  const firstVisibleRow = Math.max(0, Math.floor(-viewport.top / rowHeight))
  const start = Math.max(0, firstVisibleRow - OVERSCAN_ROWS)
  const end = Math.min(rowCount, Math.ceil((viewportHeight - viewport.top) / rowHeight) + OVERSCAN_ROWS)
  const safeFocus = Math.min(focusIndex, Math.max(0, bubbles.length - 1))

  // Which section is at the top of the viewport (for the jump strip).
  const currentSection = useMemo(() => {
    let current = 0
    layout.sectionRow.forEach((row, i) => {
      if (row <= firstVisibleRow + 1) current = i
    })
    return current
  }, [layout.sectionRow, firstVisibleRow])
  useEffect(() => {
    onCurrentSectionChange?.(currentSection)
  }, [currentSection, onCurrentSectionChange])

  const scrollToRow = useCallback(
    (row: number, align: 'top' | 'center') => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      const offset = align === 'top' ? 64 : viewportHeight / 2
      window.scrollTo({ top: window.scrollY + rect.top + row * rowHeight - offset })
    },
    [rowHeight, viewportHeight],
  )
  useImperativeHandle(handleRef, () => ({ scrollToSection: (i) => scrollToRow(layout.sectionRow[i] ?? 0, 'top') }), [scrollToRow, layout.sectionRow])

  // A pill outside the rendered rows cannot be focused yet: scroll its row into view first; the
  // scroll handler re-renders and the pill then focuses itself (see Pill).
  useEffect(() => {
    if (pendingFocus === null) return
    const row = layout.pillRow[pendingFocus] ?? 0
    if (row >= start && row < end) return
    scrollToRow(row, 'center')
  }, [pendingFocus, start, end, layout.pillRow, scrollToRow])
  const clearPendingFocus = useCallback(() => setPendingFocus(null), [])

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(bubbles.length - 1, next))
    setFocusIndex(clamped)
    setPendingFocus(clamped)
  }

  /** Pill in the nearest pill row above/below `i`, keeping the column where possible. */
  function vertical(i: number, direction: -1 | 1): number {
    const col = layout.pillCol[i] ?? 0
    let row = (layout.pillRow[i] ?? 0) + direction
    while (row >= 0 && row < layout.rows.length) {
      const r = layout.rows[row]
      if (r && r.kind === 'pills') return r.start + Math.min(col, r.count - 1)
      row += direction
    }
    return i
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const raw = (e.target as HTMLElement).dataset.index
    if (raw === undefined) return
    const i = Number(raw)
    const rowStart = i - (layout.pillCol[i] ?? 0)
    const rowDef = layout.rows[layout.pillRow[i] ?? 0]
    const rowEnd = rowDef && rowDef.kind === 'pills' ? rowDef.start + rowDef.count - 1 : i
    let next: number | null = null
    switch (e.key) {
      case 'ArrowRight': next = i + 1; break
      case 'ArrowLeft': next = i - 1; break
      case 'ArrowDown': next = vertical(i, 1); break
      case 'ArrowUp': next = vertical(i, -1); break
      case 'Home': next = e.ctrlKey || e.metaKey ? 0 : rowStart; break
      case 'End': next = e.ctrlKey || e.metaKey ? bubbles.length - 1 : rowEnd; break
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

  const rowIndices: number[] = []
  for (let r = start; r < end; r += 1) rowIndices.push(r)

  return (
    <div ref={ref} role="group" aria-label={ariaLabel} onKeyDown={onKeyDown} className="relative w-full" style={{ height: rowCount * rowHeight }}>
      {rowIndices.map((r) => {
        const row = layout.rows[r]
        if (!row) return null
        if (row.kind === 'heading') {
          const section = sections?.[row.section]
          return (
            <div key={`h${r}`} role="heading" aria-level={3} className="absolute left-0 flex w-full items-end border-b border-line font-mono text-[11px] text-fg-subtle" style={{ top: r * rowHeight, height: rowHeight, paddingBottom: geometry.gap }}>
              {section?.label}
              <span className="ml-auto">{section ? section.end - section.start : 0}</span>
            </div>
          )
        }
        return (
          <div key={r} className="absolute left-0 flex" style={{ top: r * rowHeight, gap: geometry.gap }}>
            {bubbles.slice(row.start, row.start + row.count).map((b, j) => {
              const index = row.start + j
              return (
                <Pill
                  key={b.key}
                  bubble={b}
                  index={index}
                  width={geometry.pillWidth}
                  height={geometry.pillHeight}
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
        )
      })}
    </div>
  )
}

type PillProps = {
  bubble: Bubble
  index: number
  width: number
  height: number
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

const Pill = memo(function Pill({ bubble: b, index, width, height, tabbable, focusRequested, onFocused, selected, pending, disabled, selecting, onToggle, onSelect, onFocus }: PillProps) {
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
      className={cn(PILL_BASE, PILL_STATE[b.state], height < 36 && 'text-[11px]', selected && PILL_SELECTED, pending && 'opacity-50')}
      style={{ width, height }}
    >
      <span className="max-w-full truncate px-1">{b.label}</span>
    </button>
  )
})
