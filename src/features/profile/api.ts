import { getSupabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

export type Profile = Tables<'profiles'>

export const profileKeys = {
  detail: (userId: string) => ['profile', userId] as const,
}

/**
 * Fetches the caller's profile row. RLS limits the query to the signed-in user, so the id filter
 * is a convenience, not the security boundary. Returns null if the trigger has not created the
 * row yet (very first request after sign-up).
 */
export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function updateOwnProfile(userId: string, patch: { display_name: string | null }): Promise<Profile> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch }, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}
