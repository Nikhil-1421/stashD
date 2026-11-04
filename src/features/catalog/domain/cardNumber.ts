/**
 * Natural sort for card numbers. Mirrors the SQL function `card_number_sort_key` exactly so client
 * and server order cards the same way: digit runs are left-padded to 10 characters, everything is
 * lower-cased. "2" < "10" < "TG01"; "SV012a" → "sv0000000012a".
 */
export function cardNumberSortKey(number: string | null | undefined): string | null {
  if (number === null || number === undefined) return null
  let out = ''
  for (const m of number.toLowerCase().matchAll(/(\D*)(\d*)/g)) {
    const text = m[1] ?? ''
    const digits = m[2] ?? ''
    out += text + (digits === '' ? '' : digits.padStart(10, '0'))
  }
  return out
}

/** Comparator for cards: by sort key (nulls last), then position, then name. */
export function compareCards(
  a: { number: string | null; position: number; name: string },
  b: { number: string | null; position: number; name: string },
): number {
  const ka = cardNumberSortKey(a.number)
  const kb = cardNumberSortKey(b.number)
  if (ka !== kb) {
    if (ka === null) return 1
    if (kb === null) return -1
    return ka < kb ? -1 : 1
  }
  if (a.position !== b.position) return a.position - b.position
  return a.name.localeCompare(b.name)
}
