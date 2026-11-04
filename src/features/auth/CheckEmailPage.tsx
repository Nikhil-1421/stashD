import { Link, useSearchParams } from 'react-router'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AuthLayout } from './AuthLayout'

export function CheckEmailPage() {
  useDocumentTitle('Verify your email')
  const [params] = useSearchParams()
  const email = params.get('email')

  return (
    <AuthLayout title="Check your inbox" subtitle="One more step before you can sign in.">
      <div className="space-y-3 text-sm text-fg-muted">
        <p>
          We sent a verification link{email ? <> to <span className="font-medium text-fg">{email}</span></> : null}. Open it to
          activate your account.
        </p>
        <p>If an account with this address already existed, no new account was created and you can sign in instead.</p>
        <p className="text-fg-subtle">Didn&apos;t get it? Check spam, or register again to resend.</p>
      </div>
      <div className="mt-5 flex gap-3 text-sm">
        <Link to="/login" className="text-fg underline-offset-4 hover:underline">Go to sign in</Link>
      </div>
    </AuthLayout>
  )
}
