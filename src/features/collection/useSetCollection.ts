import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { VariantDefinition } from '@/features/cards/api'
import { collectionKeys, deleteRule, deleteRules, listAllPrintings, listItems, listRules, setItem, setItemsBulk, upsertRule, upsertRules, type CollectionItem, type ItemPatch, type QuantityWrite } from './api'
import { computeCompletion, type Completion } from './domain/completion'
import { resolveRequired, ruleFor, type PrintingRef, type RequirementRule } from './domain/requirements'
import type { RequirementScope } from '@/lib/supabase/database.types'

export type SetCollection = {
  status: 'pending' | 'error' | 'ready'
  error: Error | null
  printings: PrintingRef[]
  required: Set<string>
  itemsByPrinting: Map<string, CollectionItem>
  /** printing id → quantity owned (only printings with an item row). */
  owned: Map<string, number>
  rules: RequirementRule[]
  completion: Completion
  /** Optimistic quantity toggle 0 ↔ 1 (or set an explicit quantity). Rolls back on error. */
  setQuantity: (printingId: string, quantity: number) => void
  /** Optimistic bulk quantity write (chunked upsert). Resolves when saved; rolls back and rejects on error. */
  setQuantities: (writes: readonly QuantityWrite[]) => Promise<void>
  patchItem: (printingId: string, patch: ItemPatch) => Promise<void>
  setRequired: (scope: RequirementScope, target: string, required: boolean) => void
  /**
   * Replaces every rule at `scope` for the given targets with `rules` (which must all be at that
   * scope). Used for bulk include/exclude and for undoing it. Resolves after the rules refetch.
   */
  replaceRules: (scope: RequirementScope, targets: readonly string[], rules: readonly RequirementRule[]) => Promise<void>
  mutationError: Error | null
  pendingPrinting: string | null
  /** Printings with an in-flight bulk write. */
  pendingPrintings: ReadonlySet<string>
  bulkPending: boolean
}

