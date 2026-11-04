import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { VariantDefinition } from '@/features/cards/api'
import { collectionKeys, deleteRule, listAllPrintings, listItems, listRules, setItem, upsertRule, type CollectionItem, type ItemPatch } from './api'
import { computeCompletion, type Completion } from './domain/completion'
import { resolveRequired, ruleFor, type PrintingRef, type RequirementRule } from './domain/requirements'
import type { RequirementScope } from '@/lib/supabase/database.types'

export type SetCollection = {
  status: 'pending' | 'error' | 'ready'
  error: Error | null
  printings: PrintingRef[]
  required: Set<string>
  itemsByPrinting: Map<string, CollectionItem>
  rules: RequirementRule[]
  completion: Completion
  /** Optimistic quantity toggle 0 ↔ 1 (or set an explicit quantity). Rolls back on error. */
  setQuantity: (printingId: string, quantity: number) => void
  patchItem: (printingId: string, patch: ItemPatch) => Promise<void>
  setRequired: (scope: RequirementScope, target: string, required: boolean) => void
  mutationError: Error | null
  pendingPrinting: string | null
}

const EMPTY_RULES: RequirementRule[] = []
const EMPTY_COMPLETION: Completion = { required: 0, owned: 0, missing: 0, extra: 0, totalQuantity: 0, percent: 0, byCard: new Map() }

/** Everything the set page needs to show and edit ownership + requirements for one tracked set. */
export function useSetCollection(userSetId: string, catalogSetId: string, variants: readonly VariantDefinition[] | undefined): SetCollection {
  const queryClient = useQueryClient()
  const variantIds = useMemo(() => (variants ?? []).map((v) => v.id), [variants])
  const variantCategory = useMemo(() => new Map((variants ?? []).map((v) => [v.id, v.category])), [variants])

  const printingsQuery = useQuery({
    queryKey: [...collectionKeys.allPrintings(catalogSetId), variantIds.join(',')],
    queryFn: () => listAllPrintings(variantIds),
    enabled: catalogSetId !== '' && variants !== undefined,
  })
  const itemsQuery = useQuery({ queryKey: collectionKeys.items(userSetId), queryFn: () => listItems(userSetId), enabled: userSetId !== '' })
  const rulesQuery = useQuery({ queryKey: collectionKeys.rules(userSetId), queryFn: () => listRules(userSetId), enabled: userSetId !== '' })

  const printings = useMemo<PrintingRef[]>(
    () => (printingsQuery.data ?? []).map((p) => ({ id: p.id, cardId: p.catalog_card_id, variantId: p.variant_definition_id, variantCategory: variantCategory.get(p.variant_definition_id) ?? 'other' })),
    [printingsQuery.data, variantCategory],
  )
  const rules = rulesQuery.data ?? EMPTY_RULES
  const required = useMemo(() => resolveRequired(printings, rules), [printings, rules])
  const itemsByPrinting = useMemo(() => new Map((itemsQuery.data ?? []).map((i) => [i.printing_id, i])), [itemsQuery.data])
  const owned = useMemo(() => new Map([...itemsByPrinting].map(([k, v]) => [k, v.quantity])), [itemsByPrinting])
  const completion = useMemo(() => (printingsQuery.data ? computeCompletion(printings, required, owned) : EMPTY_COMPLETION), [printingsQuery.data, printings, required, owned])

  const itemsKey = collectionKeys.items(userSetId)
  const quantityMutation = useMutation({
    mutationFn: ({ printingId, quantity: q }: { printingId: string; quantity: number }) => setItem(userSetId, printingId, { quantity: q }),
    onMutate: async ({ printingId, quantity: q }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey })
      const previous = queryClient.getQueryData<CollectionItem[]>(itemsKey)
      queryClient.setQueryData<CollectionItem[]>(itemsKey, (old = []) => {
        const existing = old.find((i) => i.printing_id === printingId)
        if (existing) return old.map((i) => (i.printing_id === printingId ? { ...i, quantity: q } : i))
        const optimistic: CollectionItem = { id: `optimistic-${printingId}`, user_set_id: userSetId, printing_id: printingId, quantity: q, condition: null, notes: null, created_at: '', updated_at: '' }
        return [...old, optimistic]
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(itemsKey, context.previous)
    },
    onSuccess: (row) => {
      queryClient.setQueryData<CollectionItem[]>(itemsKey, (old = []) => (old.some((i) => i.printing_id === row.printing_id) ? old.map((i) => (i.printing_id === row.printing_id ? row : i)) : [...old, row]))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['user-sets'] }),
  })

  const patchMutation = useMutation({
    mutationFn: ({ printingId, patch }: { printingId: string; patch: ItemPatch }) => setItem(userSetId, printingId, patch),
    onSuccess: async (row) => {
      queryClient.setQueryData<CollectionItem[]>(itemsKey, (old = []) => (old.some((i) => i.printing_id === row.printing_id) ? old.map((i) => (i.printing_id === row.printing_id ? row : i)) : [...old, row]))
      await queryClient.invalidateQueries({ queryKey: ['user-sets'] })
    },
  })

  const ruleMutation = useMutation({
    mutationFn: ({ scope, target, required: wanted }: { scope: RequirementScope; target: string; required: boolean }) =>
      // Default is "include", so "required" at a scope with no coarser exclusion is simply the absence of a rule.
      wanted ? deleteRule(userSetId, scope, target).then(() => (coarserExcludes(rules, scope, target, printings) ? upsertRule(userSetId, ruleFor(scope, target, true)) : undefined)) : upsertRule(userSetId, ruleFor(scope, target, false)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionKeys.rules(userSetId) }),
  })

  const status = printingsQuery.isError || itemsQuery.isError || rulesQuery.isError ? 'error' : printingsQuery.isPending || itemsQuery.isPending || rulesQuery.isPending ? 'pending' : 'ready'

  return {
    status,
    error: printingsQuery.error ?? itemsQuery.error ?? rulesQuery.error,
    printings,
    required,
    itemsByPrinting,
    rules,
    completion,
    setQuantity: (printingId, q) => quantityMutation.mutate({ printingId, quantity: q }),
    patchItem: (printingId, p) => patchMutation.mutateAsync({ printingId, patch: p }).then(() => undefined),
    setRequired: (scope, target, r) => ruleMutation.mutate({ scope, target, required: r }),
    mutationError: quantityMutation.error ?? patchMutation.error ?? ruleMutation.error,
    pendingPrinting: quantityMutation.isPending ? quantityMutation.variables.printingId : null,
  }
}

/** True when, with the rule at (scope, target) removed, some printing under that target would still be excluded by a coarser rule. */
function coarserExcludes(rules: readonly RequirementRule[], scope: RequirementScope, target: string, printings: readonly PrintingRef[]): boolean {
  const remaining = rules.filter((r) => !(r.scope === scope && r.target === target))
  const under = printings.filter((p) => (scope === 'variant' ? p.variantId === target : scope === 'card' ? p.cardId === target : scope === 'printing' ? p.id === target : p.variantCategory === target))
  const requiredNow = resolveRequired(under, remaining)
  return under.some((p) => !requiredNow.has(p.id))
}
