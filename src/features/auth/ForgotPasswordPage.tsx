import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { describedBy } from '@/components/ui/form-utils'
import { Input } from '@/components/ui/Input'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { requestPasswordReset } from './api'
import { AuthLayout } from './AuthLayout'
import { fieldErrors, forgotPasswordSchema, type FieldErrors } from './validation'

type Fields = { email: string }

export function ForgotPasswordPage() {
  useDocumentTitle('Reset password')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FieldErrors<Fields>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setErrors(fieldErrors<Fields>(parsed.error))
      return
    }
    setErrors({})
    setSubmitting(true)
    const result = await requestPasswordReset(parsed.data.email)
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={<Link to="/login" className="text-fg underline-offset-4 hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <Alert tone="success" title="Email sent">
          If an account exists for that address, a reset link is on its way. The link expires after a short time.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <FormField id="email" label="Email" error={errors.email}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              invalid={Boolean(errors.email)}
              aria-describedby={describedBy('email', errors.email)}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <Button type="submit" className="w-full" loading={submitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
