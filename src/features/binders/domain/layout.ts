/**
 * Binder slot math and layout rules. Pure; mirrors the SQL in migration 0007
 * (resize_binder_page remaps by coordinate exactly like `remapPlacements`).
 * Orientation is rows × columns: 3×4 means 3 rows and 4 columns.
 */
export const MAX_DIMENSION = 6
export const MIN_DIMENSION = 1

export type Dimensions = { rows: number; columns: number }

export const LAYOUT_PRESETS: readonly (Dimensions & { label: string })[] = [
  { rows: 2, columns: 2, label: '2 × 2' },
  { rows: 2, columns: 3, label: '2 × 3' },
  { rows: 3, columns: 3, label: '3 × 3' },
  { rows: 3, columns: 4, label: '3 × 4' },
  { rows: 4, columns: 3, label: '4 × 3' },
  { rows: 4, columns: 4, label: '4 × 4' },
]

export function isValidDimension(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_DIMENSION && n <= MAX_DIMENSION
}

export function slotCount({ rows, columns }: Dimensions): number {
  return rows * columns
}

export function slotIndex(row: number, col: number, columns: number): number {
  return row * columns + col
}

export function toCoord(index: number, columns: number): { row: number; col: number } {
  return { row: Math.floor(index / columns), col: index % columns }
}

export function dimensionsLabel({ rows, columns }: Dimensions): string {
  return `${rows} × ${columns}`
}

export type RemapResult<T> = {
  kept: { item: T; from: number; to: number }[]
  dropped: { item: T; from: number }[]
}

/**
 * Coordinate-based remap for a resize: a placement stays at its (row, col) when that still exists
 * on the new page, otherwise it is dropped. Callers show `dropped` and ask before applying.
 */
export function remapPlacements<T>(placements: readonly { slotIndex: number; item: T }[], from: Dimensions, to: Dimensions): RemapResult<T> {
  const result: RemapResult<T> = { kept: [], dropped: [] }
  for (const p of placements) {
    const { row, col } = toCoord(p.slotIndex, from.columns)
    if (row < to.rows && col < to.columns) result.kept.push({ item: p.item, from: p.slotIndex, to: slotIndex(row, col, to.columns) })
    else result.dropped.push({ item: p.item, from: p.slotIndex })
  }
  return result
}

/** Pages needed to hold `count` items at `dims`, and how many slots stay empty on the last page. */
export function planPages(count: number, dims: Dimensions): { pages: number; emptySlots: number } {
  const capacity = slotCount(dims)
  if (count <= 0 || capacity <= 0) return { pages: 0, emptySlots: 0 }
  const pages = Math.ceil(count / capacity)
  return { pages, emptySlots: pages * capacity - count }
}
