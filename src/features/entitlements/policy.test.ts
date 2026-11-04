import { describe, expect, it } from 'vitest'
import { FREE_PLAN_NAME, freePolicy, resolvePolicy, type Capability, type LimitKey } from './policy'

const CAPABILITIES: Capability[] = ['sets.create', 'sets.import', 'binders.create', 'catalog.external', 'sharing.public', 'export.backup']
const LIMITS: LimitKey[] = ['sets.max', 'binders.max', 'cardsPerSet.max']

describe('entitlement policy', () => {
  it('grants every capability on the free plan', () => {
    for (const c of CAPABILITIES) expect(freePolicy.can(c)).toBe(true)
  })

  it('has no limits on the free plan', () => {
    for (const l of LIMITS) expect(freePolicy.limit(l)).toBeNull()
  })

  it('resolves anonymous and signed-in subjects to the free plan today', () => {
    expect(resolvePolicy(null).planName).toBe(FREE_PLAN_NAME)
    expect(resolvePolicy({ userId: 'abc' }).planName).toBe(FREE_PLAN_NAME)
  })
})
