import { describe, expect, it } from 'vitest'
import { computeCompletion } from './completion'
import type { PrintingRef } from './requirements'

const printings: PrintingRef[] = [
  { id: 'p1', cardId: 'c1', variantId: 'base', variantCategory: 'finish' },
  { id: 'p2', cardId: 'c1', variantId: 'reverse', variantCategory: 'finish' },
  { id: 'p3', cardId: 'c2', variantId: 'base', variantCategory: 'finish' },
  { id: 'p4', cardId: 'c3', variantId: 'base', variantCategory: 'finish' },
]

describe('computeCompletion', () => {
  it('counts owned required printings and classifies cards', () => {
    const required = new Set(['p1', 'p2', 'p3', 'p4'])
    const owned = new Map([['p1', 1], ['p3', 3]])
    const c = computeCompletion(printings, required, owned)
    expect(c).toMatchObject({ required: 4, owned: 2, missing: 2, extra: 0, totalQuantity: 4, percent: 50 })
    expect(c.byCard.get('c1')).toEqual({ status: 'partial', required: 2, owned: 1 })
    expect(c.byCard.get('c2')).toEqual({ status: 'complete', required: 1, owned: 1 })
    expect(c.byCard.get('c3')).toEqual({ status: 'missing', required: 1, owned: 0 })
  })

  it('treats owned-but-not-required printings as extras and excluded cards as excluded', () => {
    const required = new Set(['p1', 'p3'])
    const owned = new Map([['p2', 1], ['p4', 2]])
    const c = computeCompletion(printings, required, owned)
    expect(c).toMatchObject({ required: 2, owned: 0, missing: 2, extra: 2, totalQuantity: 3, percent: 0 })
    expect(c.byCard.get('c3')?.status).toBe('excluded')
    expect(c.byCard.get('c1')?.status).toBe('missing')
  })

  it('ignores quantity 0 rows and rounds percent to one decimal', () => {
    const c = computeCompletion(printings.slice(0, 3), new Set(['p1', 'p2', 'p3']), new Map([['p1', 0], ['p2', 1]]))
    expect(c.owned).toBe(1)
    expect(c.percent).toBe(33.3)
  })

  it('is 0 % with nothing required', () => {
    expect(computeCompletion(printings, new Set(), new Map([['p1', 1]])).percent).toBe(0)
  })
})
