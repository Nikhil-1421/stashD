import { requireSupabase } from '@/lib/supabase/client'
import type { SetVisibility, Views } from '@/lib/supabase/database.types'

export type LibraryEntry = Views<'checklist_library'>

export const libraryKeys = {
  all: ['library'] as const,
  list: () => ['library', 'list'] as const,
  detail: (catalogSetId: string) => ['library', 'detail', catalogSetId] as const,
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const { data, error } = await requireSupabase().from('checklist_library').select('*').order('published_at', { ascending: false }).limit(500)
  if (error) throw new Error(error.message)
  return data
}

export async function getLibraryEntry(catalogSetId: string): Promise<LibraryEntry | null> {
  const { data, error } = await requireSupabase().from('checklist_library').select('*').eq('id', catalogSetId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Adds a published (or provider) set to the caller's collection; idempotent. Returns the user_set id. */
export async function trackSet(catalogSetId: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('track_catalog_set', { p_set_id: catalogSetId })
  if (error) throw new Error(error.message)
  return data
}

/** Private, editable copy of any readable set (checklist only, never ownership). Returns the new user_set id. */
export async function duplicateSet(catalogSetId: string, name?: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('duplicate_catalog_set', { p_source_set_id: catalogSetId, p_name: name ?? null })
  if (error) throw new Error(error.message)
  return data
}

export async function setVisibility(catalogSetId: string, visibility: SetVisibility): Promise<SetVisibility> {
  const { data, error } = await requireSupabase().rpc('set_catalog_set_visibility', { p_set_id: catalogSetId, p_visibility: visibility })
  if (error) throw new Error(error.message)
  return data
}

/** Removes a set from the caller's collection. Deletes their items, rules and notes for it (confirm first). */
export async function untrackSet(userSetId: string): Promise<void> {
  const { error } = await requireSupabase().from('user_sets').delete().eq('id', userSetId)
  if (error) throw new Error(error.message)
}
