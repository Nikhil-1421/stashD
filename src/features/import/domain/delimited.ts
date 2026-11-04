/**
 * RFC 4180 CSV/TSV parser with delimiter auto-detection and BOM tolerance.
 * Pure and dependency-free; the whole text is in memory (checklists are at most a few MB).
 */

export type Delimiter = ',' | '\t' | ';' | '|'
export const DELIMITERS: readonly Delimiter[] = [',', '\t', ';', '|']

export type DelimitedResult = { delimiter: Delimiter; rows: string[][] }

/** Picks the delimiter that appears most consistently across the first non-empty lines. */
export function detectDelimiter(text: string): Delimiter {
  const sample = stripBom(text)
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim() !== '')
    .slice(0, 20)
  if (sample.length === 0) return ','
  let best: { delimiter: Delimiter; score: number } = { delimiter: ',', score: -1 }
  for (const delimiter of DELIMITERS) {
    const counts = sample.map((line) => countOutsideQuotes(line, delimiter))
    const first = counts[0] ?? 0
    if (first === 0) continue
    const consistent = counts.filter((c) => c === first).length
    // Prefer delimiters that split every sampled line the same way; break ties by column count.
    const score = consistent * 1000 + first
    if (score > best.score) best = { delimiter, score }
  }
  return best.delimiter
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === delimiter && !quoted) count += 1
  }
  return count
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function parseDelimited(input: string, delimiter: Delimiter | 'auto' = 'auto'): DelimitedResult {
  const text = stripBom(input)
  const sep = delimiter === 'auto' ? detectDelimiter(text) : delimiter
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0

  while (i < text.length) {
    const ch = text[i] as string
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"' && field === '') {
      quoted = true
      i += 1
      continue
    }
    if (ch === sep) {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\r' || ch === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1
      continue
    }
    field += ch
    i += 1
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Drop rows that are entirely blank (trailing newline, spacer lines).
  return { delimiter: sep, rows: rows.filter((r) => r.some((cell) => cell.trim() !== '')) }
}
