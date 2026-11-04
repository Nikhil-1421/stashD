import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from './database.types'

export type AppSupabaseClient = SupabaseClient<Database>

let client: AppSupabaseClient | null = null

/**
 * Returns the shared Supabase client, or `null` when the environment is not configured.
 * Callers must handle `null` explicitly: the UI shows a setup screen rather than crashing.
 * Uses the PKCE flow so email links (verification, password recovery) work in the SPA.
 */
export function getSupabase(): AppSupabaseClient | null {
  if (!env.isSupabaseConfigured) return null
  client ??= createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
  return client
}
