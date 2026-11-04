import { describe, expect, it } from 'vitest'
import { fieldErrors } from '@/features/auth/validation'
import { customSetSchema, EMPTY_SET_INPUT } from './schema'

describe('customSetSchema', () => {
  it('requires a name and accepts the empty defaults otherwise', () => {
    const r = customSetSchema.safeParse(EMPTY_SET_INPUT)
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error)).toEqual({ name: 'Give the set a name.' })
    expect(customSetSchema.safeParse({ ...EMPTY_SET_INPUT, name: ' Base Set ' }).success).toBe(true)
  })
  it('validates the release date format and game id shape', () => {
    expect(customSetSchema.safeParse({ ...EMPTY_SET_INPUT, name: 'x', releaseDate: '1999-01-09' }).success).toBe(true)
    expect(customSetSchema.safeParse({ ...EMPTY_SET_INPUT, name: 'x', releaseDate: '09/01/1999' }).success).toBe(false)
    expect(customSetSchema.safeParse({ ...EMPTY_SET_INPUT, name: 'x', gameId: 'not-a-uuid' }).success).toBe(false)
    expect(customSetSchema.safeParse({ ...EMPTY_SET_INPUT, name: 'x', gameId: '2d6f1b4e-3c2a-4e7b-9f1a-0b1c2d3e4f5a' }).success).toBe(true)
  })
  it('trims and caps optional text', () => {
    const r = customSetSchema.safeParse({ ...EMPTY_SET_INPUT, name: 'x', setCode: ' SV01 ', series: 'y'.repeat(121) })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error)).toEqual({ series: 'Use at most 120 characters.' })
  })
})
