import { describe, expect, it } from 'vitest'
import { applyMapping, detectMapping, fieldForHeader, looksLikeHeader, mappingIssues } from './mapping'

describe('fieldForHeader', () => {
  it('matches aliases regardless of case, spaces and punctuation', () => {
    expect(fieldForHeader('Card Number')).toBe('number')
    expect(fieldForHeader('#')).toBe('number')
    expect(fieldForHeader('No.')).toBe('number')
    expect(fieldForHeader(' NAME ')).toBe('name')
    expect(fieldForHeader('Qty')).toBe('quantity')
    expect(fieldForHeader('External_ID')).toBe('external_id')
    expect(fieldForHeader('Finish')).toBe('variant')
    expect(fieldForHeader('Price')).toBe('ignore')
  })
})

describe('detectMapping', () => {
  it('assigns each field at most once', () => {
    expect(detectMapping(['#', 'Number', 'Name', 'Card', 'Rarity'])).toEqual(['number', 'ignore', 'name', 'ignore', 'rarity'])
  })

  it('flags a mapping without a name column', () => {
    expect(mappingIssues(['number', 'rarity'])).toEqual(['Choose which column holds the card name.'])
    expect(mappingIssues(['number', 'name'])).toEqual([])
  })
})

describe('looksLikeHeader', () => {
  it('is true when any cell is a recognised header', () => {
    expect(looksLikeHeader(['#', 'Card', 'Foo'])).toBe(true)
    expect(looksLikeHeader(['001', 'Bulbasaur', 'Common'])).toBe(false)
  })
})

describe('applyMapping', () => {
  it('keeps line numbers aligned with the source file', () => {
    const rows = [['#', 'Name'], ['1', 'A'], ['2', ' B ']]
    expect(applyMapping(rows, ['number', 'name'], true)).toEqual([
      { line: 2, number: '1', name: 'A' },
      { line: 3, number: '2', name: 'B' },
    ])
    expect(applyMapping(rows.slice(1), ['number', 'name'], false)).toEqual([
      { line: 1, number: '1', name: 'A' },
      { line: 2, number: '2', name: 'B' },
    ])
  })

  it('omits empty cells and ignored columns', () => {
    expect(applyMapping([['1', '', 'x']], ['number', 'name', 'ignore'], false)).toEqual([{ line: 1, number: '1' }])
  })
})
