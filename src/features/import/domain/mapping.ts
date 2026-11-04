/**
 * Column → field mapping for tabular imports (CSV/TSV/JSON rows).
 * Header aliases follow docs/IMPORT_FORMATS.md; matching is case/space/punctuation-insensitive.
 */

export const IMPORT_FIELDS = ['number', 'name', 'rarity', 'variant', 'quantity', 'condition', 'notes', 'language', 'artist', 'external_id', 'ignore'] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  number: 'Number',
  name: 'Name',
  rarity: 'Rarity',
  variant: 'Variant',
  quantity: 'Quantity (owned)',
  condition: 'Condition',
  notes: 'Notes',
  language: 'Language',
  artist: 'Artist',
  external_id: 'External ID',
  ignore: 'Ignore column',
}

/** Fields the checklist importer writes today. Ownership columns are recognised but not imported until phase 4. */
export const IMPORTED_FIELDS: readonly ImportField[] = ['number', 'name', 'rarity', 'variant', 'artist', 'language', 'external_id']

const ALIASES: Record<Exclude<ImportField, 'ignore'>, readonly string[]> = {
  number: ['number', 'no', '#', 'num', 'cardnumber', 'card#', 'collectornumber', 'setnumber', 'id'],
  name: ['name', 'card', 'cardname', 'title', 'player', 'character'],
  rarity: ['rarity', 'rare', 'tier'],
  variant: ['variant', 'finish', 'parallel', 'printing', 'edition', 'foil', 'treatment', 'subset'],
  quantity: ['quantity', 'qty', 'count', 'owned', 'have'],
  condition: ['condition', 'cond', 'grade'],
  notes: ['notes', 'note', 'comment', 'comments', 'memo'],
  language: ['language', 'lang'],
  artist: ['artist', 'illustrator'],
  external_id: ['externalid', 'external', 'providerid', 'tcgdexid', 'scryfallid', 'uuid'],
}

export function normaliseHeader(header: string): string {
  return header
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9#]/g, '')
}

export function fieldForHeader(header: string): ImportField {
  const key = normaliseHeader(header)
  if (key === '') return 'ignore'
  for (const [field, aliases] of Object.entries(ALIASES) as [Exclude<ImportField, 'ignore'>, readonly string[]][]) {
    if (aliases.includes(key)) return field
  }
  return 'ignore'
}

/** One field per column, in column order. A field maps to at most one column (first wins). */
export function detectMapping(headers: readonly string[]): ImportField[] {
  const used = new Set<ImportField>()
  return headers.map((h) => {
    const field = fieldForHeader(h)
    if (field === 'ignore' || used.has(field)) return 'ignore'
    used.add(field)
    return field
  })
}

/** Heuristic: a first row is a header when at least one cell matches a known alias and no cell looks like a bare card number followed by a name. */
export function looksLikeHeader(row: readonly string[]): boolean {
  return row.some((cell) => fieldForHeader(cell) !== 'ignore')
}

export type MappedRow = Partial<Record<Exclude<ImportField, 'ignore'>, string>> & { line: number }

/** Applies a mapping to raw rows; `line` is 1-based and counts the header row when present. */
export function applyMapping(rows: readonly (readonly string[])[], mapping: readonly ImportField[], hasHeader: boolean): MappedRow[] {
  const body = hasHeader ? rows.slice(1) : rows
  const offset = hasHeader ? 2 : 1
  return body.map((cells, index) => {
    const out: MappedRow = { line: index + offset }
    mapping.forEach((field, column) => {
      if (field === 'ignore') return
      const value = (cells[column] ?? '').trim()
      if (value !== '') out[field] = value
    })
    return out
  })
}

/** Mapping is usable when a name column exists. */
export function mappingIssues(mapping: readonly ImportField[]): string[] {
  const issues: string[] = []
  if (!mapping.includes('name')) issues.push('Choose which column holds the card name.')
  return issues
}
