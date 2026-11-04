import { describe, expect, it } from 'vitest'
import { describeAuthError } from './api'

const err = (message: string) => new Error(message)

describe('describeAuthError', () => {
  it('distinguishes the email sending limit from generic rate limiting', () => {
    expect(describeAuthError(err('email rate limit exceeded'))).toMatch(/email sending limit/i)
    expect(describeAuthError(err('Request rate limit reached'))).toMatch(/too many attempts/i)
  })
  it('maps common sign-in failures to user-safe text', () => {
    expect(describeAuthError(err('Invalid login credentials'))).toBe('Incorrect email or password.')
    expect(describeAuthError(err('Email not confirmed'))).toMatch(/verify your email/i)
    expect(describeAuthError(err('User already registered'))).toMatch(/already exists/i)
  })
  it('falls back to the original message', () => {
    expect(describeAuthError(err('something odd'))).toBe('something odd')
  })
})
