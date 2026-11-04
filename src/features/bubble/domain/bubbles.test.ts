import { describe, expect, it } from 'vitest'
import type { CardStatus } from '@/features/collection/domain/completion'
import type { PrintingRef } from '@/features/collection/domain/requirements'
import { buildBubbles, filterBubbles, rangeKeys, sectionsOf, toggleWrites, variantSuffixes, type Bubble, type BubbleCard } from './bubbles'

const variants = [
  { id: 'v-base', name: 'Base' },
  { id: 'v-rev', name: 'Reverse Holo' },
  { id: 'v-holo', name: 'Holo' },
]
const cards: BubbleCard[] = [
  { id: 'c1', name: 'Bulbasaur', number: '1', rarity: 'Common' },
  { id: 'c2', name: 'Pikachu', number: '25', rarity: 'Rare' },
  { id: 'c3', name: 'Promo', number: null, rarity: null },
]
const printings: PrintingRef[] = [
  { id: 'p1b', cardId: 'c1', variantId: 'v-base', variantCategory: 'finish' },
  { id: 'p1r', cardId: 'c1', variantId: 'v-rev', variantCategory: 'finish' },
  { id: 'p2b', cardId: 'c2', variantId: 'v-base', variantCategory: 'finish' },
  { id: 'p2h', cardId: 'c2', variantId: 'v-holo', variantCategory: 'finish' },
]
const byCard = (entries: Record<string, { status: CardStatus; required: number; owned: number }>) => new Map(Object.entries(entries))

describe('variantSuffixes', () => {
  it('gives the primary variant no suffix and initials to the rest, disambiguating collisions', () => {
    const out = variantSuffixes([...variants, { id: 'v-hf', name: 'Holofoil' }, { id: 'v-x', name: '***' }])
    expect([...out.entries()]).toEqual([
      ['v-base', ''],
      ['v-rev', 'rh'],
      ['v-holo', 'h'],
      ['v-hf', 'h2'],
      ['v-x', 'v'],
    ])
  })
})

describe('buildBubbles', () => {
  it('builds one pill per printing in card then variant order, skipping cards without printings', () => {
    const out = buildBubbles({ unit: 'printing', cards, variants, printings, required: new Set(['p1b', 'p2b', 'p2h']), owned: new Map([['p2b', 2]]), byCard: new Map() })
    expect(out.map((b) => [b.label, b.state, b.quantity])).toEqual([
      ['1', 'missing', 0],
      ['1rh', 'excluded', 0],
      ['25', 'owned', 2],
      ['25h', 'missing', 0],
    ])
    expect(out[0]).toMatchObject({ key: 'printing:p1b', cardId: 'c1', printingIds: ['p1b'], variantName: 'Base', rarity: 'Common', required: true })
  })

  it('builds one pill per card from the completion summary', () => {
    const out = buildBubbles({ unit: 'card', cards, variants, printings, required: new Set(), owned: new Map(), byCard: byCard({ c1: { status: 'partial', required: 2, owned: 1 }, c2: { status: 'complete', required: 2, owned: 2 } }) })
    expect(out.map((b) => [b.key, b.label, b.state, b.quantity, b.printingIds])).toEqual([
      ['card:c1', '1', 'partial', 1, ['p1b', 'p1r']],
      ['card:c2', '25', 'complete', 2, ['p2b', 'p2h']],
    ])
  })

  it('falls back to the start of the name when a card has no number', () => {
    const out = buildBubbles({ unit: 'printing', cards, variants, printings: [{ id: 'p3', cardId: 'c3', variantId: 'v-rev', variantCategory: 'finish' }], required: new Set(['p3']), owned: new Map(), byCard: new Map() })
    expect(out[0]?.label).toBe('Promrh')
  })
})

