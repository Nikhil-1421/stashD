import { slugify } from '@/features/catalog/domain/slug'
import type { MappedRow } from './mapping'

/**
 * Turns mapped rows into a reviewable, committable import plan.
 * Nothing here touches the network: existing cards/variants are passed in, and the output is the
 * exact payload `import_checklist()` receives, so what the user reviews is what gets written.
 */

export type ConflictStrategy = 'skip' | 'update' | 'create'
export const CONFLICT_STRATEGIES: readonly { value: ConflictStrategy; label: string; description: string }[] = [
  { value: 'skip', label: 'Skip existing cards', description: 'Leave matched cards untouched; only their new variants are added.' },
  { value: 'update', label: 'Update existing cards', description: 'Fill name, number and rarity from the file where the file has a value.' },
  { value: 'create', label: 'Create duplicates', description: 'Insert every row as a new card, even when one with the same number exists.' },
]

export type ExistingCard = { id: string; name: string; number: string | null }
export type ExistingVariant = { id: string; slug: string; name: string }

export type PlannedVariant = { slug: string; name: string }

export type PlannedCard = {
  key: string
  lines: number[]
  name: string
  number: string | null
  rarity: string | null
  artist: string | null
  language: string | null
  externalId: string | null
  /** Variant slugs this card is listed in. Empty = default variants only (DB trigger). */
  variants: string[]
  existingId: string | null
  /** Matched by number (strong) or by name only (weak). */
  matchedBy: 'number' | 'name' | null
}

export type RowIssue = { line: number; message: string }

export type ImportPlan = {
  cards: PlannedCard[]
  variants: PlannedVariant[]
  newVariants: PlannedVariant[]
  issues: RowIssue[]
  /** Lines whose (number, variant) repeats an earlier line; folded into the first card. */
  duplicateLines: RowIssue[]
  counts: { rows: number; cards: number; newCards: number; existingCards: number; invalid: number; duplicates: number; printings: number }
}

export const MAX_IMPORT_ROWS = 5000

const NAME_MAX = 200
const NUMBER_MAX = 30
const RARITY_MAX = 60
const VARIANT_MAX = 60

function cardKey(number: string | null, name: string): string {
  return number ? `n:${number.toLowerCase()}` : `name:${name.toLowerCase()}`
}

export function buildImportPlan(rows: readonly MappedRow[], existingCards: readonly ExistingCard[], existingVariants: readonly ExistingVariant[]): ImportPlan {
  const byNumber = new Map<string, ExistingCard>()
  const byName = new Map<string, ExistingCard>()
  for (const card of existingCards) {
    if (card.number) byNumber.set(card.number.toLowerCase(), card)
    byName.set(card.name.toLowerCase(), card)
  }
  const existingVariantBySlug = new Map(existingVariants.map((v) => [v.slug, v]))

  const cards = new Map<string, PlannedCard>()
  const variants = new Map<string, PlannedVariant>()
  const issues: RowIssue[] = []
  const duplicateLines: RowIssue[] = []
  let printings = 0

  for (const row of rows) {
    const name = (row.name ?? '').trim()
    const number = (row.number ?? '').trim() || null
    if (name === '') {
      issues.push({ line: row.line, message: 'Missing card name.' })
      continue
    }
    if (name.length > NAME_MAX) {
      issues.push({ line: row.line, message: `Name is longer than ${NAME_MAX} characters.` })
      continue
    }
    if (number && number.length > NUMBER_MAX) {
      issues.push({ line: row.line, message: `Number is longer than ${NUMBER_MAX} characters.` })
      continue
    }
    const rarity = (row.rarity ?? '').trim().slice(0, RARITY_MAX) || null
    const variantName = (row.variant ?? '').trim().slice(0, VARIANT_MAX)
    const variantSlug = variantName === '' ? null : slugify(variantName, 'variant')
    if (variantSlug) {
      const existing = existingVariantBySlug.get(variantSlug)
      if (!variants.has(variantSlug)) variants.set(variantSlug, { slug: variantSlug, name: existing?.name ?? variantName })
    }

    const key = cardKey(number, name)
    const planned = cards.get(key)
    if (planned) {
      if (variantSlug === null || planned.variants.includes(variantSlug)) {
        duplicateLines.push({ line: row.line, message: `Repeats line ${planned.lines[0] ?? '?'}${variantName ? ` for ${variantName}` : ''}.` })
      } else {
        planned.variants.push(variantSlug)
        printings += 1
      }
      planned.lines.push(row.line)
      continue
    }

    const match = (number ? byNumber.get(number.toLowerCase()) : undefined) ?? (number ? undefined : byName.get(name.toLowerCase()))
    cards.set(key, {
      key,
      lines: [row.line],
      name,
      number,
      rarity,
      artist: (row.artist ?? '').trim() || null,
      language: (row.language ?? '').trim() || null,
      externalId: (row.external_id ?? '').trim() || null,
      variants: variantSlug ? [variantSlug] : [],
      existingId: match?.id ?? null,
      matchedBy: match ? (number ? 'number' : 'name') : null,
    })
    if (variantSlug) printings += 1
  }

  const cardList = [...cards.values()]
  const variantList = [...variants.values()]
  const newVariants = variantList.filter((v) => !existingVariantBySlug.has(v.slug))
  if (rows.length > MAX_IMPORT_ROWS) issues.unshift({ line: 0, message: `Imports are limited to ${MAX_IMPORT_ROWS} rows at a time.` })

  return {
    cards: cardList,
    variants: variantList,
    newVariants,
    issues,
    duplicateLines,
    counts: {
      rows: rows.length,
      cards: cardList.length,
      newCards: cardList.filter((c) => c.existingId === null).length,
      existingCards: cardList.filter((c) => c.existingId !== null).length,
      invalid: issues.filter((i) => i.line > 0).length,
      duplicates: duplicateLines.length,
      printings,
    },
  }
}

/** JSON payload for `import_checklist()`; mirrors the plpgsql reader field for field. */
export type ImportPayloadCard = {
  name: string
  number: string | null
  rarity: string | null
  artist: string | null
  language: string | null
  external_id: string | null
  variants: string[]
  existing_id: string | null
}

export function toImportPayload(plan: ImportPlan): { cards: ImportPayloadCard[]; variants: PlannedVariant[] } {
  return {
    cards: plan.cards.map((c) => ({
      name: c.name,
      number: c.number,
      rarity: c.rarity,
      artist: c.artist,
      language: c.language,
      external_id: c.externalId,
      variants: c.variants,
      existing_id: c.existingId,
    })),
    variants: plan.variants,
  }
}

export function planIsCommittable(plan: ImportPlan): boolean {
  return plan.cards.length > 0 && plan.counts.rows <= MAX_IMPORT_ROWS
}
