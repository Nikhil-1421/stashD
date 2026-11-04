import { describe, expect, it } from 'vitest'
import { isValidDimension, planPages, remapPlacements, slotCount, slotIndex, toCoord } from './layout'

describe('slot math', () => {
  it('maps coordinates to indices and back for a 3×4 page', () => {
    expect(slotCount({ rows: 3, columns: 4 })).toBe(12)
    expect(slotIndex(0, 0, 4)).toBe(0)
    expect(slotIndex(1, 2, 4)).toBe(6)
    expect(slotIndex(2, 3, 4)).toBe(11)
    expect(toCoord(6, 4)).toEqual({ row: 1, col: 2 })
    expect(toCoord(11, 4)).toEqual({ row: 2, col: 3 })
  })

  it('accepts only whole numbers from 1 to 6', () => {
    expect([0, 1, 6, 7, 2.5].map(isValidDimension)).toEqual([false, true, true, false, false])
  })
})

describe('remapPlacements', () => {
  const items = [0, 1, 2, 3].map((i) => ({ slotIndex: i, item: `p${i}` })) // 2×2 full page

  it('keeps every placement at its coordinate when the page grows', () => {
    const out = remapPlacements(items, { rows: 2, columns: 2 }, { rows: 3, columns: 3 })
    expect(out.dropped).toEqual([])
    expect(out.kept.map((k) => [k.item, k.from, k.to])).toEqual([['p0', 0, 0], ['p1', 1, 1], ['p2', 2, 3], ['p3', 3, 4]])
  })

  it('reports what a shrink would drop without applying anything', () => {
    const out = remapPlacements(items, { rows: 2, columns: 2 }, { rows: 1, columns: 2 })
    expect(out.kept.map((k) => k.item)).toEqual(['p0', 'p1'])
    expect(out.dropped.map((d) => [d.item, d.from])).toEqual([['p2', 2], ['p3', 3]])
  })

  it('drops the right column when columns shrink even though indices stay in range', () => {
    const out = remapPlacements(items, { rows: 2, columns: 2 }, { rows: 2, columns: 1 })
    expect(out.kept.map((k) => [k.item, k.to])).toEqual([['p0', 0], ['p2', 1]])
    expect(out.dropped.map((d) => d.item)).toEqual(['p1', 'p3'])
  })
})

describe('planPages', () => {
  it('counts pages and the empty slots on the last page', () => {
    expect(planPages(20, { rows: 3, columns: 3 })).toEqual({ pages: 3, emptySlots: 7 })
    expect(planPages(9, { rows: 3, columns: 3 })).toEqual({ pages: 1, emptySlots: 0 })
    expect(planPages(0, { rows: 3, columns: 3 })).toEqual({ pages: 0, emptySlots: 0 })
  })
})