describe('filterBubbles', () => {
  const all = buildBubbles({ unit: 'printing', cards, variants, printings, required: new Set(['p1b', 'p2b', 'p2h']), owned: new Map([['p2b', 1], ['p1r', 1]]), byCard: new Map() })
  const keys = (list: Bubble[]) => list.map((b) => b.key)

  it('filters by status, treating owned-but-excluded printings as owned', () => {
    expect(keys(filterBubbles(all, { status: 'missing', variantId: null, rarity: null, search: '' }))).toEqual(['printing:p1b', 'printing:p2h'])
    expect(keys(filterBubbles(all, { status: 'owned', variantId: null, rarity: null, search: '' }))).toEqual(['printing:p1r', 'printing:p2b'])
    expect(keys(filterBubbles(all, { status: 'excluded', variantId: null, rarity: null, search: '' }))).toEqual(['printing:p1r'])
  })

  it('filters by variant, rarity and a name/number search together', () => {
    expect(keys(filterBubbles(all, { status: 'all', variantId: 'v-base', rarity: null, search: '' }))).toEqual(['printing:p1b', 'printing:p2b'])
    expect(keys(filterBubbles(all, { status: 'all', variantId: null, rarity: 'Rare', search: '' }))).toEqual(['printing:p2b', 'printing:p2h'])
    expect(keys(filterBubbles(all, { status: 'all', variantId: null, rarity: null, search: 'pika' }))).toEqual(['printing:p2b', 'printing:p2h'])
    expect(keys(filterBubbles(all, { status: 'all', variantId: 'v-base', rarity: 'Rare', search: '25' }))).toEqual(['printing:p2b'])
  })
})

describe('rangeKeys', () => {
  const all = buildBubbles({ unit: 'printing', cards, variants, printings, required: new Set(), owned: new Map(), byCard: new Map() })
  it('returns the inclusive span in either direction and just the target without an anchor', () => {
    expect(rangeKeys(all, 'printing:p1r', 'printing:p2h')).toEqual(['printing:p1r', 'printing:p2b', 'printing:p2h'])
    expect(rangeKeys(all, 'printing:p2h', 'printing:p1r')).toEqual(['printing:p1r', 'printing:p2b', 'printing:p2h'])
    expect(rangeKeys(all, null, 'printing:p2b')).toEqual(['printing:p2b'])
    expect(rangeKeys(all, 'gone', 'printing:p2b')).toEqual(['printing:p2b'])
    expect(rangeKeys(all, null, 'gone')).toEqual([])
  })
})

describe('toggleWrites', () => {
  const required = new Set(['p1b', 'p2b'])
  it('flips a printing pill between 0 and 1', () => {
    const [missing, owned] = buildBubbles({ unit: 'printing', cards, variants, printings, required, owned: new Map([['p1r', 3]]), byCard: new Map() })
    expect(toggleWrites(missing!, new Map(), required)).toEqual([{ printingId: 'p1b', quantity: 1 }])
    expect(toggleWrites(owned!, new Map([['p1r', 3]]), required)).toEqual([{ printingId: 'p1r', quantity: 0 }])
  })

  it('completes a card by owning only its required printings, and clears every owned printing when complete', () => {
    const owned = new Map([['p2b', 1], ['p2h', 1]])
    const [c1, c2] = buildBubbles({ unit: 'card', cards, variants, printings, required, owned, byCard: byCard({ c1: { status: 'missing', required: 1, owned: 0 }, c2: { status: 'complete', required: 1, owned: 1 } }) })
    expect(toggleWrites(c1!, owned, required)).toEqual([{ printingId: 'p1b', quantity: 1 }])
    expect(toggleWrites(c2!, owned, required)).toEqual([{ printingId: 'p2b', quantity: 0 }, { printingId: 'p2h', quantity: 0 }])
  })

  it('owns every printing of a card that has no requirements at all', () => {
    const [c1] = buildBubbles({ unit: 'card', cards, variants, printings, required: new Set(), owned: new Map(), byCard: byCard({ c1: { status: 'excluded', required: 0, owned: 0 } }) })
    expect(toggleWrites(c1!, new Map(), new Set())).toEqual([{ printingId: 'p1b', quantity: 1 }, { printingId: 'p1r', quantity: 1 }])
  })
})

describe('sectionsOf', () => {
  const all = buildBubbles({ unit: 'printing', cards, variants, printings, required: new Set(), owned: new Map(), byCard: new Map() })
  it('splits into runs labelled by their first and last pill', () => {
    expect(sectionsOf(all, 3)).toEqual([
      { start: 0, end: 3, label: '1 – 25', shortLabel: '1' },
      { start: 3, end: 4, label: '25h', shortLabel: '25h' },
    ])
    expect(sectionsOf([], 3)).toEqual([])
    expect(sectionsOf(all, 0)).toEqual([])
  })
})
