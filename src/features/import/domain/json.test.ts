import { describe, expect, it } from 'vitest'
import { parseJsonRows } from './json'

describe('parseJsonRows', () => {
  it('turns an array of objects into headers and rows', () => {
    expect(parseJsonRows('[{"number":"1","name":"A"},{"name":"B","rarity":"R","qty":2}]')).toEqual({
      headers: ['number', 'name', 'rarity', 'qty'],
      rows: [['1', 'A', '', ''], ['', 'B', 'R', '2']],
    })
  })

  it('accepts an object with a cards array', () => {
    expect(parseJsonRows('{"schemaVersion":1,"cards":[{"name":"A"}]}').rows).toEqual([['A']])
  })

  it('rejects invalid shapes with a readable message', () => {
    expect(() => parseJsonRows('nope')).toThrow(/not valid JSON/)
    expect(() => parseJsonRows('{"x":1}')).toThrow(/Expected a JSON array/)
    expect(() => parseJsonRows('[1,2]')).toThrow(/must be an object/)
  })
})
