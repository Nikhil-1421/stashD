import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { CARDS_PAGE_SIZE, cardKeys, listCards, listPrintings, listVariants } from '@/features/cards/api'
import { listUserSets, setKeys } from '@/features/sets/api'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getLibraryEntry, libraryKeys } from './api'
import { LibraryActions } from './LibraryActions'

/** `/checklists/:catalogSetId`: read-only look at a published checklist before adding or copying it. */
export function ChecklistPreviewPage() {
  const { catalogSetId = '' } = useParams()
  const auth = useAuth()
  const entry = useQuery({ queryKey: libraryKeys.detail(catalogSetId), queryFn: () => getLibraryEntry(catalogSetId), enabled: catalogSetId !== '' })
  const mine = useQuery({ queryKey: setKeys.list(), queryFn: listUserSets })
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim(), 300)
  const [page, setPage] = useState(0)
  const order = entry.data?.card_order ?? 'number'
  const variants = useQuery({ queryKey: cardKeys.variants(catalogSetId), queryFn: () => listVariants(catalogSetId), enabled: entry.isSuccess && entry.data !== null })
  const cards = useQuery({ queryKey: cardKeys.list(catalogSetId, page, term, order), queryFn: () => listCards(catalogSetId, page, term, order), enabled: entry.isSuccess && entry.data !== null, placeholderData: keepPreviousData })
  const cardIds = (cards.data?.rows ?? []).map((c) => c.id)
  const printings = useQuery({ queryKey: cardKeys.printings(catalogSetId, cardIds), queryFn: () => listPrintings(cardIds), enabled: cardIds.length > 0 })
  const cells = new Set((printings.data ?? []).map((p) => `${p.catalog_card_id}:${p.variant_definition_id}`))
  useDocumentTitle(entry.data ? `${entry.data.name} · Checklist Library` : 'Checklist Library')

  if (entry.isPending) return <Skeleton className="h-40 w-full" />
  if (entry.isError) return <Alert tone="danger" title="Could not load this checklist">{entry.error.message}</Alert>
  if (!entry.data) return <Alert tone="warning" title="Not in the library">This checklist is private or was removed. <Link to="/checklists" className="underline underline-offset-4">Back to the library</Link></Alert>

  const e = entry.data
  const trackedUserSetId = (mine.data ?? []).find((s) => s.catalog_set_id === e.id)?.id ?? null
  const total = cards.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / CARDS_PAGE_SIZE))
  const meta = [e.game_name, e.set_code, e.series, e.release_date, e.language.toUpperCase(), `published by ${e.publisher_id === auth.user?.id ? 'you' : e.publisher_name}`].filter(Boolean).join(' · ')

  return (
    <>
      <PageHeader title={e.name} description={meta} actions={<LibraryActions catalogSetId={e.id} trackedUserSetId={trackedUserSetId} isPublisher={e.publisher_id === auth.user?.id} />} />
      {e.description ? <p className="mb-6 max-w-3xl text-sm text-fg-muted">{e.description}</p> : null}
      <section aria-labelledby="preview-heading" className="rounded-lg border border-line bg-surface-1">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="preview-heading" className="text-lg font-light text-fg">Checklist</h2>
            <p className="mt-0.5 text-sm text-fg-muted">{e.card_count} {e.card_count === 1 ? 'card' : 'cards'}, {e.variant_count} {e.variant_count === 1 ? 'variant' : 'variants'}. A tick means the card exists in that variant.</p>
          </div>
          <Input type="search" aria-label="Search cards" placeholder="Search name or number…" value={search} onChange={(ev) => { setSearch(ev.target.value); setPage(0) }} className="w-56" />
        </div>
        <div className="overflow-x-auto px-5 py-4 scrollbar-thin">
          {cards.isPending || variants.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : cards.isError ? (
            <Alert tone="danger">{cards.error.message}</Alert>
          ) : (cards.data?.rows.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-fg-muted">{term ? 'No cards match.' : 'No cards in this checklist.'}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-fg-subtle">
                  <th scope="col" className="w-24 py-2 pr-3 font-normal">#</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Name</th>
                  <th scope="col" className="w-32 py-2 pr-3 font-normal">Rarity</th>
                  {(variants.data ?? []).map((v) => <th key={v.id} scope="col" className="w-16 py-2 pr-2 text-center font-normal" title={v.name}><span className="block truncate">{v.name}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {(cards.data?.rows ?? []).map((card) => (
                  <tr key={card.id} className="border-t border-line">
                    <td className="py-2 pr-3 font-mono text-xs text-fg-muted">{card.number ?? '—'}</td>
                    <td className="py-2 pr-3 text-fg">{card.name}</td>
                    <td className="py-2 pr-3 text-fg-muted">{card.rarity ?? ''}</td>
                    {(variants.data ?? []).map((v) => (
                      <td key={v.id} className="py-2 pr-2 text-center text-fg-muted">{cells.has(`${card.id}:${v.id}`) ? '✓' : <span className="text-fg-subtle">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {total > CARDS_PAGE_SIZE ? (
          <nav aria-label="Card pages" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-fg-muted">
            <span>Showing {page * CARDS_PAGE_SIZE + 1}–{Math.min(total, (page + 1) * CARDS_PAGE_SIZE)} of {total}</span>
            <span className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
              <span className="font-mono text-xs">{page + 1} / {pageCount}</span>
              <Button variant="secondary" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </span>
          </nav>
        ) : null}
      </section>
    </>
  )
}
