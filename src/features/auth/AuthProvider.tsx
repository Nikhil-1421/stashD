import { useEffect, useState, type ReactNode } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import { AuthContext, authStateFromSession, type AuthState } from './auth-context'

const UNCONFIGURED: AuthState = { status: 'unconfigured', session: null, user: null }
const LOADING: AuthState = { status: 'loading', session: null, user: null }

/**
 * Owns the Supabase session for the whole app. The session is persisted by supabase-js
 * (localStorage) and refreshed automatically; this provider only mirrors it into React.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()
  const [state, setState] = useState<AuthState>(supabase ? LOADING : UNCONFIGURED)

  useEffect(() => {
    if (!supabase) return
    const controller = new AbortController()

    void supabase.auth.getSession().then(({ data }) => {
      if (!controller.signal.aborted) setState(authStateFromSession(data.session))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(authStateFromSession(session))
    })

    return () => {
      controller.abort()
      subscription.unsubscribe()
    }
  }, [supabase])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
