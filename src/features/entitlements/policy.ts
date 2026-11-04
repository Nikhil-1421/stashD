/**
 * Entitlements / capability policy.
 *
 * The product is free today, but future tiers must not leak `if (plan === 'pro')` checks across
 * the UI. Every feature gate goes through this interface; swapping the resolver for one backed by
 * a subscriptions table is the only change needed later.
 */
export type Capability =
  | 'sets.create'
  | 'sets.import'
  | 'binders.create'
  | 'catalog.external'
  | 'sharing.public'
  | 'export.backup'

export type LimitKey = 'sets.max' | 'binders.max' | 'cardsPerSet.max'

export interface EntitlementPolicy {
  readonly planName: string
  can(capability: Capability): boolean
  /** `null` means unlimited. */
  limit(key: LimitKey): number | null
}

export const FREE_PLAN_NAME = 'Free'

export const freePolicy: EntitlementPolicy = {
  planName: FREE_PLAN_NAME,
  can: () => true,
  limit: () => null,
}

export type EntitlementSubject = { userId: string } | null

/** Resolve the policy for a subject. Today everyone gets the full free plan. */
export function resolvePolicy(_subject: EntitlementSubject): EntitlementPolicy {
  return freePolicy
}
