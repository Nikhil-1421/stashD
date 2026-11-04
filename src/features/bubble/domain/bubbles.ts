import type { CardStatus } from '@/features/collection/domain/completion'
import type { PrintingRef } from '@/features/collection/domain/requirements'

/**
 * Bubble Check model: one "bubble" (pill) per printing, or per card, built from the catalog, the
 * requirement resolution and the user's items. Pure; no I/O. Order follows the card order given.
 */
export type BubbleCard = { id: string; name: string; number: string | null; rarity: string | null }
export type BubbleVariant = { id: string; name: string }

export type BubbleUnit = 'printing' | 'card'
export type BubbleState = 'missing' | 'owned' | 'partial' | 'complete' | 'excluded'

export type Bubble = {
  /** `printing:<id>` or `card:<id>`; stable across rebuilds. */
  key: string
  unit: BubbleUnit
  cardId: string
  /** The printing (printing unit) or every printing of the card (card unit). */
  printingIds: readonly string[]
  /** Short pill text: card number plus a variant suffix, e.g. `012r`. */
  label: string
  number: string | null
  name: string
  variantId: string | null
  variantName: string | null
  rarity: string | null
  state: BubbleState
  /** Printing unit: copies owned. Card unit: required printings owned. */
  quantity: number
  required: boolean
}

export type BubbleStatusFilter = 'all' | 'missing' | 'owned' | 'excluded'
export type BubbleFilter = { status: BubbleStatusFilter; variantId: string | null; rarity: string | null; search: string }

export const EMPTY_FILTER: BubbleFilter = { status: 'all', variantId: null, rarity: null, search: '' }

export function isBubbleUnit(v: unknown): v is BubbleUnit {
  return v === 'printing' || v === 'card'
}

/**
 * Short, unique suffix per variant for pill labels. The first variant is the primary one and gets
 * no suffix (`012`); the others get initials (`Reverse Holo` → `rh`, `Holo` → `h`), with a digit
 * appended on collisions.
 */
export function variantSuffixes(variants: readonly BubbleVariant[]): Map<string, string> {
  const out = new Map<string, string>()
  const used = new Set<string>()
  variants.forEach((v, i) => {
    if (i === 0) {
      out.set(v.id, '')
      return
    }
    const words = v.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    let base = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 3) : (words[0] ?? 'v').slice(0, 1)
    if (base === '') base = 'v'
    let candidate = base
    for (let n = 2; used.has(candidate); n += 1) candidate = `${base}${n}`
    used.add(candidate)
    out.set(v.id, candidate)
  })
  return out
}

export type BuildInput = {
  unit: BubbleUnit
  cards: readonly BubbleCard[]
  variants: readonly BubbleVariant[]
  printings: readonly PrintingRef[]
  required: ReadonlySet<string>
  owned: ReadonlyMap<string, number>
  byCard: ReadonlyMap<string, { status: CardStatus; required: number; owned: number }>
}

export function buildBubbles({ unit, cards, variants, printings, required, owned, byCard }: BuildInput): Bubble[] {
  const suffixes = variantSuffixes(variants)
  const variantName = new Map(variants.map((v) => [v.id, v.name]))
  const variantOrder = new Map(variants.map((v, i) => [v.id, i]))
  const byCardId = new Map<string, PrintingRef[]>()
  for (const p of printings) {
    const list = byCardId.get(p.cardId)
    if (list) list.push(p)
    else byCardId.set(p.cardId, [p])
  }

  const out: Bubble[] = []
  for (const card of cards) {
    const cardPrintings = (byCardId.get(card.id) ?? []).slice().sort((a, b) => (variantOrder.get(a.variantId) ?? 0) - (variantOrder.get(b.variantId) ?? 0))
    if (cardPrintings.length === 0) continue
    const number = card.number
    const base = number ?? card.name.slice(0, 4)

    if (unit === 'card') {
      const entry = byCard.get(card.id)
      const status: CardStatus = entry?.status ?? 'excluded'
      out.push({
        key: `card:${card.id}`,
        unit,
        cardId: card.id,
        printingIds: cardPrintings.map((p) => p.id),
        label: base,
        number,
        name: card.name,
        variantId: null,
        variantName: null,
        rarity: card.rarity,
        state: status,
        quantity: entry?.owned ?? 0,
        required: status !== 'excluded',
      })
      continue
    }

    for (const p of cardPrintings) {
      const qty = owned.get(p.id) ?? 0
      const isRequired = required.has(p.id)
      out.push({
        key: `printing:${p.id}`,
        unit,
        cardId: card.id,
        printingIds: [p.id],
        label: `${base}${suffixes.get(p.variantId) ?? ''}`,
        number,
        name: card.name,
        variantId: p.variantId,
        variantName: variantName.get(p.variantId) ?? null,
        rarity: card.rarity,
        state: isRequired ? (qty > 0 ? 'owned' : 'missing') : 'excluded',
        quantity: qty,
        required: isRequired,
      })
    }
  }
  return out
}

