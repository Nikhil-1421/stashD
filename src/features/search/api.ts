import { requireSupabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

export type CardHit = Pick<Tables<'catalog_cards'>, 'id' | 'catalog_set_id' | 'name' | 'number' | 'rarity'>

export const SEARCH_LIMIT = 50
const SET_CHUNK = 100

export const searchKeys = {
  cards: (term: string, setIds: readonly string[]) => ['search', 'cards', term, setIds.join(',')] as const,
}

/** PostgREST `or()` filters are comma/paren delimited; strip those so a search string cannot alter the filter. */
function sanitize(term: string): string {
  return term.replace(/[,()%\\]/g, ' ').trim()
}

/** Cards whose name or number matches, across the given catalog sets (the user's tracked sets). */
export async function searchCards(catalogSetIds: readonly string[], term: string, limit = SEARCH_LIMIT): Promise<CardHit[]> {
  const clean = sanitize(term)
  if (clean === '' || catalogSetIds.length === 0) return []
  const out: CardHit[] = []
  for (let i = 0; i < catalogSetIds.length && out.length < limit; i += SET_CHUNK) {
    const { data, error } = await requireSupabase()
      .from('catalog_cards')
      .select('id, catalog_set_id, name, number, rarity')
      .in('catalog_set_id', catalogSetIds.slice(i, i + SET_CHUNK))
      .or(`name.ilike.%${clean}%,number.ilike.%${clean}%`)
      .order('name')
      .limit(limit - out.length)
    if (error) throw new Error(error.message)
    out.push(...data)
  }
  return out
}
