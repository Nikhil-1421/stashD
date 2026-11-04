import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { describedBy } from '@/components/ui/form-utils'
import { Input } from '@/components/ui/Input'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { signUp } from './api'
import { AuthLayout } from './AuthLayout'
import { fieldErrors, registerSchema, PASSWORD_MIN_LENGTH, type FieldErrors } from './validation'

type Fields = { email: string; password: string; confirmPassword: string }

export function RegisterPage() {
  useDocumentTitle('Create account')
  const navigate = useNavigate()
  const [fields, setFields] = useState<Fields>({ email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors<Fields>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = registerSchema.safeParse(fields)
    if (!parsed.success) {
      setErrors(fieldErrors<Fields>(parsed.error))
      return
    }
    setErrors({})
    setSubmitting(true)
    const result = await signUp(parsed.data.email, parsed.data.password)
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    if (result.data.needsVerification) {
      void navigate(`/check-email?email=${encodeURIComponent(parsed.data.email)}`, { replace: true })
    }
    // Otherwise a session exists already (confirmations disabled) and the guard redirects.
  }

  const passwordHint = `At least ${PASSWORD_MIN_LENGTH} characters.`

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free to use. Your collection data is private to you."
      footer={
        <>
          Already have an account? <Link to="/login" className="text-fg underline-offset-4 hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <FormField id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={fields.email}
            invalid={Boolean(errors.email)}
            aria-describedby={describedBy('email', errors.email)}
            onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
          />
        </FormField>
        <FormField id="password" label="Password" error={errors.password} hint={passwordHint}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={fields.password}
            invalid={Boolean(errors.password)}
            aria-describedby={describedBy('password', errors.password, passwordHint)}
            onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
          />
        </FormField>
        <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
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
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