export function matchesStatus(b: Bubble, status: BubbleStatusFilter): boolean {
  switch (status) {
    case 'all': return true
    case 'missing': return b.state === 'missing' || b.state === 'partial'
    case 'owned': return b.state === 'owned' || b.state === 'complete' || (b.state === 'excluded' && b.quantity > 0)
    case 'excluded': return b.state === 'excluded'
  }
}

export function filterBubbles(bubbles: readonly Bubble[], filter: BubbleFilter): Bubble[] {
  const term = filter.search.trim().toLowerCase()
  return bubbles.filter(
    (b) =>
      matchesStatus(b, filter.status) &&
      (filter.variantId === null || b.variantId === filter.variantId) &&
      (filter.rarity === null || (b.rarity ?? '') === filter.rarity) &&
      (term === '' || b.name.toLowerCase().includes(term) || (b.number ?? '').toLowerCase().includes(term)),
  )
}

/** Distinct rarities in card order; '' stands for cards without one. */
export function distinctRarities(cards: readonly BubbleCard[]): string[] {
  const seen = new Set<string>()
  for (const c of cards) seen.add(c.rarity ?? '')
  return [...seen]
}

/** Keys of the bubbles from `anchorKey` to `targetKey` (inclusive, either direction) within `ordered`. */
export function rangeKeys(ordered: readonly Bubble[], anchorKey: string | null, targetKey: string): string[] {
  const target = ordered.findIndex((b) => b.key === targetKey)
  if (target === -1) return []
  const anchor = anchorKey === null ? -1 : ordered.findIndex((b) => b.key === anchorKey)
  if (anchor === -1) return [targetKey]
  const [from, to] = anchor < target ? [anchor, target] : [target, anchor]
  return ordered.slice(from, to + 1).map((b) => b.key)
}

/** What toggling a bubble should write: printing unit flips 0 ↔ 1; card unit completes or clears the card. */
export function toggleWrites(b: Bubble, owned: ReadonlyMap<string, number>, required: ReadonlySet<string>): { printingId: string; quantity: number }[] {
  if (b.unit === 'printing') {
    const [printingId] = b.printingIds
    return printingId === undefined ? [] : [{ printingId, quantity: b.quantity > 0 ? 0 : 1 }]
  }
  if (b.state === 'complete') return b.printingIds.filter((id) => (owned.get(id) ?? 0) > 0).map((id) => ({ printingId: id, quantity: 0 }))
  const targets = b.printingIds.filter((id) => required.has(id))
  return (targets.length > 0 ? targets : b.printingIds).filter((id) => (owned.get(id) ?? 0) === 0).map((id) => ({ printingId: id, quantity: 1 }))
}

export function bubbleStateLabel(state: BubbleState): string {
  switch (state) {
    case 'missing': return 'missing'
    case 'owned': return 'owned'
    case 'partial': return 'partially owned'
    case 'complete': return 'complete'
    case 'excluded': return 'not required'
  }
}

/** A contiguous run of bubbles, labelled by its first and last pill, for orientation in long lists. */
export type BubbleSection = { start: number; end: number; label: string; shortLabel: string }

export function sectionsOf(bubbles: readonly Bubble[], size: number): BubbleSection[] {
  const out: BubbleSection[] = []
  if (size <= 0) return out
  for (let start = 0; start < bubbles.length; start += size) {
    const end = Math.min(bubbles.length, start + size)
    const first = bubbles[start]
    const last = bubbles[end - 1]
    if (!first || !last) break
    out.push({ start, end, label: first === last ? first.label : `${first.label} – ${last.label}`, shortLabel: first.label })
  }
  return out
}
