import { describe, expect, it } from 'vitest'
import { buildImportPlan, MAX_IMPORT_ROWS, planIsCommittable, toImportPayload } from './plan'

const base = { id: 'v-base', slug: 'base', name: 'Base' }

describe('buildImportPlan', () => {
  it('groups lines by card and collects variants as printings', () => {
    const plan = buildImportPlan(
      [
        { line: 1, number: '001', name: 'Bulbasaur' },
        { line: 2, number: '001', name: 'Bulbasaur', variant: 'Reverse Holo' },
        { line: 3, number: '002', name: 'Ivysaur', variant: 'Reverse Holo' },
      ],
      [],
      [base],
    )
    expect(plan.cards).toHaveLength(2)
    expect(plan.cards[0]).toMatchObject({ number: '001', name: 'Bulbasaur', variants: ['reverse-holo'], lines: [1, 2], existingId: null })
    expect(plan.variants).toEqual([{ slug: 'reverse-holo', name: 'Reverse Holo' }])
    expect(plan.newVariants).toEqual([{ slug: 'reverse-holo', name: 'Reverse Holo' }])
    expect(plan.counts).toMatchObject({ rows: 3, cards: 2, newCards: 2, existingCards: 0, printings: 2, duplicates: 0, invalid: 0 })
  })

  it('matches existing cards by number first, then by name when there is no number', () => {
    const plan = buildImportPlan(
      [
        { line: 1, number: '25', name: 'Pikachu (renamed)' },
        { line: 2, name: 'Raichu' },
        { line: 3, number: '27', name: 'Raichu' },
      ],
      [
        { id: 'c-25', name: 'Pikachu', number: '25' },
        { id: 'c-26', name: 'Raichu', number: '26' },
      ],
      [base],
    )
    expect(plan.cards.map((c) => [c.existingId, c.matchedBy])).toEqual([
      ['c-25', 'number'],
      ['c-26', 'name'],
      [null, null],
    ])
    expect(plan.counts).toMatchObject({ newCards: 1, existingCards: 2 })
  })

  it('uses the existing variant name when the slug already exists', () => {
    const plan = buildImportPlan([{ line: 1, name: 'A', variant: 'reverse holo' }], [], [{ id: 'v', slug: 'reverse-holo', name: 'Reverse Holo' }])
    expect(plan.variants).toEqual([{ slug: 'reverse-holo', name: 'Reverse Holo' }])
    expect(plan.newVariants).toEqual([])
  })

  it('flags invalid rows and exact duplicates without dropping other rows', () => {
    const plan = buildImportPlan(
      [
        { line: 1, number: '1' },
        { line: 2, number: '2', name: 'B' },
        { line: 3, number: '2', name: 'B' },
        { line: 4, name: 'x'.repeat(201) },
      ],
      [],
      [],
    )
    expect(plan.issues).toEqual([
      { line: 1, message: 'Missing card name.' },
      { line: 4, message: 'Name is longer than 200 characters.' },
    ])
    expect(plan.duplicateLines).toEqual([{ line: 3, message: 'Repeats line 2.' }])
    expect(plan.cards).toHaveLength(1)
    expect(plan.counts).toMatchObject({ invalid: 2, duplicates: 1 })
  })

  it('refuses plans over the row limit or with nothing to import', () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({ line: i + 1, name: `Card ${i}` }))
    const tooMany = buildImportPlan(rows, [], [])
    expect(planIsCommittable(tooMany)).toBe(false)
    expect(tooMany.issues[0]?.message).toMatch(/limited to 5000 rows/)
    expect(planIsCommittable(buildImportPlan([], [], []))).toBe(false)
  })

  it('produces the RPC payload shape', () => {
    const plan = buildImportPlan([{ line: 1, number: '1', name: 'A', rarity: 'Rare', variant: 'Holo', artist: 'Ken' }], [{ id: 'c1', name: 'A', number: '1' }], [])
    expect(toImportPayload(plan)).toEqual({
      cards: [{ name: 'A', number: '1', rarity: 'Rare', artist: 'Ken', language: null, external_id: null, variants: ['holo'], existing_id: 'c1' }],
      variants: [{ slug: 'holo', name: 'Holo' }],
    })
  })
})
