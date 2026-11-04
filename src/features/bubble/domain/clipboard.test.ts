import { describe, expect, it } from 'vitest'
import { buildBubbles } from './bubbles'
import { formatBubbles } from './clipboard'

const bubbles = buildBubbles({
  unit: 'printing',
  cards: [
    { id: 'c1', name: 'Bulbasaur', number: '001', rarity: null },
    { id: 'c2', name: 'Promo Pikachu', number: null, rarity: null },
  ],
  variants: [
    { id: 'v-base', name: 'Base' },
    { id: 'v-rev', name: 'Reverse Holo' },
  ],
  printings: [
    { id: 'p1b', cardId: 'c1', variantId: 'v-base', variantCategory: 'finish' },
    { id: 'p1r', cardId: 'c1', variantId: 'v-rev', variantCategory: 'finish' },
    { id: 'p2b', cardId: 'c2', variantId: 'v-base', variantCategory: 'finish' },
  ],
  required: new Set(['p1b', 'p1r', 'p2b']),
  owned: new Map(),
  byCard: new Map(),
})
const heading = { setName: 'Base Set', listName: 'Missing' }

describe('formatBubbles', () => {
  it('writes "number - name", naming the variant only for non-primary printings', () => {
    expect(formatBubbles(bubbles, 'number-name', heading)).toBe('001 - Bulbasaur\n001 - Bulbasaur - Reverse Holo\nPromo Pikachu')
  })

  it('writes "name (number) - variant"', () => {
    expect(formatBubbles(bubbles, 'name-number-variant', heading)).toBe('Bulbasaur (001)\nBulbasaur (001) - Reverse Holo\nPromo Pikachu')
  })

  it('writes the tab-separated export with a heading, a rule and a header row', () => {
    expect(formatBubbles(bubbles, 'tab', heading)).toBe(['Base Set - Missing (3)', '---', '#\tName\tVariant', '001\tBulbasaur\tBase', '001\tBulbasaur\tReverse Holo', '\tPromo Pikachu\tBase'].join('\n'))
  })

  it('produces an empty string for an empty list in the line formats', () => {
    expect(formatBubbles([], 'number-name', heading)).toBe('')
  })
})
