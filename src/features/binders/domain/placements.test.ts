import { describe, expect, it } from 'vitest'
import { applyOp, coalesceWrites, pagePlacements, parseSlotKey, slotKey, type Placement } from './placements'

const a: Placement = { printingId: 'pa', notes: null }
const b: Placement = { printingId: 'pb', notes: 'showcase' }
const base = new Map([
  [slotKey({ pageId: 'page1', slotIndex: 0 }), a],
  [slotKey({ pageId: 'page1', slotIndex: 1 }), b],
])

describe('slot keys', () => {
  it('round-trips page ids that contain colons', () => {
    expect(parseSlotKey(slotKey({ pageId: 'a:b', slotIndex: 7 }))).toEqual({ pageId: 'a:b', slotIndex: 7 })
  })
})

describe('applyOp', () => {
  it('places into an empty slot and inverts to a remove', () => {
    const out = applyOp(base, { type: 'place', slot: { pageId: 'page1', slotIndex: 2 }, placement: a })
    expect(out.next.get('page1:2')).toEqual(a)
    expect(out.writes).toEqual([{ slot: { pageId: 'page1', slotIndex: 2 }, placement: a }])
    expect(out.inverse).toEqual([{ type: 'remove', slot: { pageId: 'page1', slotIndex: 2 } }])
  })

  it('places over an occupied slot and inverts to restoring the old placement', () => {
    const out = applyOp(base, { type: 'place', slot: { pageId: 'page1', slotIndex: 0 }, placement: b })
    expect(out.inverse).toEqual([{ type: 'place', slot: { pageId: 'page1', slotIndex: 0 }, placement: a }])
  })

  it('moves into an empty slot, writing the target and clearing the source', () => {
    const out = applyOp(base, { type: 'move', from: { pageId: 'page1', slotIndex: 0 }, to: { pageId: 'page2', slotIndex: 5 } })
    expect(out.next.has('page1:0')).toBe(false)
    expect(out.next.get('page2:5')).toEqual(a)
    expect(out.writes).toEqual([
      { slot: { pageId: 'page2', slotIndex: 5 }, placement: a },
      { slot: { pageId: 'page1', slotIndex: 0 }, placement: null },
    ])
    expect(out.inverse).toEqual([{ type: 'move', from: { pageId: 'page2', slotIndex: 5 }, to: { pageId: 'page1', slotIndex: 0 } }])
  })

  it('swaps when moving onto an occupied slot', () => {
    const out = applyOp(base, { type: 'move', from: { pageId: 'page1', slotIndex: 0 }, to: { pageId: 'page1', slotIndex: 1 } })
    expect(out.next.get('page1:0')).toEqual(b)
    expect(out.next.get('page1:1')).toEqual(a)
    expect(out.writes).toHaveLength(2)
    const undone = applyOp(out.next, out.inverse[0]!)
    expect(undone.next.get('page1:0')).toEqual(a)
    expect(undone.next.get('page1:1')).toEqual(b)
  })

  it('ignores moves from empty slots and onto themselves', () => {
    expect(applyOp(base, { type: 'move', from: { pageId: 'page1', slotIndex: 3 }, to: { pageId: 'page1', slotIndex: 0 } }).writes).toEqual([])
    expect(applyOp(base, { type: 'move', from: { pageId: 'page1', slotIndex: 0 }, to: { pageId: 'page1', slotIndex: 0 } }).writes).toEqual([])
  })

  it('removes and clears a page with inverses that put everything back', () => {
    const removed = applyOp(base, { type: 'remove', slot: { pageId: 'page1', slotIndex: 1 } })
    expect(removed.next.has('page1:1')).toBe(false)
    expect(removed.inverse).toEqual([{ type: 'place', slot: { pageId: 'page1', slotIndex: 1 }, placement: b }])

    const cleared = applyOp(base, { type: 'clear-page', pageId: 'page1', slotCount: 4 })
    expect(cleared.next.size).toBe(0)
    expect(cleared.writes.map((w) => w.placement)).toEqual([null, null])
    const restored = cleared.inverse.reduce((m, op) => applyOp(m, op).next, cleared.next as Map<string, Placement>)
    expect(restored).toEqual(base)
  })
})

describe('pagePlacements and coalesceWrites', () => {
  it('extracts one page by slot index', () => {
    expect([...pagePlacements(base, 'page1').keys()]).toEqual([0, 1])
    expect(pagePlacements(base, 'page2').size).toBe(0)
  })

  it('keeps only the latest write per slot', () => {
    const out = coalesceWrites([
      { slot: { pageId: 'page1', slotIndex: 0 }, placement: a },
      { slot: { pageId: 'page1', slotIndex: 1 }, placement: b },
      { slot: { pageId: 'page1', slotIndex: 0 }, placement: null },
    ])
    expect(out).toEqual([
      { slot: { pageId: 'page1', slotIndex: 0 }, placement: null },
      { slot: { pageId: 'page1', slotIndex: 1 }, placement: b },
    ])
  })
})
