import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseDelimited } from './delimited'

describe('parseDelimited', () => {
  it('parses RFC 4180 quoting, escaped quotes and CRLF', () => {
    const text = '#,Name,Rarity\r\n1,"Pikachu, Jr.",Common\r\n2,"Say ""hi""",Rare\r\n'
    const { delimiter, rows } = parseDelimited(text)
    expect(delimiter).toBe(',')
    expect(rows).toEqual([
      ['#', 'Name', 'Rarity'],
      ['1', 'Pikachu, Jr.', 'Common'],
      ['2', 'Say "hi"', 'Rare'],
    ])
  })

  it('handles newlines inside quoted fields', () => {
    const { rows } = parseDelimited('name,notes\nA,"line1\nline2"\nB,x')
    expect(rows).toEqual([['name', 'notes'], ['A', 'line1\nline2'], ['B', 'x']])
  })

  it('strips a UTF-8 BOM and skips blank lines', () => {
    const { rows } = parseDelimited('﻿name\nA\n\n   \nB\n')
    expect(rows).toEqual([['name'], ['A'], ['B']])
  })

  it('auto-detects tabs and semicolons', () => {
    expect(detectDelimiter('1\tA\n2\tB')).toBe('\t')
    expect(detectDelimiter('1;A;x\n2;B;y')).toBe(';')
    expect(parseDelimited('1\tA\n2\tB').rows).toEqual([['1', 'A'], ['2', 'B']])
  })

  it('does not count delimiters inside quotes when detecting', () => {
    expect(detectDelimiter('"a;b"\t1\n"c;d"\t2')).toBe('\t')
  })

  it('honours an explicit delimiter', () => {
    expect(parseDelimited('a,b|c', '|').rows).toEqual([['a,b', 'c']])
  })

  it('returns no rows for empty input', () => {
    expect(parseDelimited('').rows).toEqual([])
  })
})
