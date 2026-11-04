import { requireSupabase } from '@/lib/supabase/client'
import type { Tables, Views } from '@/lib/supabase/database.types'
import type { SlotWrite } from './domain/placements'

export type Binder = Tables<'binders'>
export type BinderOverview = Views<'binder_overview'>
export type BinderPage = Tables<'binder_pages'>
export type BinderPlacementRow = Tables<'binder_placements'>

const PAGE = 1000

export const binderKeys = {
  all: ['binders'] as const,
  list: () => ['binders', 'list'] as const,
  detail: (binderId: string) => ['binders', 'detail', binderId] as const,
  pages: (binderId: string) => ['binders', 'detail', binderId, 'pages'] as const,
  placements: (binderId: string) => ['binders', 'detail', binderId, 'placements'] as const,
}

export async function listBinders(): Promise<BinderOverview[]> {
  const { data, error } = await requireSupabase().from('binder_overview').select('*').order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function getBinder(binderId: string): Promise<BinderOverview | null> {
  const { data, error } = await requireSupabase().from('binder_overview').select('*').eq('id', binderId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export type BinderInput = { name: string; description: string; gameId: string; rows: number; columns: number }

/** Creates the binder with its first page in one transaction. Returns the binder id. */
export async function createBinder(input: BinderInput, pages = 1): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_binder', {
    p_name: input.name,
    p_rows: input.rows,
    p_columns: input.columns,
    p_game_id: input.gameId === '' ? null : input.gameId,
    p_description: input.description || null,
    p_pages: pages,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function updateBinder(binderId: string, input: BinderInput): Promise<void> {
  const { error } = await requireSupabase()
    .from('binders')
    .update({ name: input.name, description: input.description || null, game_id: input.gameId === '' ? null : input.gameId, default_rows: input.rows, default_columns: input.columns })
    .eq('id', binderId)
  if (error) throw new Error(error.message)
}

/** Deletes the binder and, by cascade, its pages and placements. */
export async function deleteBinder(binderId: string): Promise<void> {
  const { error } = await requireSupabase().from('binders').delete().eq('id', binderId)
  if (error) throw new Error(error.message)
}

export async function listPages(binderId: string): Promise<BinderPage[]> {
  const { data, error } = await requireSupabase().from('binder_pages').select('*').eq('binder_id', binderId).order('page_order')
  if (error) throw new Error(error.message)
  return data
}

export async function addPage(binderId: string, pageOrder: number, rows: number, columns: number): Promise<BinderPage> {
  const { data, error } = await requireSupabase().from('binder_pages').insert({ binder_id: binderId, page_order: pageOrder, rows, columns }).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

export async function updatePageLabel(pageId: string, label: string): Promise<void> {
  const { error } = await requireSupabase().from('binder_pages').update({ label: label || null }).eq('id', pageId)
  if (error) throw new Error(error.message)
}

export async function deletePage(pageId: string): Promise<void> {
  const { error } = await requireSupabase().from('binder_pages').delete().eq('id', pageId)
  if (error) throw new Error(error.message)
}

export async function duplicatePage(pageId: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('duplicate_binder_page', { p_page_id: pageId })
  if (error) throw new Error(error.message)
  return data
}

export async function reorderPages(binderId: string, pageIds: readonly string[]): Promise<void> {
  const { error } = await requireSupabase().rpc('reorder_binder_pages', { p_binder_id: binderId, p_page_ids: [...pageIds] })
  if (error) throw new Error(error.message)
}

/** Coordinate-preserving resize; returns how many placements were dropped. */
export async function resizePage(pageId: string, rows: number, columns: number): Promise<number> {
  const { data, error } = await requireSupabase().rpc('resize_binder_page', { p_page_id: pageId, p_rows: rows, p_columns: columns })
  if (error) throw new Error(error.message)
  return data
}

/** Appends pages filled with the printings in order; returns the number of pages created. */
export async function generatePages(binderId: string, printingIds: readonly string[], rows: number, columns: number): Promise<number> {
  const { data, error } = await requireSupabase().rpc('generate_binder_pages', { p_binder_id: binderId, p_printing_ids: [...printingIds], p_rows: rows, p_columns: columns })
  if (error) throw new Error(error.message)
  return data
}

/** Every placement on the given pages, paged under the hood. */
export async function listPlacements(pageIds: readonly string[]): Promise<BinderPlacementRow[]> {
  if (pageIds.length === 0) return []
  const out: BinderPlacementRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await requireSupabase()
      .from('binder_placements')
      .select('*')
      .in('page_id', [...pageIds])
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...data)
    if (data.length < PAGE) return out
  }
}

export type PrintingDetail = { id: string; cardId: string; name: string; number: string | null; setId: string; variantName: string; variantPosition: number }

const DETAIL_CHUNK = 200

/** Card + variant display fields for printings (immutable enough to cache forever client-side). */
export async function listPrintingDetails(printingIds: readonly string[]): Promise<PrintingDetail[]> {
  const client = requireSupabase()
  const ids = [...new Set(printingIds)]
  const printings: { id: string; catalog_card_id: string; variant_definition_id: string }[] = []
  for (let i = 0; i < ids.length; i += DETAIL_CHUNK) {
    const { data, error } = await client.from('card_printings').select('id, catalog_card_id, variant_definition_id').in('id', ids.slice(i, i + DETAIL_CHUNK))
    if (error) throw new Error(error.message)
    printings.push(...data)
  }
  const cardIds = [...new Set(printings.map((p) => p.catalog_card_id))]
  const variantIds = [...new Set(printings.map((p) => p.variant_definition_id))]
  const cards = new Map<string, { name: string; number: string | null; catalog_set_id: string }>()
  for (let i = 0; i < cardIds.length; i += DETAIL_CHUNK) {
    const { data, error } = await client.from('catalog_cards').select('id, name, number, catalog_set_id').in('id', cardIds.slice(i, i + DETAIL_CHUNK))
    if (error) throw new Error(error.message)
    for (const c of data) cards.set(c.id, c)
  }
  const variants = new Map<string, { name: string; position: number }>()
  for (let i = 0; i < variantIds.length; i += DETAIL_CHUNK) {
    const { data, error } = await client.from('variant_definitions').select('id, name, position').in('id', variantIds.slice(i, i + DETAIL_CHUNK))
    if (error) throw new Error(error.message)
    for (const v of data) variants.set(v.id, v)
  }
  return printings.flatMap((p) => {
    const card = cards.get(p.catalog_card_id)
    const variant = variants.get(p.variant_definition_id)
    if (!card || !variant) return []
    return [{ id: p.id, cardId: p.catalog_card_id, name: card.name, number: card.number, setId: card.catalog_set_id, variantName: variant.name, variantPosition: variant.position }]
  })
}

/**
 * Persists a batch of slot writes: filled slots are upserted on (page, slot), empty ones deleted.
 * Not atomic across the two statements; the editor keeps the batch pending until both succeed.
 */
export async function savePlacements(writes: readonly SlotWrite[]): Promise<void> {
  const client = requireSupabase()
  const upserts = writes.filter((w) => w.placement !== null).map((w) => ({ page_id: w.slot.pageId, slot_index: w.slot.slotIndex, printing_id: w.placement?.printingId ?? '', notes: w.placement?.notes ?? null }))
  if (upserts.length > 0) {
    const { error } = await client.from('binder_placements').upsert(upserts, { onConflict: 'page_id,slot_index' })
    if (error) throw new Error(error.message)
  }
  const clears = writes.filter((w) => w.placement === null)
  const byPage = new Map<string, number[]>()
  for (const w of clears) byPage.set(w.slot.pageId, [...(byPage.get(w.slot.pageId) ?? []), w.slot.slotIndex])
  for (const [pageId, slots] of byPage) {
    const { error } = await client.from('binder_placements').delete().eq('page_id', pageId).in('slot_index', slots)
    if (error) throw new Error(error.message)
  }
}
