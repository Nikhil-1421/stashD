import { describe, expect, it } from 'vitest'
import { fieldErrors, loginSchema, registerSchema, resetPasswordSchema } from './validation'

describe('auth validation', () => {
  it('normalises email case and whitespace on login', () => {
    const r = loginSchema.safeParse({ email: '  Ash@Example.COM ', password: 'x' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('ash@example.com')
  })

  it('rejects an invalid email with a field-specific message', () => {
    const r = loginSchema.safeParse({ email: 'nope', password: 'x' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error)).toEqual({ email: 'Enter a valid email address.' })
  })

  it('requires an 8+ character password and matching confirmation on register', () => {
    const short = registerSchema.safeParse({ email: 'a@b.co', password: 'short', confirmPassword: 'short' })
    expect(short.success).toBe(false)
    if (!short.success) expect(fieldErrors(short.error).password).toMatch(/at least 8/)

    const mismatch = registerSchema.safeParse({ email: 'a@b.co', password: 'longenough', confirmPassword: 'different1' })
    expect(mismatch.success).toBe(false)
    if (!mismatch.success) expect(fieldErrors(mismatch.error)).toEqual({ confirmPassword: 'Passwords do not match.' })

    expect(registerSchema.safeParse({ email: 'a@b.co', password: 'longenough', confirmPassword: 'longenough' }).success).toBe(true)
  })

  it('applies the same rules to password reset', () => {
    expect(resetPasswordSchema.safeParse({ password: 'abcdefgh', confirmPassword: 'abcdefgh' }).success).toBe(true)
    expect(resetPasswordSchema.safeParse({ password: 'abcdefgh', confirmPassword: 'abcdefgx' }).success).toBe(false)
  })

  it('keeps only the first message per field', () => {
    const r = registerSchema.safeParse({ email: '', password: '', confirmPassword: 'x' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const errors = fieldErrors(r.error)
      expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'email', 'password'])
    }
  })
})
