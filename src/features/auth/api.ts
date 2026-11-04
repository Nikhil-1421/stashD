import type { AuthError } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { getSupabase } from '@/lib/supabase/client'

export type AuthResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

const NOT_CONFIGURED = 'Supabase is not configured. See README for setup.'

/** Translate Supabase/GoTrue errors into short messages safe to show users. */
export function describeAuthError(error: AuthError | Error): string {
  const message = error.message || 'Something went wrong.'
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.'
  if (/email not confirmed/i.test(message)) return 'Please verify your email address before signing in.'
  if (/email rate limit/i.test(message)) {
    return 'Email sending limit reached. This project can only send a few auth emails per hour; try again later or ask the owner to configure custom SMTP.'
  }
  if (/rate limit|too many requests/i.test(message)) return 'Too many attempts. Please wait a moment and try again.'
  if (/already registered|already been registered/i.test(message)) return 'An account with this email already exists.'
  if (/password should be at least/i.test(message)) return 'Password is too short.'
  if (/network|fetch/i.test(message)) return 'Could not reach the server. Check your connection and try again.'
  return message
}

export async function signUp(email: string, password: string): Promise<AuthResult<{ needsVerification: boolean }>> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: NOT_CONFIGURED }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${env.appUrl}/auth/callback` },
  })
  if (error) return { ok: false, error: describeAuthError(error) }
  // With email confirmation enabled Supabase returns a user with no identities when the
  // address is already registered (to avoid leaking account existence). Treat it as "check email".
  const needsVerification = data.session === null
  return { ok: true, data: { needsVerification } }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: NOT_CONFIGURED }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: describeAuthError(error) }
  return { ok: true, data: undefined }
}

export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: NOT_CONFIGURED }
  const { error } = await supabase.auth.signOut()
  if (error) return { ok: false, error: describeAuthError(error) }
  return { ok: true, data: undefined }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: NOT_CONFIGURED }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.appUrl}/reset-password`,
  })
  if (error) return { ok: false, error: describeAuthError(error) }
  return { ok: true, data: undefined }
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: NOT_CONFIGURED }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, error: describeAuthError(error) }
  return { ok: true, data: undefined }
}

/**
 * Permanently deletes the signed-in user's account via the `delete_own_account` RPC, then clears
 * the local session. The server function only ever deletes the caller; see migration 0002.
 */
export async function deleteAccount(): Promise<AuthResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: NOT_CONFIGURED }
  const { error } = await supabase.rpc('delete_own_account')
  if (error) return { ok: false, error: describeAuthError(error) }
  // The auth user no longer exists; drop the local session without calling the server.
  await supabase.auth.signOut({ scope: 'local' })
  return { ok: true, data: undefined }
}
