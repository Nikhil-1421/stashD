import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { CARDS_PAGE_SIZE, cardKeys, listCards, listPrintings, listVariants } from '@/features/cards/api'
import { listUserSets, setDisplayName, setKeys } from '@/features/sets/api'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import type { PrintingDetail } from './api'

export type ArmedPrinting = { printingId: string; detail: PrintingDetail }

type Props = { armed: ArmedPrinting | null; onArm: (next: ArmedPrinting | null) => void; placedCount: (printingId: string) => number }

/** Pick a tracked set, search its cards, and arm a printing for placing into slots. */
export function CardSourcePanel({ armed, onArm, placedCount }: Props) {
  const sets = useQuery({ queryKey: setKeys.list(), queryFn: listUserSets })
  const [chosenSetId, setChosenSetId] = useState<string | null>(null)
  const set = (sets.data ?? []).find((s) => s.id === chosenSetId) ?? sets.data?.[0]
  const catalogSetId = set?.catalog_set_id ?? ''
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim(), 300)
  const [page, setPage] = useState(0)

  const variants = useQuery({ queryKey: cardKeys.variants(catalogSetId), queryFn: () => listVariants(catalogSetId), enabled: catalogSetId !== '' })
  const cards = useQuery({ queryKey: cardKeys.list(catalogSetId, page, term), queryFn: () => listCards(catalogSetId, page, term), enabled: catalogSetId !== '', placeholderData: keepPreviousData })
  const cardIds = (cards.data?.rows ?? []).map((c) => c.id)
  const printings = useQuery({ queryKey: cardKeys.printings(catalogSetId, cardIds), queryFn: () => listPrintings(cardIds), enabled: cardIds.length > 0 })
  const printingByCell = new Map((printings.data ?? []).map((p) => [`${p.catalog_card_id}:${p.variant_definition_id}`, p.id]))
  const total = cards.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / CARDS_PAGE_SIZE))

  if (sets.isPending) return <Skeleton className="h-40 w-full" />
  if (sets.isError) return <Alert tone="danger">{sets.error.message}</Alert>
  if (!set) return <Alert tone="info" title="No sets to pick from">Track or create a set first; its cards appear here.</Alert>

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-fg-muted">
        Set
        <Select value={set.id} onChange={(e) => { setChosenSetId(e.target.value); setPage(0); setSearch('') }} className="mt-1 h-9 text-sm">
          {(sets.data ?? []).map((s) => <option key={s.id} value={s.id}>{setDisplayName(s)}</option>)}
        </Select>
      </label>
      <Input type="search" aria-label="Search cards" placeholder="Search name or number…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="h-9 text-sm" />
      {cards.isPending || variants.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : cards.isError ? (
        <Alert tone="danger">{cards.error.message}</Alert>
      ) : (cards.data?.rows.length ?? 0) === 0 ? (
        <p className="py-4 text-center text-sm text-fg-muted">{term ? 'No cards match.' : 'This set has no cards yet.'}</p>
      ) : (
        <ul className={cn('max-h-[60vh] divide-y divide-line overflow-y-auto rounded-md border border-line scrollbar-thin', cards.isPlaceholderData && 'opacity-60')} aria-label="Cards">
          {(cards.data?.rows ?? []).map((card) => (
            <li key={card.id} className="px-2 py-1.5">
              <p className="truncate text-sm text-fg">
                {card.number ? <span className="mr-1.5 font-mono text-xs text-fg-muted">#{card.number}</span> : null}
                {card.name}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(variants.data ?? []).map((v) => {
                  const printingId = printingByCell.get(`${card.id}:${v.id}`)
                  if (printingId === undefined) return null
                  const isArmed = armed?.printingId === printingId
                  const placed = placedCount(printingId)
                  const detail: PrintingDetail = { id: printingId, cardId: card.id, name: card.name, number: card.number, setId: catalogSetId, variantName: v.name, variantPosition: v.position }
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={isArmed}
                      aria-label={`${card.name} ${v.name}${placed > 0 ? `, placed ${placed}` : ''}`}
                      onClick={() => onArm(isArmed ? null : { printingId, detail })}
                      className={cn('inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors', isArmed ? 'border-accent bg-accent text-accent-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg')}
                    >
                      {v.name}
                      {placed > 0 ? <span className={cn('font-mono text-[10px]', isArmed ? 'text-accent-fg/80' : 'text-fg-subtle')}>×{placed}</span> : null}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      {total > CARDS_PAGE_SIZE ? (
        <nav aria-label="Card pages" className="flex items-center justify-between text-xs text-fg-muted">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
          <span className="font-mono">{page + 1} / {pageCount}</span>
          <Button variant="secondary" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </nav>
      ) : null}
    </div>
  )
}
