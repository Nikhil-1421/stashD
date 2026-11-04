import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listPrintingDetails, type PrintingDetail } from './api'

const ROOT = ['printing-details'] as const

/**
 * Display details for printings, accumulated in the query cache: only ids not seen before are
 * fetched, so editing a binder costs one small request per newly placed card, not a refetch of all.
 */
export function usePrintingDetails(ids: readonly string[]): { byId: ReadonlyMap<string, PrintingDetail>; pending: boolean } {
  const queryClient = useQueryClient()
  // Not memoised: the cache is the source of truth and changes whenever a detail query resolves.
  const known = new Map<string, PrintingDetail>()
  for (const [, data] of queryClient.getQueriesData<PrintingDetail[]>({ queryKey: ROOT })) for (const d of data ?? []) known.set(d.id, d)
  const missing = [...new Set(ids)].filter((id) => !known.has(id)).sort()
  const missingKey = missing.join(',')
  const query = useQuery({
    queryKey: [...ROOT, missingKey],
    queryFn: () => listPrintingDetails(missing),
    enabled: missing.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const byId = known
  for (const d of query.data ?? []) byId.set(d.id, d)
  return { byId, pending: query.isPending && missing.length > 0 }
}
