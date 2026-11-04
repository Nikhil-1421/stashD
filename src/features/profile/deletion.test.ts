import { describe, expect, it } from 'vitest'
import { canConfirmDeletion } from './deletion'

describe('canConfirmDeletion', () => {
  it('requires the typed value to match the account email', () => {
    expect(canConfirmDeletion('ash@example.com', 'ash@example.com')).toBe(true)
    expect(canConfirmDeletion('ash@example.co', 'ash@example.com')).toBe(false)
    expect(canConfirmDeletion('', 'ash@example.com')).toBe(false)
  })
  it('ignores case and surrounding whitespace', () => {
    expect(canConfirmDeletion('  ASH@Example.com ', 'ash@example.com')).toBe(true)
  })
  it('never confirms when the account has no email', () => {
    expect(canConfirmDeletion('anything', undefined)).toBe(false)
  })
})
