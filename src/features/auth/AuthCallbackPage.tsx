import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { SetupRequiredPage } from './SetupRequiredPage'

/** Reads `error_description` from either the query string or the hash fragment Supabase may use. */
function readAuthError(search: string, hash: string): string | null {
  for (const part of [search, hash]) {
    const params = new URLSearchParams(part.replace(/^[?#]/, ''))
    const description = params.get('error_description') ?? params.get('error')
    if (description) return description.replace(/\+/g, ' ')
  }
  return null
}

/**
 * Target of the email-verification link. supabase-js completes the PKCE exchange on load; this
 * page waits for the resulting session and then enters the app.
 */
export function AuthCallbackPage() {
  useDocumentTitle('Signing you in')
  const auth = useAuth()
  const location = useLocation()
  const [timedOut, setTimedOut] = useState(false)
  const urlError = readAuthError(location.search, location.hash)

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 8000)
    return () => window.clearTimeout(t)
  }, [])

  if (auth.status === 'unconfigured') return <SetupRequiredPage />
  if (auth.status === 'signed-in') return <Navigate to="/" replace />

  const failed = urlError !== null || (auth.status === 'signed-out' && timedOut)

  return (
    <AuthLayout title={failed ? 'Could not verify' : 'Verifying…'}>
      {failed ? (
        <div className="space-y-4">
          <Alert tone="warning" title="This link could not be used">
            {urlError ?? 'The link may have expired or already been used.'}
          </Alert>
          <Link to="/login" className="text-sm text-fg underline-offset-4 hover:underline">Go to sign in</Link>
        </div>
      ) : (
        <Spinner label="Completing sign-in" />
      )}
    </AuthLayout>
  )
}
