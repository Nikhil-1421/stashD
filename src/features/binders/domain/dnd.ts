import { slotCount } from './layout'
import type { PlacementMap, PlacementOp } from './placements'

/**
 * What a drag source and a drop target mean for the binder, resolved into a placement operation
 * or a page reorder. Pure; the drag library adapter only carries these records.
 */
export type DragData =
  | { kind: 'printing'; printingId: string }
  | { kind: 'slot'; pageId: string; slotIndex: number }
  | { kind: 'page'; pageId: string }

export type DropData = { kind: 'slot'; pageId: string; slotIndex: number } | { kind: 'page'; pageId: string }

export type DropOutcome =
  | { type: 'op'; op: PlacementOp; label: string }
  | { type: 'reorder'; pageIds: string[]; label: string }
  | { type: 'reject'; reason: string }
  | null

type PageInfo = { id: string; rows: number; columns: number }

export type DropContext = {
  placements: PlacementMap
  /** In display order. */
  pages: readonly PageInfo[]
  describe: (printingId: string) => string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function isDragData(v: unknown): v is DragData {
  if (!isRecord(v)) return false
  if (v.kind === 'printing') return typeof v.printingId === 'string'
  if (v.kind === 'slot') return typeof v.pageId === 'string' && typeof v.slotIndex === 'number'
  if (v.kind === 'page') return typeof v.pageId === 'string'
  return false
}

export function isDropData(v: unknown): v is DropData {
  if (!isRecord(v)) return false
  if (v.kind === 'slot') return typeof v.pageId === 'string' && typeof v.slotIndex === 'number'
  if (v.kind === 'page') return typeof v.pageId === 'string'
  return false
}

export function firstEmptySlot(page: PageInfo, placements: PlacementMap): number | null {
  const count = slotCount(page)
  for (let i = 0; i < count; i += 1) if (!placements.has(`${page.id}:${i}`)) return i
  return null
}

export function resolveDrop(source: DragData, target: DropData, ctx: DropContext): DropOutcome {
  const pageIndex = (id: string) => ctx.pages.findIndex((p) => p.id === id)
  const pageNumber = (id: string) => pageIndex(id) + 1

  if (target.kind === 'slot') {
    const to = { pageId: target.pageId, slotIndex: target.slotIndex }
    if (source.kind === 'printing') {
      return { type: 'op', op: { type: 'place', slot: to, placement: { printingId: source.printingId, notes: null } }, label: `Placed ${ctx.describe(source.printingId)} in slot ${to.slotIndex + 1}` }
    }
    if (source.kind === 'slot') {
      if (source.pageId === to.pageId && source.slotIndex === to.slotIndex) return null
      const moving = ctx.placements.get(`${source.pageId}:${source.slotIndex}`)
      if (!moving) return null
      const occupied = ctx.placements.has(`${to.pageId}:${to.slotIndex}`)
      const where = source.pageId === to.pageId ? `slot ${to.slotIndex + 1}` : `page ${pageNumber(to.pageId)}, slot ${to.slotIndex + 1}`
      return { type: 'op', op: { type: 'move', from: { pageId: source.pageId, slotIndex: source.slotIndex }, to }, label: `${occupied ? 'Swapped' : 'Moved'} ${ctx.describe(moving.printingId)} to ${where}` }
    }
    return null
  }

  // target.kind === 'page'
  const page = ctx.pages.find((p) => p.id === target.pageId)
  if (!page) return null
  if (source.kind === 'page') {
    if (source.pageId === target.pageId) return null
    const ids = ctx.pages.map((p) => p.id)
    const from = ids.indexOf(source.pageId)
    const to = ids.indexOf(target.pageId)
    if (from === -1 || to === -1) return null
    const next = ids.filter((id) => id !== source.pageId)
    next.splice(to, 0, source.pageId)
    return { type: 'reorder', pageIds: next, label: `Moved page ${from + 1} to position ${to + 1}` }
  }
  const empty = firstEmptySlot(page, ctx.placements)
  if (empty === null) return { type: 'reject', reason: `Page ${pageNumber(page.id)} is full.` }
  const to = { pageId: page.id, slotIndex: empty }
  if (source.kind === 'printing') {
    return { type: 'op', op: { type: 'place', slot: to, placement: { printingId: source.printingId, notes: null } }, label: `Placed ${ctx.describe(source.printingId)} on page ${pageNumber(page.id)}` }
  }
  const moving = ctx.placements.get(`${source.pageId}:${source.slotIndex}`)
  if (!moving) return null
  if (source.pageId === page.id) return null
  return { type: 'op', op: { type: 'move', from: { pageId: source.pageId, slotIndex: source.slotIndex }, to }, label: `Moved ${ctx.describe(moving.printingId)} to page ${pageNumber(page.id)}` }
}
