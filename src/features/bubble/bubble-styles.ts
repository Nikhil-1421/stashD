import type { BubbleState } from './domain/bubbles'

/** Fixed pill geometry so the grid can be virtualised by row (px). */
export const PILL_WIDTH = 56
export const PILL_HEIGHT = 40
export const PILL_GAP = 6
export const ROW_HEIGHT = PILL_HEIGHT + PILL_GAP

export const PILL_BASE =
  'inline-flex shrink-0 items-center justify-center rounded-md border font-mono text-xs leading-none select-none transition-colors disabled:cursor-wait'

export const PILL_STATE: Record<BubbleState, string> = {
  missing: 'border-line-strong bg-surface-2 text-fg hover:border-accent',
  owned: 'border-accent/40 bg-accent-soft text-fg-muted line-through decoration-fg-subtle hover:border-accent',
  partial: 'border-warning/40 bg-warning-soft text-warning hover:border-warning',
  complete: 'border-success/40 bg-success-soft text-success line-through decoration-success/60 hover:border-success',
  excluded: 'border-dashed border-line bg-transparent text-fg-subtle hover:border-line-strong',
}

export const PILL_SELECTED = 'ring-2 ring-accent ring-offset-2 ring-offset-canvas'
