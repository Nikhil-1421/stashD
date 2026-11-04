import type { BubbleState } from './domain/bubbles'

/** Pill geometry (px) per density; fixed so the grid can be virtualised by row. */
export type Density = 'comfortable' | 'compact'
export type Geometry = { pillWidth: number; pillHeight: number; gap: number }

export const GEOMETRY: Record<Density, Geometry> = {
  comfortable: { pillWidth: 56, pillHeight: 40, gap: 6 },
  compact: { pillWidth: 44, pillHeight: 30, gap: 4 },
}

export function isDensity(v: unknown): v is Density {
  return v === 'comfortable' || v === 'compact'
}

/** Compact on pointer devices, comfortable (40 px targets) where the primary input is touch. */
export function defaultDensity(): Density {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'comfortable'
  return window.matchMedia('(pointer: coarse)').matches ? 'comfortable' : 'compact'
}

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
