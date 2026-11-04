import { requireSupabase } from '@/lib/supabase/client'
import type { RequirementAction, RequirementScope, Tables } from '@/lib/supabase/database.types'
import type { RequirementRule } from './domain/requirements'

export type CollectionItem = Tables<'collection_items'>
export type PrintingRow = Pick<Tables<'card_printings'>, 'id' | 'catalog_card_id' | 'variant_definition_id'>

const PAGE = 1000

export const collectionKeys = {
  all: (userSetId: string) => ['collection', userSetId] as const,
  items: (userSetId: string) => ['collection', userSetId, 'items'] as const,
  rules: (userSetId: string) => ['collection', userSetId, 'rules'] as const,
  /** Every printing of a catalog set (not just the current page); keyed under 'printings' so checklist edits invalidate it too. */
  allPrintings: (setId: string) => ['printings', setId, 'all'] as const,
}

/** All printings of a set, via its variants (every printing's variant belongs to exactly one set). Paged. */
export async function listAllPrintings(variantIds: readonly string[]): Promise<PrintingRow[]> {
  if (variantIds.length === 0) return []
  const out: PrintingRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await requireSupabase()
      .from('card_printings')
      .select('id, catalog_card_id, variant_definition_id')
      .in('variant_definition_id', [...variantIds])
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...data)
    if (data.length < PAGE) return out
  }
}

export async function listItems(userSetId: string): Promise<CollectionItem[]> {
  const out: CollectionItem[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await requireSupabase()
      .from('collection_items')
      .select('*')
      .eq('user_set_id', userSetId)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...data)
    if (data.length < PAGE) return out
  }
}

export type ItemPatch = { quantity?: number; condition?: string | null; notes?: string | null }

/** Upsert by (set, printing). Omitted fields are left as they are; '' clears condition/notes. */
export async function setItem(userSetId: string, printingId: string, patch: ItemPatch): Promise<CollectionItem> {
  const { data, error } = await requireSupabase().rpc('set_collection_item', {
    p_user_set_id: userSetId,
    p_printing_id: printingId,
    p_quantity: patch.quantity ?? null,
    p_condition: patch.condition === undefined ? null : (patch.condition ?? ''),
    p_notes: patch.notes === undefined ? null : (patch.notes ?? ''),
  })
  if (error) throw new Error(error.message)
  return data
}

export async function listRules(userSetId: string): Promise<RequirementRule[]> {
  const { data, error } = await requireSupabase()
    .from('user_set_requirements')
    .select('scope, target, action')
    .eq('user_set_id', userSetId)
  if (error) throw new Error(error.message)
  return data
}

export async function upsertRule(userSetId: string, rule: RequirementRule): Promise<void> {
  const { error } = await requireSupabase()
    .from('user_set_requirements')
    .upsert({ user_set_id: userSetId, scope: rule.scope, target: rule.target, action: rule.action }, { onConflict: 'user_set_id,scope,target' })
  if (error) throw new Error(error.message)
}

export async function deleteRule(userSetId: string, scope: RequirementScope, target: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('user_set_requirements')
    .delete()
    .eq('user_set_id', userSetId)
    .eq('scope', scope)
    .eq('target', target)
  if (error) throw new Error(error.message)
}

export type { RequirementAction, RequirementScope }
