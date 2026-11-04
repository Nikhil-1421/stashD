import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderRoutes, loading, signedInAs, signedOut, unconfigured } from '@/test/render'
import { ProtectedRoute, PublicOnlyRoute } from './guards'

const routes = [
  {
    element: <PublicOnlyRoute />,
    children: [{ path: '/login', element: <p>login page</p> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <p>dashboard</p> },
      { path: '/binders', element: <p>binders</p> },
    ],
  },
]

describe('ProtectedRoute', () => {
  it('redirects a signed-out visitor to /login and remembers the destination', () => {
    const { router } = renderRoutes(routes, { auth: signedOut, initialEntries: ['/binders?page=2'] })
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.state).toEqual({ from: '/binders?page=2' })
  })

  it('renders the protected outlet for a signed-in user', () => {
    renderRoutes(routes, { auth: signedInAs(), initialEntries: ['/'] })
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })

  it('shows a loading state while the session is being restored', () => {
    renderRoutes(routes, { auth: loading, initialEntries: ['/'] })
    expect(screen.getByRole('status')).toHaveTextContent(/checking your session/i)
  })

  it('shows the setup screen instead of the app when Supabase is not configured', () => {
    renderRoutes(routes, { auth: unconfigured, initialEntries: ['/'] })
    expect(screen.getByRole('heading', { name: /setup required/i })).toBeInTheDocument()
  })
})

describe('PublicOnlyRoute', () => {
  it('sends a signed-in user from /login back to where they came from', () => {
    const { router } = renderRoutes(routes, { auth: signedInAs(), initialEntries: [{ pathname: '/login', state: { from: '/binders' } }] as never })
    expect(screen.getByText('binders')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/binders')
  })

  it('ignores an unsafe "from" value and falls back to the dashboard', () => {
    const { router } = renderRoutes(routes, { auth: signedInAs(), initialEntries: [{ pathname: '/login', state: { from: 'https://evil.example' } }] as never })
    expect(router.state.location.pathname).toBe('/')
  })

  it('renders the public page for a signed-out visitor', () => {
    renderRoutes(routes, { auth: signedOut, initialEntries: ['/login'] })
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
})
