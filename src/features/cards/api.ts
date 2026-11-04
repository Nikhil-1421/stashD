import { requireSupabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { slugify } from '@/features/catalog/domain/slug'
import type { CardInput, VariantInput } from './schema'

export type CatalogCard = Tables<'catalog_cards'>
export type VariantDefinition = Tables<'variant_definitions'>
export type CardPrinting = Pick<Tables<'card_printings'>, 'id' | 'catalog_card_id' | 'variant_definition_id'>

export const CARDS_PAGE_SIZE = 100
const ALL_PAGE = 1000

export type CardSummary = Pick<CatalogCard, 'id' | 'name' | 'number' | 'rarity'>

export const cardKeys = {
  all: (setId: string) => ['cards', setId] as const,
  list: (setId: string, page: number, search: string) => ['cards', setId, 'list', page, search] as const,
  /** Every card of a set, unpaged; under 'cards' so card edits invalidate it too. */
  allCards: (setId: string) => ['cards', setId, 'all'] as const,
  variants: (setId: string) => ['variants', setId] as const,
  printings: (setId: string, cardIds: readonly string[]) => ['printings', setId, cardIds.join(',')] as const,
}

/** PostgREST `or()` filters are comma/paren delimited; strip those so a search string cannot alter the filter. */
function sanitizeSearch(search: string): string {
  return search.replace(/[,()%\\]/g, ' ').trim()
}

export async function listCards(setId: string, page: number, search: string): Promise<{ rows: CatalogCard[]; total: number }> {
  const from = page * CARDS_PAGE_SIZE
  let query = requireSupabase()
    .from('catalog_cards')
    .select('*', { count: 'exact' })
    .eq('catalog_set_id', setId)
    .order('sort_key', { ascending: true, nullsFirst: false })
    .order('position')
    .order('name')
    .range(from, from + CARDS_PAGE_SIZE - 1)
  const term = sanitizeSearch(search)
  if (term !== '') query = query.or(`name.ilike.%${term}%,number.ilike.%${term}%`)
  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { rows: data, total: count ?? data.length }
}

/** Every card of a set in checklist order (natural number sort, then position, then name). Paged under the hood. */
export async function listAllCards(setId: string): Promise<CardSummary[]> {
  const out: CardSummary[] = []
  for (let from = 0; ; from += ALL_PAGE) {
    const { data, error } = await requireSupabase()
      .from('catalog_cards')
      .select('id, name, number, rarity')
      .eq('catalog_set_id', setId)
      .order('sort_key', { ascending: true, nullsFirst: false })
      .order('position')
      .order('name')
      .order('id')
      .range(from, from + ALL_PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...data)
    if (data.length < ALL_PAGE) return out
  }
}

export async function createCard(setId: string, input: CardInput): Promise<CatalogCard> {
  const { data, error } = await requireSupabase()
    .from('catalog_cards')
    .insert({ catalog_set_id: setId, name: input.name, number: input.number || null, rarity: input.rarity || null })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateCard(cardId: string, input: CardInput): Promise<CatalogCard> {
  const { data, error } = await requireSupabase()
    .from('catalog_cards')
    .update({ name: input.name, number: input.number || null, rarity: input.rarity || null })
    .eq('id', cardId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteCard(cardId: string): Promise<void> {
  const { error } = await requireSupabase().from('catalog_cards').delete().eq('id', cardId)
  if (error) throw new Error(error.message)
}

export async function listVariants(setId: string): Promise<VariantDefinition[]> {
  const { data, error } = await requireSupabase()
    .from('variant_definitions')
    .select('*')
    .eq('catalog_set_id', setId)
    .order('position')
    .order('created_at')
  if (error) throw new Error(error.message)
  return data
}

export async function createVariant(setId: string, input: VariantInput, position: number): Promise<VariantDefinition> {
  const { data, error } = await requireSupabase()
    .from('variant_definitions')
    .insert({
      catalog_set_id: setId,
      slug: slugify(input.name, 'variant'),
      name: input.name,
      category: input.category,
      applies_by_default: input.appliesByDefault,
      position,
    })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('A variant with this name already exists in the set.')
    throw new Error(error.message)
  }
  return data
}

export async function updateVariant(variantId: string, patch: { applies_by_default?: boolean; name?: string }): Promise<void> {
  const { error } = await requireSupabase().from('variant_definitions').update(patch).eq('id', variantId)
  if (error) throw new Error(error.message)
}

/** Deletes the variant and, by cascade, every printing of it. */
export async function deleteVariant(variantId: string): Promise<void> {
  const { error } = await requireSupabase().from('variant_definitions').delete().eq('id', variantId)
  if (error) throw new Error(error.message)
}

export async function listPrintings(cardIds: readonly string[]): Promise<CardPrinting[]> {
  if (cardIds.length === 0) return []
  const { data, error } = await requireSupabase()
    .from('card_printings')
    .select('id, catalog_card_id, variant_definition_id')
    .in('catalog_card_id', [...cardIds])
  if (error) throw new Error(error.message)
  return data
}

export async function addPrinting(cardId: string, variantId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('card_printings')
    .insert({ catalog_card_id: cardId, variant_definition_id: variantId })
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function removePrinting(printingId: string): Promise<void> {
  const { error } = await requireSupabase().from('card_printings').delete().eq('id', printingId)
  if (error) throw new Error(error.message)
}
