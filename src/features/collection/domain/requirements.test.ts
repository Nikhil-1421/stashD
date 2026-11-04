import { describe, expect, it } from 'vitest'
import { isPrintingRequired, resolveRequired, ruleFor, type PrintingRef } from './requirements'

const p = (id: string, cardId: string, variantId: string, variantCategory = 'finish'): PrintingRef => ({ id, cardId, variantId, variantCategory })
const base1 = p('p1', 'c1', 'base')
const rev1 = p('p2', 'c1', 'reverse')
const base2 = p('p3', 'c2', 'base')
const promo2 = p('p4', 'c2', 'promo-stamp', 'promo')

describe('resolveRequired', () => {
  it('requires everything when there are no rules', () => {
    expect(resolveRequired([base1, rev1, base2, promo2], [])).toEqual(new Set(['p1', 'p2', 'p3', 'p4']))
  })

  it('excludes by variant and by category', () => {
    expect(resolveRequired([base1, rev1, base2, promo2], [{ scope: 'variant', target: 'reverse', action: 'exclude' }])).toEqual(new Set(['p1', 'p3', 'p4']))
    expect(resolveRequired([base1, rev1, base2, promo2], [{ scope: 'variant_category', target: 'promo', action: 'exclude' }])).toEqual(new Set(['p1', 'p2', 'p3']))
  })

  it('lets a more specific rule override a coarser one', () => {
    const rules = [
      { scope: 'variant', target: 'reverse', action: 'exclude' },
      { scope: 'printing', target: 'p2', action: 'include' },
      { scope: 'variant_category', target: 'finish', action: 'exclude' },
      { scope: 'card', target: 'c2', action: 'include' },
    ] as const
    expect(isPrintingRequired(rev1, rules)).toBe(true) // printing include beats variant exclude
    expect(isPrintingRequired(base1, rules)).toBe(false) // category exclude, nothing more specific
    expect(isPrintingRequired(base2, rules)).toBe(true) // card include beats category exclude
  })

  it('builds the rule for a desired state', () => {
    expect(ruleFor('variant', 'reverse', false)).toEqual({ scope: 'variant', target: 'reverse', action: 'exclude' })
    expect(ruleFor('printing', 'p2', true)).toEqual({ scope: 'printing', target: 'p2', action: 'include' })
  })
})
