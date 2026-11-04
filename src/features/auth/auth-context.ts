import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState =
  | { status: 'unconfigured'; session: null; user: null }
  | { status: 'loading'; session: null; user: null }
  | { status: 'signed-out'; session: null; user: null }
  | { status: 'signed-in'; session: Session; user: User }

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function authStateFromSession(session: Session | null): AuthState {
  return session
    ? { status: 'signed-in', session, user: session.user }
    : { status: 'signed-out', session: null, user: null }
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
