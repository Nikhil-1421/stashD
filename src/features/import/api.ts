import { requireSupabase } from '@/lib/supabase/client'
import type { ImportSource, Json } from '@/lib/supabase/database.types'
import type { ExistingCard } from './domain/plan'
import type { ConflictStrategy, ImportPayloadCard, PlannedVariant } from './domain/plan'

export type { ImportSource }

export type ImportSummary = { job_id: string; created: number; updated: number; skipped: number; printings: number; variants: number }

const KEY_PAGE = 1000

/** Every card's id/name/number for a set, paged so large sets stay within PostgREST limits. */
export async function listCardKeys(setId: string): Promise<ExistingCard[]> {
  const out: ExistingCard[] = []
  for (let from = 0; ; from += KEY_PAGE) {
    const { data, error } = await requireSupabase()
      .from('catalog_cards')
      .select('id, name, number')
      .eq('catalog_set_id', setId)
      .order('created_at')
      .range(from, from + KEY_PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...data)
    if (data.length < KEY_PAGE) return out
  }
}

export async function importChecklist(args: {
  setId: string
  source: ImportSource
  strategy: ConflictStrategy
  cards: ImportPayloadCard[]
  variants: PlannedVariant[]
}): Promise<ImportSummary> {
  const { data, error } = await requireSupabase().rpc('import_checklist', {
    p_catalog_set_id: args.setId,
    p_source: args.source,
    p_strategy: args.strategy,
    p_cards: args.cards,
    p_variants: args.variants,
  })
  if (error) throw new Error(error.message)
  return parseSummary(data)
}

function parseSummary(data: Json): ImportSummary {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('Unexpected import response.')
  const num = (k: string) => (typeof data[k] === 'number' ? (data[k] as number) : 0)
  return { job_id: typeof data.job_id === 'string' ? data.job_id : '', created: num('created'), updated: num('updated'), skipped: num('skipped'), printings: num('printings'), variants: num('variants') }
}
