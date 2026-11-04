import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { describedBy } from '@/components/ui/form-utils'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { updatePassword } from './api'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { SetupRequiredPage } from './SetupRequiredPage'
import { fieldErrors, resetPasswordSchema, PASSWORD_MIN_LENGTH, type FieldErrors } from './validation'

type Fields = { password: string; confirmPassword: string }

/**
 * Target of the password-recovery email. supabase-js exchanges the `?code=` in the URL for a
 * session on load (PKCE), so a valid link lands here signed-in; an invalid/expired one does not.
 */
export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password')
  const auth = useAuth()
  const navigate = useNavigate()
  const [fields, setFields] = useState<Fields>({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors<Fields>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (auth.status === 'unconfigured') return <SetupRequiredPage />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = resetPasswordSchema.safeParse(fields)
    if (!parsed.success) {
      setErrors(fieldErrors<Fields>(parsed.error))
      return
    }
    setErrors({})
    setSubmitting(true)
    const result = await updatePassword(parsed.data.password)
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    setDone(true)
    window.setTimeout(() => void navigate('/', { replace: true }), 1200)
  }

  const hint = `At least ${PASSWORD_MIN_LENGTH} characters.`

  return (
    <AuthLayout title="Choose a new password">
      {auth.status === 'loading' ? (
        <Spinner label="Verifying your reset link" />
      ) : auth.status === 'signed-out' ? (
        <div className="space-y-4">
          <Alert tone="warning" title="This link is invalid or has expired">
            Request a new one and open it on this device.
          </Alert>
          <Link to="/forgot-password" className="text-sm text-fg underline-offset-4 hover:underline">
            Request a new reset link
          </Link>
        </div>
      ) : done ? (
        <Alert tone="success" title="Password updated">Taking you to your dashboard…</Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <FormField id="password" label="New password" error={errors.password} hint={hint}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={fields.password}
              invalid={Boolean(errors.password)}
              aria-describedby={describedBy('password', errors.password, hint)}
              onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
            />
          </FormField>
          <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword}>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={fields.confirmPassword}
              invalid={Boolean(errors.confirmPassword)}
              aria-describedby={describedBy('confirmPassword', errors.confirmPassword)}
              onChange={(e) => setFields((f) => ({ ...f, confirmPassword: e.target.value }))}
            />
          </FormField>
          <Button type="submit" className="w-full" loading={submitting}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
