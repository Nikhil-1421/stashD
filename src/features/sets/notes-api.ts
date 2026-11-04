import { requireSupabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

export type SetNote = Tables<'user_set_notes'>

export const noteKeys = { list: (userSetId: string) => ['set-notes', userSetId] as const }

export async function listNotes(userSetId: string): Promise<SetNote[]> {
  const { data, error } = await requireSupabase().from('user_set_notes').select('*').eq('user_set_id', userSetId).order('created_at', { ascending: false }).limit(200)
  if (error) throw new Error(error.message)
  return data
}

export async function addNote(userSetId: string, body: string): Promise<SetNote> {
  const { data, error } = await requireSupabase().from('user_set_notes').insert({ user_set_id: userSetId, body }).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await requireSupabase().from('user_set_notes').delete().eq('id', noteId)
  if (error) throw new Error(error.message)
}
