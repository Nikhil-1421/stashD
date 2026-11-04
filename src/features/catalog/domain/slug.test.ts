import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('produces lower-case dash-separated slugs', () => {
    expect(slugify('Reverse Holo')).toBe('reverse-holo')
    expect(slugify('  1st Edition!! ')).toBe('1st-edition')
    expect(slugify('Pokéball')).toBe('pokeball')
  })
  it('never returns an empty slug and respects the 40-char limit', () => {
    expect(slugify('***', 'variant')).toBe('variant')
    expect(slugify('a'.repeat(60))).toHaveLength(40)
  })
})