const EMPTY_RULES: RequirementRule[] = []
const EMPTY_PENDING: ReadonlySet<string> = new Set()
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
  const applyWrites = (old: CollectionItem[] = [], writes: readonly QuantityWrite[]): CollectionItem[] => {
    const byPrinting = new Map(old.map((i) => [i.printing_id, i]))
    for (const w of writes) {
      const existing = byPrinting.get(w.printingId)
      byPrinting.set(w.printingId, existing ? { ...existing, quantity: w.quantity } : { id: `optimistic-${w.printingId}`, user_set_id: userSetId, printing_id: w.printingId, quantity: w.quantity, condition: null, notes: null, created_at: '', updated_at: '' })
    }
    return [...byPrinting.values()]
  }
  const mergeRows = (old: CollectionItem[] = [], rows: readonly CollectionItem[]): CollectionItem[] => {
    const byPrinting = new Map(old.map((i) => [i.printing_id, i]))
    for (const r of rows) byPrinting.set(r.printing_id, r)
    return [...byPrinting.values()]
  }

  const quantityMutation = useMutation({
    mutationFn: ({ printingId, quantity: q }: { printingId: string; quantity: number }) => setItem(userSetId, printingId, { quantity: q }),
    onMutate: async ({ printingId, quantity: q }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey })
      const previous = queryClient.getQueryData<CollectionItem[]>(itemsKey)
      queryClient.setQueryData<CollectionItem[]>(itemsKey, (old) => applyWrites(old, [{ printingId, quantity: q }]))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(itemsKey, context.previous)
    },
    onSuccess: (row) => {
      queryClient.setQueryData<CollectionItem[]>(itemsKey, (old) => mergeRows(old, [row]))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['user-sets'] }),
  })

  const bulkMutation = useMutation({
    mutationFn: (writes: readonly QuantityWrite[]) => setItemsBulk(userSetId, writes),
    onMutate: async (writes) => {
      await queryClient.cancelQueries({ queryKey: itemsKey })
      const previous = queryClient.getQueryData<CollectionItem[]>(itemsKey)
      queryClient.setQueryData<CollectionItem[]>(itemsKey, (old) => applyWrites(old, writes))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(itemsKey, context.previous)
    },
    onSuccess: (rows) => {
      queryClient.setQueryData<CollectionItem[]>(itemsKey, (old) => mergeRows(old, rows))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['user-sets'] }),
  })

  const patchMutation = useMutation({
    mutationFn: ({ printingId, patch }: { printingId: string; patch: ItemPatch }) => setItem(userSetId, printingId, patch),
    onSuccess: async (row) => {
      queryClient.setQueryData<CollectionItem[]>(itemsKey, (old) => mergeRows(old, [row]))
      await queryClient.invalidateQueries({ queryKey: ['user-sets'] })
    },
  })

  const ruleMutation = useMutation({
    mutationFn: ({ scope, target, required: wanted }: { scope: RequirementScope; target: string; required: boolean }) =>
      // Default is "include", so "required" at a scope with no coarser exclusion is simply the absence of a rule.
      wanted ? deleteRule(userSetId, scope, target).then(() => (coarserExcludes(rules, scope, target, printings) ? upsertRule(userSetId, ruleFor(scope, target, true)) : undefined)) : upsertRule(userSetId, ruleFor(scope, target, false)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionKeys.rules(userSetId) }),
  })

  const replaceRulesMutation = useMutation({
    mutationFn: async ({ scope, targets, rules: next }: { scope: RequirementScope; targets: readonly string[]; rules: readonly RequirementRule[] }) => {
      await deleteRules(userSetId, scope, targets)
      await upsertRules(userSetId, next)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: collectionKeys.rules(userSetId) }),
  })

  const status = printingsQuery.isError || itemsQuery.isError || rulesQuery.isError ? 'error' : printingsQuery.isPending || itemsQuery.isPending || rulesQuery.isPending ? 'pending' : 'ready'
  const pendingPrintings = useMemo<ReadonlySet<string>>(() => (bulkMutation.isPending ? new Set(bulkMutation.variables.map((w) => w.printingId)) : EMPTY_PENDING), [bulkMutation.isPending, bulkMutation.variables])

  return {
    status,
    error: printingsQuery.error ?? itemsQuery.error ?? rulesQuery.error,
    printings,
    required,
    itemsByPrinting,
    owned,
    rules,
    completion,
    setQuantity: (printingId, q) => quantityMutation.mutate({ printingId, quantity: q }),
    setQuantities: (writes) => (writes.length === 0 ? Promise.resolve() : bulkMutation.mutateAsync(writes).then(() => undefined)),
    patchItem: (printingId, p) => patchMutation.mutateAsync({ printingId, patch: p }).then(() => undefined),
    setRequired: (scope, target, r) => ruleMutation.mutate({ scope, target, required: r }),
    replaceRules: (scope, targets, next) => replaceRulesMutation.mutateAsync({ scope, targets, rules: next }).then(() => undefined),
    mutationError: quantityMutation.error ?? bulkMutation.error ?? patchMutation.error ?? ruleMutation.error ?? replaceRulesMutation.error,
    pendingPrinting: quantityMutation.isPending ? quantityMutation.variables.printingId : null,
    pendingPrintings,
    bulkPending: bulkMutation.isPending || replaceRulesMutation.isPending,
  }
}

/** True when, with the rule at (scope, target) removed, some printing under that target would still be excluded by a coarser rule. */
export function coarserExcludes(rules: readonly RequirementRule[], scope: RequirementScope, target: string, printings: readonly PrintingRef[]): boolean {
  const remaining = rules.filter((r) => !(r.scope === scope && r.target === target))
  const under = printings.filter((p) => (scope === 'variant' ? p.variantId === target : scope === 'card' ? p.cardId === target : scope === 'printing' ? p.id === target : p.variantCategory === target))
  const requiredNow = resolveRequired(under, remaining)
  return under.some((p) => !requiredNow.has(p.id))
}
