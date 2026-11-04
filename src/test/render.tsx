import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import { EntitlementsContext } from '@/features/entitlements/context'
import { freePolicy, type EntitlementPolicy } from '@/features/entitlements/policy'

export const signedOut: AuthState = { status: 'signed-out', session: null, user: null }
export const loading: AuthState = { status: 'loading', session: null, user: null }
export const unconfigured: AuthState = { status: 'unconfigured', session: null, user: null }

/** Minimal fake session for component tests; only the fields the UI reads are meaningful. */
export function signedInAs(email = 'ash@example.com', id = 'user-1'): AuthState {
  const user = { id, email, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' }
  const session = { access_token: 't', refresh_token: 'r', expires_in: 3600, token_type: 'bearer', user }
  return { status: 'signed-in', session: session as AuthState extends { session: infer S } ? NonNullable<S> : never, user: user as never }
}

type Options = { auth?: AuthState; policy?: EntitlementPolicy; initialEntries?: string[] }

export function renderWithProviders(ui: ReactNode, { auth = signedOut, policy = freePolicy }: Options = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <EntitlementsContext.Provider value={policy}>{ui}</EntitlementsContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

export function renderRoutes(routes: RouteObject[], { auth = signedOut, policy = freePolicy, initialEntries = ['/'] }: Options = {}) {
  const router = createMemoryRouter(routes, { initialEntries })
  const result = renderWithProviders(<RouterProvider router={router} />, { auth, policy })
  return { ...result, router }
}
