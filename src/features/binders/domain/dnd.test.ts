import { describe, expect, it } from 'vitest'
import { firstEmptySlot, isDragData, isDropData, resolveDrop, type DropContext } from './dnd'

const ctx: DropContext = {
  placements: new Map([
    ['page1:0', { printingId: 'pa', notes: null }],
    ['page1:1', { printingId: 'pb', notes: null }],
    ['page2:0', { printingId: 'pc', notes: null }],
    ['page2:1', { printingId: 'pd', notes: null }],
  ]),
  pages: [
    { id: 'page1', rows: 2, columns: 2 },
    { id: 'page2', rows: 1, columns: 2 },
    { id: 'page3', rows: 1, columns: 1 },
  ],
  describe: (id) => id.toUpperCase(),
}

describe('resolveDrop', () => {
  it('places a dragged printing into a slot', () => {
    expect(resolveDrop({ kind: 'printing', printingId: 'px' }, { kind: 'slot', pageId: 'page1', slotIndex: 3 }, ctx)).toEqual({
      type: 'op',
      op: { type: 'place', slot: { pageId: 'page1', slotIndex: 3 }, placement: { printingId: 'px', notes: null } },
      label: 'Placed PX in slot 4',
    })
  })

  it('moves or swaps between slots, across pages too, and ignores drops on itself', () => {
    expect(resolveDrop({ kind: 'slot', pageId: 'page1', slotIndex: 0 }, { kind: 'slot', pageId: 'page1', slotIndex: 1 }, ctx)).toMatchObject({ type: 'op', op: { type: 'move' }, label: 'Swapped PA to slot 2' })
    expect(resolveDrop({ kind: 'slot', pageId: 'page1', slotIndex: 0 }, { kind: 'slot', pageId: 'page3', slotIndex: 0 }, ctx)).toMatchObject({ label: 'Moved PA to page 3, slot 1' })
    expect(resolveDrop({ kind: 'slot', pageId: 'page1', slotIndex: 0 }, { kind: 'slot', pageId: 'page1', slotIndex: 0 }, ctx)).toBeNull()
    expect(resolveDrop({ kind: 'slot', pageId: 'page1', slotIndex: 2 }, { kind: 'slot', pageId: 'page1', slotIndex: 0 }, ctx)).toBeNull()
  })

  it('drops onto a page tab into its first empty slot, or rejects a full page', () => {
    expect(resolveDrop({ kind: 'slot', pageId: 'page1', slotIndex: 0 }, { kind: 'page', pageId: 'page3' }, ctx)).toMatchObject({ op: { type: 'move', to: { pageId: 'page3', slotIndex: 0 } }, label: 'Moved PA to page 3' })
    expect(resolveDrop({ kind: 'printing', printingId: 'px' }, { kind: 'page', pageId: 'page1' }, ctx)).toMatchObject({ op: { type: 'place', slot: { pageId: 'page1', slotIndex: 2 } } })
    expect(resolveDrop({ kind: 'printing', printingId: 'px' }, { kind: 'page', pageId: 'page2' }, ctx)).toEqual({ type: 'reject', reason: 'Page 2 is full.' })
    expect(resolveDrop({ kind: 'slot', pageId: 'page1', slotIndex: 0 }, { kind: 'page', pageId: 'page1' }, ctx)).toBeNull()
  })

  it('reorders pages when a page tab is dropped on another', () => {
    expect(resolveDrop({ kind: 'page', pageId: 'page3' }, { kind: 'page', pageId: 'page1' }, ctx)).toEqual({ type: 'reorder', pageIds: ['page3', 'page1', 'page2'], label: 'Moved page 3 to position 1' })
    expect(resolveDrop({ kind: 'page', pageId: 'page1' }, { kind: 'page', pageId: 'page1' }, ctx)).toBeNull()
    expect(resolveDrop({ kind: 'page', pageId: 'page1' }, { kind: 'slot', pageId: 'page1', slotIndex: 0 }, ctx)).toBeNull()
  })
})

describe('guards and helpers', () => {
  it('validates drag/drop records from the library', () => {
    expect(isDragData({ kind: 'printing', printingId: 'x' })).toBe(true)
    expect(isDragData({ kind: 'slot', pageId: 'p', slotIndex: '0' })).toBe(false)
    expect(isDropData({ kind: 'page', pageId: 'p' })).toBe(true)
    expect(isDropData({ kind: 'printing', printingId: 'x' })).toBe(false)
    expect(isDragData(null)).toBe(false)
  })

  it('finds the first empty slot', () => {
    expect(firstEmptySlot({ id: 'page1', rows: 2, columns: 2 }, ctx.placements)).toBe(2)
    expect(firstEmptySlot({ id: 'page2', rows: 1, columns: 2 }, ctx.placements)).toBeNull()
  })
})
