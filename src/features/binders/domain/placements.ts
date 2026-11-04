/**
 * Placement operations on one binder, expressed as pure transformations over a map of
 * (page, slot) → placement, returning the writes needed to persist them. The editor applies the
 * result locally first (optimistic) and the writes are batched to the server.
 */
export type SlotRef = { pageId: string; slotIndex: number }

export type Placement = {
  printingId: string
  notes: string | null
}

/** Key for the placement map: `${pageId}:${slotIndex}`. */
export function slotKey({ pageId, slotIndex }: SlotRef): string {
  return `${pageId}:${slotIndex}`
}

export function parseSlotKey(key: string): SlotRef {
  const at = key.lastIndexOf(':')
  return { pageId: key.slice(0, at), slotIndex: Number(key.slice(at + 1)) }
}

export type PlacementMap = ReadonlyMap<string, Placement>

/** A write is "this slot now holds X" or "this slot is now empty". Later writes to a slot replace earlier ones. */
export type SlotWrite = { slot: SlotRef; placement: Placement | null }

export type PlacementOp =
  | { type: 'place'; slot: SlotRef; placement: Placement }
  | { type: 'move'; from: SlotRef; to: SlotRef }
  | { type: 'remove'; slot: SlotRef }
  | { type: 'clear-page'; pageId: string; slotCount: number }

export type OpResult = { next: Map<string, Placement>; writes: SlotWrite[]; inverse: PlacementOp[] }

/**
 * Applies one operation. `move` onto an occupied slot swaps the two placements; onto the same slot
 * is a no-op. Every result carries the operations that undo it.
 */
export function applyOp(map: PlacementMap, op: PlacementOp): OpResult {
  const next = new Map(map)
  const writes: SlotWrite[] = []
  const inverse: PlacementOp[] = []

  switch (op.type) {
    case 'place': {
      const key = slotKey(op.slot)
      const before = map.get(key) ?? null
      next.set(key, op.placement)
      writes.push({ slot: op.slot, placement: op.placement })
      inverse.push(before ? { type: 'place', slot: op.slot, placement: before } : { type: 'remove', slot: op.slot })
      break
    }
    case 'remove': {
      const key = slotKey(op.slot)
      const before = map.get(key)
      if (!before) break
      next.delete(key)
      writes.push({ slot: op.slot, placement: null })
      inverse.push({ type: 'place', slot: op.slot, placement: before })
      break
    }
    case 'move': {
      const fromKey = slotKey(op.from)
      const toKey = slotKey(op.to)
      if (fromKey === toKey) break
      const moving = map.get(fromKey)
      if (!moving) break
      const displaced = map.get(toKey) ?? null
      next.set(toKey, moving)
      writes.push({ slot: op.to, placement: moving })
      if (displaced) {
        next.set(fromKey, displaced)
        writes.push({ slot: op.from, placement: displaced })
      } else {
        next.delete(fromKey)
        writes.push({ slot: op.from, placement: null })
      }
      inverse.push({ type: 'move', from: op.to, to: op.from })
      break
    }
    case 'clear-page': {
      for (const [key, placement] of map) {
        const ref = parseSlotKey(key)
        if (ref.pageId !== op.pageId) continue
        next.delete(key)
        writes.push({ slot: ref, placement: null })
        inverse.push({ type: 'place', slot: ref, placement })
      }
      break
    }
  }
  return { next, writes, inverse }
}

/** Placements of one page as a slot-indexed map. */
export function pagePlacements(map: PlacementMap, pageId: string): Map<number, Placement> {
  const out = new Map<number, Placement>()
  for (const [key, placement] of map) {
    const ref = parseSlotKey(key)
    if (ref.pageId === pageId) out.set(ref.slotIndex, placement)
  }
  return out
}

/** Coalesces pending writes so each slot is sent once, with its latest value. */
export function coalesceWrites(writes: readonly SlotWrite[]): SlotWrite[] {
  const latest = new Map<string, SlotWrite>()
  for (const w of writes) latest.set(slotKey(w.slot), w)
  return [...latest.values()]
}
