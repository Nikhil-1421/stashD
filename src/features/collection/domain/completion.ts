import type { PrintingRef } from './requirements'

/**
 * Completion = owned required printings / required printings. Computed on demand from the
 * requirement resolution and the user's items; never stored (docs/DATABASE_SCHEMA.md).
 */
export type OwnedQuantities = ReadonlyMap<string, number>

export type CardStatus = 'complete' | 'partial' | 'missing' | 'excluded'

export type Completion = {
  required: number
  owned: number
  missing: number
  /** Owned printings that are not required (collected "extras"). */
  extra: number
  totalQuantity: number
  /** 0–100, rounded to one decimal. 0 when nothing is required. */
  percent: number
  byCard: Map<string, { status: CardStatus; required: number; owned: number }>
}

export function computeCompletion(printings: readonly PrintingRef[], required: ReadonlySet<string>, owned: OwnedQuantities): Completion {
  let requiredCount = 0
  let ownedRequired = 0
  let extra = 0
  let totalQuantity = 0
  const byCard = new Map<string, { status: CardStatus; required: number; owned: number }>()

  for (const p of printings) {
    const qty = owned.get(p.id) ?? 0
    const isOwned = qty > 0
    const isRequired = required.has(p.id)
    totalQuantity += qty
    if (isRequired) {
      requiredCount += 1
      if (isOwned) ownedRequired += 1
    } else if (isOwned) {
      extra += 1
    }
    const entry = byCard.get(p.cardId) ?? { status: 'excluded', required: 0, owned: 0 }
    if (isRequired) {
      entry.required += 1
      if (isOwned) entry.owned += 1
    }
    byCard.set(p.cardId, entry)
  }

  for (const entry of byCard.values()) {
    entry.status = entry.required === 0 ? 'excluded' : entry.owned === 0 ? 'missing' : entry.owned === entry.required ? 'complete' : 'partial'
  }

  const percent = requiredCount === 0 ? 0 : Math.round((ownedRequired / requiredCount) * 1000) / 10
  return { required: requiredCount, owned: ownedRequired, missing: requiredCount - ownedRequired, extra, totalQuantity, percent, byCard }
}

export function cardStatusLabel(status: CardStatus): string {
  switch (status) {
    case 'complete': return 'Complete'
    case 'partial': return 'Partial'
    case 'missing': return 'Missing'
    case 'excluded': return 'Not required'
  }
}
