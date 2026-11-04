import type { RequirementAction, RequirementScope } from '@/lib/supabase/database.types'

/**
 * Which printings count toward completion.
 * Rules are include/exclude at four scopes; the most specific scope that has a rule wins:
 * printing > card > variant > variant_category > default (include). Pure; no I/O.
 */
export type RequirementRule = { scope: RequirementScope; target: string; action: RequirementAction }

export type PrintingRef = { id: string; cardId: string; variantId: string; variantCategory: string }

const SCOPE_ORDER: readonly RequirementScope[] = ['printing', 'card', 'variant', 'variant_category']

export function isPrintingRequired(p: PrintingRef, rules: readonly RequirementRule[]): boolean {
  const index = indexRules(rules)
  return decide(p, index)
}

/** Resolves every printing at once; cheaper than calling `isPrintingRequired` in a loop. */
export function resolveRequired(printings: readonly PrintingRef[], rules: readonly RequirementRule[]): Set<string> {
  const index = indexRules(rules)
  const out = new Set<string>()
  for (const p of printings) if (decide(p, index)) out.add(p.id)
  return out
}

type RuleIndex = Record<RequirementScope, Map<string, RequirementAction>>

function indexRules(rules: readonly RequirementRule[]): RuleIndex {
  const index: RuleIndex = { printing: new Map(), card: new Map(), variant: new Map(), variant_category: new Map() }
  for (const r of rules) index[r.scope].set(r.target, r.action)
  return index
}

function decide(p: PrintingRef, index: RuleIndex): boolean {
  for (const scope of SCOPE_ORDER) {
    const key = scope === 'printing' ? p.id : scope === 'card' ? p.cardId : scope === 'variant' ? p.variantId : p.variantCategory
    const action = index[scope].get(key)
    if (action !== undefined) return action === 'include'
  }
  return true
}

/** The rule to write so that `target` at `scope` ends up required or not, given what the coarser scopes imply. */
export function ruleFor(scope: RequirementScope, target: string, required: boolean): RequirementRule {
  return { scope, target, action: required ? 'include' : 'exclude' }
}

/** Whether a whole variant counts, from its own rule or its category's; printing/card rules are ignored here. */
export function variantRequired(variant: { id: string; category: string }, rules: readonly RequirementRule[]): boolean {
  const own = rules.find((r) => r.scope === 'variant' && r.target === variant.id)
  if (own) return own.action === 'include'
  const cat = rules.find((r) => r.scope === 'variant_category' && r.target === variant.category)
  return cat ? cat.action === 'include' : true
}
