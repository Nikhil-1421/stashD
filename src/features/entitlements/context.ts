import { createContext, useContext } from 'react'
import { freePolicy, type EntitlementPolicy } from './policy'

export const EntitlementsContext = createContext<EntitlementPolicy>(freePolicy)

export function useEntitlements(): EntitlementPolicy {
  return useContext(EntitlementsContext)
}
