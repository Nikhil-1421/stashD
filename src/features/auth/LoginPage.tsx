import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { describedBy } from '@/components/ui/form-utils'
import { Input } from '@/components/ui/Input'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { signIn } from './api'
import { AuthLayout } from './AuthLayout'
import { fieldErrors, loginSchema, type FieldErrors } from './validation'

type Fields = { email: string; password: string }

export function LoginPage() {
  useDocumentTitle('Sign in')
  const [fields, setFields] = useState<Fields>({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<Fields>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = loginSchema.safeParse(fields)
    if (!parsed.success) {
      setErrors(fieldErrors<Fields>(parsed.error))
      return
    }
    setErrors({})
    setSubmitting(true)
    const result = await signIn(parsed.data.email, parsed.data.password)
    setSubmitting(false)
    if (!result.ok) setFormError(result.error)
    // On success AuthProvider flips to signed-in and PublicOnlyRoute redirects.
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back."
      footer={
        <>
          New here? <Link to="/register" className="text-fg underline-offset-4 hover:underline">Create an account</Link>
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
        <FormField id="password" label="Password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={fields.password}
            invalid={Boolean(errors.password)}
            aria-describedby={describedBy('password', errors.password)}
            onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
          />
        </FormField>
        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            Forgot password?
          </Link>
          <Button type="submit" loading={submitting}>
            Sign in
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
