import { useMemo, type ReactNode } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { EntitlementsContext } from './context'
import { resolvePolicy } from './policy'

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const policy = useMemo(() => resolvePolicy(auth.user ? { userId: auth.user.id } : null), [auth.user])
  return <EntitlementsContext.Provider value={policy}>{children}</EntitlementsContext.Provider>
}
