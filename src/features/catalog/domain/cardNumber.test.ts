import { describe, expect, it } from 'vitest'
import { cardNumberSortKey, compareCards } from './cardNumber'

describe('cardNumberSortKey', () => {
  it('pads digit runs so numeric order wins', () => {
    const keys = ['2', '10', '1', '100'].map(cardNumberSortKey)
    expect([...keys].sort()).toEqual(['1', '2', '10', '100'].map(cardNumberSortKey))
  })
  it('keeps prefixes and suffixes and lower-cases', () => {
    expect(cardNumberSortKey('SV012a')).toBe('sv0000000012a')
    expect(cardNumberSortKey('TG01')).toBe('tg0000000001')
  })
  it('matches the SQL ordering expectation 2 < 10 < TG01', () => {
    const keys = ['2', '10', 'TG01'].map((n) => cardNumberSortKey(n) ?? '')
    const a = keys[0] ?? ''
    const b = keys[1] ?? ''
    const c = keys[2] ?? ''
    expect(a < b && b < c).toBe(true)
  })
  it('returns null for a missing number', () => {
    expect(cardNumberSortKey(null)).toBeNull()
    expect(cardNumberSortKey(undefined)).toBeNull()
  })
})

describe('compareCards', () => {
  const card = (number: string | null, name = 'x', position = 0) => ({ number, name, position })
  it('sorts by number naturally, with unnumbered cards last', () => {
    const sorted = [card('10'), card(null, 'z'), card('2'), card('1a')].sort(compareCards)
    expect(sorted.map((c) => c.number)).toEqual(['1a', '2', '10', null])
  })
  it('falls back to position then name', () => {
    const sorted = [card('1', 'b', 1), card('1', 'a', 1), card('1', 'c', 0)].sort(compareCards)
    expect(sorted.map((c) => c.name)).toEqual(['c', 'a', 'b'])
  })
})
