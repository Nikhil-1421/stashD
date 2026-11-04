import type { Bubble } from './bubbles'

/**
 * Clipboard export formats. The first two match the reference app's copy formats; `tab` is its
 * spreadsheet export (header line, a rule, then `#\tName\tVariant` rows). Pure.
 */
export type CopyFormat = 'number-name' | 'name-number-variant' | 'tab'

export const COPY_FORMATS: readonly { value: CopyFormat; label: string; example: string }[] = [
  { value: 'number-name', label: 'Number - Name', example: '001 - Bulbasaur' },
  { value: 'name-number-variant', label: 'Name (Number) - Variant', example: 'Bulbasaur (001) - Reverse Holo' },
  { value: 'tab', label: 'Tab-separated (spreadsheet)', example: '#\tName\tVariant' },
]

export function isCopyFormat(v: unknown): v is CopyFormat {
  return COPY_FORMATS.some((f) => f.value === v)
}

export function formatBubbles(bubbles: readonly Bubble[], format: CopyFormat, heading: { setName: string; listName: string }): string {
  switch (format) {
    case 'number-name':
      return bubbles.map((b) => `${b.number ? `${b.number} - ` : ''}${b.name}${variantTail(b)}`).join('\n')
    case 'name-number-variant':
      return bubbles.map((b) => `${b.name}${b.number ? ` (${b.number})` : ''}${variantTail(b)}`).join('\n')
    case 'tab': {
      const lines = [`${heading.setName} - ${heading.listName} (${bubbles.length})`, '---', '#\tName\tVariant']
      for (const b of bubbles) lines.push(`${b.number ?? ''}\t${b.name}\t${b.variantName ?? ''}`)
      return lines.join('\n')
    }
  }
}

/** The variant is only worth naming when the bubble is a non-primary printing (its label carries a suffix). */
function variantTail(b: Bubble): string {
  if (b.variantName === null) return ''
  const hasSuffix = b.number !== null ? b.label !== b.number : b.label.length > b.name.slice(0, 4).length
  return hasSuffix ? ` - ${b.variantName}` : ''
}
