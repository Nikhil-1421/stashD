import type { MappedRow } from './mapping'

/**
 * Multiline paste parser. Each line is one card (optionally one printing of a card).
 * Patterns are the ones the reference app and common community lists use.
 */
export const PASTE_PATTERNS = ['auto', 'number-dash-name', 'name-paren-number', 'tabbed', 'name-only'] as const
export type PastePattern = (typeof PASTE_PATTERNS)[number]

export const PASTE_PATTERN_LABELS: Record<PastePattern, { label: string; example: string }> = {
  auto: { label: 'Detect automatically', example: '' },
  'number-dash-name': { label: 'Number - Name', example: '001 - Bulbasaur\n002 - Ivysaur - Reverse Holo' },
  'name-paren-number': { label: 'Name (Number) - Variant', example: 'Bulbasaur (001)\nIvysaur (002) - Reverse Holo' },
  tabbed: { label: 'Tab separated: Number ⇥ Name ⇥ Variant', example: '001\tBulbasaur\n002\tIvysaur\tReverse Holo' },
  'name-only': { label: 'One name per line', example: 'Bulbasaur\nIvysaur' },
}

export type PasteLine = MappedRow & { raw: string; error?: string }

const NUMBER_DASH_NAME = /^\s*([^\s–—-][^\t–—-]*?)\s*[–—-]\s+(.+?)\s*$/
const NAME_PAREN_NUMBER = /^\s*(.+?)\s*\(([^()]+)\)\s*(?:[–—-]\s*(.+?))?\s*$/
const TRAILING_VARIANT = /^(.*?)\s+[–—-]\s+(.+?)$/

export function detectPastePattern(text: string): Exclude<PastePattern, 'auto'> {
  const lines = nonEmptyLines(text).slice(0, 20)
  if (lines.length === 0) return 'name-only'
  const score = (test: (l: string) => boolean) => lines.filter(test).length / lines.length
  if (score((l) => l.includes('\t')) >= 0.8) return 'tabbed'
  if (score((l) => NAME_PAREN_NUMBER.test(l)) >= 0.8) return 'name-paren-number'
  if (score((l) => NUMBER_DASH_NAME.test(l)) >= 0.8) return 'number-dash-name'
  return 'name-only'
}

export function parsePaste(text: string, pattern: PastePattern): PasteLine[] {
  const resolved = pattern === 'auto' ? detectPastePattern(text) : pattern
  return text.split(/\r\n|\r|\n/).reduce<PasteLine[]>((out, raw, index) => {
    if (raw.trim() === '') return out
    out.push({ ...parseLine(raw, resolved), raw, line: index + 1 })
    return out
  }, [])
}

function parseLine(raw: string, pattern: Exclude<PastePattern, 'auto'>): Omit<PasteLine, 'raw' | 'line'> {
  switch (pattern) {
    case 'tabbed': {
      const [number = '', name = '', variant = ''] = raw.split('\t').map((s) => s.trim())
      if (name === '') return { error: 'Expected: number ⇥ name ⇥ variant' }
      return withOptional({ name }, { number, variant })
    }
    case 'number-dash-name': {
      const m = NUMBER_DASH_NAME.exec(raw)
      if (!m) return { error: 'Expected: 001 - Card Name' }
      const [, number = '', rest = ''] = m
      const split = TRAILING_VARIANT.exec(rest)
      const name = split ? (split[1] ?? '') : rest
      return withOptional({ name: name.trim() }, { number: number.trim(), variant: split?.[2] ?? '' })
    }
    case 'name-paren-number': {
      const m = NAME_PAREN_NUMBER.exec(raw)
      if (!m) return { error: 'Expected: Card Name (001) - Variant' }
      const [, name = '', number = '', variant = ''] = m
      return withOptional({ name: name.trim() }, { number: number.trim(), variant: variant.trim() })
    }
    case 'name-only':
      return { name: raw.trim() }
  }
}

function withOptional(base: { name: string }, extra: { number: string; variant: string }): Omit<PasteLine, 'raw' | 'line'> {
  const out: Omit<PasteLine, 'raw' | 'line'> = { ...base }
  if (extra.number !== '') out.number = extra.number
  if (extra.variant !== '') out.variant = extra.variant
  return out
}

function nonEmptyLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '')
}
