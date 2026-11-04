import { describe, expect, it } from 'vitest'
import { detectPastePattern, parsePaste } from './paste'

describe('detectPastePattern', () => {
  it('recognises the built-in patterns', () => {
    expect(detectPastePattern('001 - Bulbasaur\n002 - Ivysaur')).toBe('number-dash-name')
    expect(detectPastePattern('Bulbasaur (001)\nIvysaur (002) - Reverse Holo')).toBe('name-paren-number')
    expect(detectPastePattern('001\tBulbasaur\tBase\n002\tIvysaur\tReverse Holo')).toBe('tabbed')
    expect(detectPastePattern('Bulbasaur\nIvysaur')).toBe('name-only')
    expect(detectPastePattern('')).toBe('name-only')
  })
})

describe('parsePaste', () => {
  it('parses "001 - Name" with an optional trailing variant', () => {
    expect(parsePaste('001 - Bulbasaur\n002 - Ivysaur - Reverse Holo\n', 'number-dash-name')).toEqual([
      { line: 1, raw: '001 - Bulbasaur', number: '001', name: 'Bulbasaur' },
      { line: 2, raw: '002 - Ivysaur - Reverse Holo', number: '002', name: 'Ivysaur', variant: 'Reverse Holo' },
    ])
  })

  it('keeps hyphens inside names', () => {
    const [line] = parsePaste('TG01 - Ho-Oh', 'number-dash-name')
    expect(line).toMatchObject({ number: 'TG01', name: 'Ho-Oh' })
  })

  it('parses "Name (001) - Variant"', () => {
    expect(parsePaste('Ivysaur (002) - Reverse Holo', 'name-paren-number')[0]).toMatchObject({ number: '002', name: 'Ivysaur', variant: 'Reverse Holo' })
    expect(parsePaste("Farfetch'd (027)", 'name-paren-number')[0]).toMatchObject({ number: '027', name: "Farfetch'd" })
  })

  it('parses the reference clipboard export (tab separated)', () => {
    expect(parsePaste('001\tBulbasaur\tReverse Holo\n002\tIvysaur', 'tabbed')).toEqual([
      { line: 1, raw: '001\tBulbasaur\tReverse Holo', number: '001', name: 'Bulbasaur', variant: 'Reverse Holo' },
      { line: 2, raw: '002\tIvysaur', number: '002', name: 'Ivysaur' },
    ])
  })

  it('reports lines that do not match, with their line numbers', () => {
    const lines = parsePaste('001 - Bulbasaur\n\njust words\n', 'number-dash-name')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatchObject({ line: 3, error: 'Expected: 001 - Card Name' })
  })

  it('auto mode picks the detected pattern', () => {
    expect(parsePaste('Bulbasaur (001)', 'auto')[0]).toMatchObject({ number: '001', name: 'Bulbasaur' })
  })
})
