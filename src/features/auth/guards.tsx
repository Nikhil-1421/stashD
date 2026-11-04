import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useAuth } from './auth-context'
import { SetupRequiredPage } from './SetupRequiredPage'

/** Wraps routes that require a signed-in user. Remembers where the user was going. */
export function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'unconfigured') return <SetupRequiredPage />
  if (auth.status === 'loading') return <FullPageSpinner label="Checking your session" />
  if (auth.status === 'signed-out') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

/** Wraps login/register: a signed-in user is sent into the app instead. */
export function PublicOnlyRoute() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'unconfigured') return <SetupRequiredPage />
  if (auth.status === 'loading') return <FullPageSpinner label="Checking your session" />
  if (auth.status === 'signed-in') {
    const from = (location.state as { from?: unknown } | null)?.from
    return <Navigate to={typeof from === 'string' && from.startsWith('/') ? from : '/'} replace />
  }
  return <Outlet />
}
