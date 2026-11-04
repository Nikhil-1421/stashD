import { requireSupabase } from '@/lib/supabase/client'
import type { Tables, Views } from '@/lib/supabase/database.types'
import type { CustomSetInput } from './schema'

export type Game = Tables<'games'>
export type UserSetOverview = Views<'user_set_overview'>

export const setKeys = {
  all: ['user-sets'] as const,
  list: () => [...setKeys.all, 'list'] as const,
  detail: (userSetId: string) => [...setKeys.all, 'detail', userSetId] as const,
  games: ['games'] as const,
}

export async function listGames(): Promise<Game[]> {
  const { data, error } = await requireSupabase().from('games').select('*').order('name')
  if (error) throw new Error(error.message)
  return data
}

export async function listUserSets(): Promise<UserSetOverview[]> {
  const { data, error } = await requireSupabase()
    .from('user_set_overview')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function getUserSet(userSetId: string): Promise<UserSetOverview | null> {
  const { data, error } = await requireSupabase().from('user_set_overview').select('*').eq('id', userSetId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Creates the catalog set, its default variant and the tracking row in one transaction. Returns the user_set id. */
export async function createCustomSet(input: CustomSetInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_custom_set', {
    p_name: input.name,
    p_game_id: input.gameId === '' ? null : input.gameId,
    p_set_code: input.setCode || null,
    p_series: input.series || null,
    p_release_date: input.releaseDate || null,
    p_language: input.language,
    p_description: input.description || null,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function updateCustomSet(catalogSetId: string, input: CustomSetInput): Promise<void> {
  const { error } = await requireSupabase()
    .from('catalog_sets')
    .update({
      name: input.name,
      game_id: input.gameId === '' ? null : input.gameId,
      set_code: input.setCode || null,
      series: input.series || null,
      release_date: input.releaseDate || null,
      language: input.language,
      description: input.description || null,
    })
    .eq('id', catalogSetId)
  if (error) throw new Error(error.message)
}

/** Deletes a custom set and, by cascade, its cards, variants, printings and tracking row. */
export async function deleteCustomSet(catalogSetId: string): Promise<void> {
  const { error } = await requireSupabase().from('catalog_sets').delete().eq('id', catalogSetId)
  if (error) throw new Error(error.message)
}

export function setDisplayName(set: Pick<UserSetOverview, 'tracking_name' | 'set_name'>): string {
  return set.tracking_name ?? set.set_name
}
