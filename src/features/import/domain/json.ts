/**
 * JSON import: an array of flat row objects (keys become headers) or a stashD backup
 * (`schemaVersion` + `cards`), reduced to the same header/rows shape as a delimited file.
 */
export type TabularInput = { headers: string[]; rows: string[][] }

export function parseJsonRows(text: string): TabularInput {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('The file is not valid JSON.')
  }
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.cards)
      ? value.cards
      : null
  if (!list) throw new Error('Expected a JSON array of card objects, or an object with a "cards" array.')
  const records = list.filter(isRecord)
  if (records.length !== list.length) throw new Error('Every item in the JSON array must be an object.')
  const headers: string[] = []
  for (const record of records) for (const key of Object.keys(record)) if (!headers.includes(key)) headers.push(key)
  const rows = records.map((record) => headers.map((h) => stringify(record[h])))
  return { headers, rows }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}
