import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { binderKeys, listBinders } from '@/features/binders/api'
import { listUserSets, setDisplayName, setKeys } from '@/features/sets/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { searchCards, searchKeys, SEARCH_LIMIT } from './api'

/** `/search?q=`: your sets and binders by name, and cards by name or number across every set you track. */
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const [draft, setDraft] = useState(q)
  useDocumentTitle(q ? `Search · ${q}` : 'Search')

  const sets = useQuery({ queryKey: setKeys.list(), queryFn: listUserSets })
  const binders = useQuery({ queryKey: binderKeys.list(), queryFn: listBinders })
  const catalogSetIds = (sets.data ?? []).map((s) => s.catalog_set_id)
  const cards = useQuery({ queryKey: searchKeys.cards(q, catalogSetIds), queryFn: () => searchCards(catalogSetIds, q), enabled: q !== '' && sets.isSuccess })

  const term = q.toLowerCase()
  const setHits = q === '' ? [] : (sets.data ?? []).filter((s) => setDisplayName(s).toLowerCase().includes(term) || (s.set_code ?? '').toLowerCase().includes(term))
  const binderHits = q === '' ? [] : (binders.data ?? []).filter((b) => b.name.toLowerCase().includes(term))
  const userSetByCatalog = new Map((sets.data ?? []).map((s) => [s.catalog_set_id, s]))

  function submit(e: FormEvent) {
    e.preventDefault()
    const next = draft.trim()
    setParams(next ? { q: next } : {}, { replace: q !== '' })
  }

  const nothing = q !== '' && sets.isSuccess && cards.isSuccess && setHits.length === 0 && binderHits.length === 0 && cards.data.length === 0

  return (
    <>
      <PageHeader title="Search" description="Sets and binders by name; cards by name or number across the sets you track." />
      <form onSubmit={submit} role="search" className="mb-6 flex max-w-xl gap-2">
        <Input type="search" aria-label="Search" placeholder="Card name, number, set or binder…" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit">Search</Button>
      </form>

      {q === '' ? (
        <p className="text-sm text-fg-muted">Type something to search. Tip: press <kbd className="rounded border border-line px-1 font-mono text-xs">/</kbd> anywhere to jump here.</p>
      ) : (
        <div className="space-y-6">
          {sets.isError ? <Alert tone="danger">{sets.error.message}</Alert> : null}
          {cards.isError ? <Alert tone="danger" title="Card search failed">{cards.error.message}</Alert> : null}
          {nothing ? <p className="text-sm text-fg-muted">Nothing matches “{q}”.</p> : null}

          {setHits.length > 0 ? (
            <section aria-labelledby="hits-sets">
              <h2 id="hits-sets" className="mb-2 text-sm font-semibold text-fg">Sets <span className="font-mono text-xs text-fg-subtle">{setHits.length}</span></h2>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-1">
                {setHits.map((s) => (
                  <li key={s.id}>
                    <Link to={`/sets/${s.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm text-fg hover:bg-surface-2">
                      <span className="truncate">{setDisplayName(s)}</span>
                      <span className="shrink-0 font-mono text-xs text-fg-subtle">{s.owned_printings}/{s.printing_count} owned</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {binderHits.length > 0 ? (
            <section aria-labelledby="hits-binders">
              <h2 id="hits-binders" className="mb-2 text-sm font-semibold text-fg">Binders <span className="font-mono text-xs text-fg-subtle">{binderHits.length}</span></h2>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-1">
                {binderHits.map((b) => (
                  <li key={b.id}>
                    <Link to={`/binders/${b.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm text-fg hover:bg-surface-2">
                      <span className="truncate">{b.name}</span>
                      <span className="shrink-0 font-mono text-xs text-fg-subtle">{b.page_count} {b.page_count === 1 ? 'page' : 'pages'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="hits-cards">
            <h2 id="hits-cards" className="mb-2 text-sm font-semibold text-fg">
              Cards {cards.isSuccess ? <span className="font-mono text-xs text-fg-subtle">{cards.data.length}{cards.data.length >= SEARCH_LIMIT ? '+' : ''}</span> : null}
            </h2>
            {cards.isPending && sets.isSuccess ? (
              <Skeleton className="h-24 w-full" />
            ) : cards.isSuccess && cards.data.length === 0 ? (
              <p className="text-sm text-fg-muted">No cards match in your sets.</p>
            ) : cards.isSuccess ? (
              <>
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-1">
                  {cards.data.map((c) => {
                    const set = userSetByCatalog.get(c.catalog_set_id)
                    const target = set ? `/sets/${set.id}?q=${encodeURIComponent(c.number ?? c.name)}` : null
                    const inner = (
                      <>
                        <span className="min-w-0 flex-1 truncate">
                          {c.number ? <span className="mr-2 font-mono text-xs text-fg-muted">#{c.number}</span> : null}
                          {c.name}
                          {c.rarity ? <span className="ml-2 text-xs text-fg-subtle">{c.rarity}</span> : null}
                        </span>
                        <span className="shrink-0 truncate text-xs text-fg-muted">{set ? setDisplayName(set) : ''}</span>
                      </>
                    )
                    return (
                      <li key={c.id}>
                        {target ? <Link to={target} className="flex min-h-12 items-center gap-3 px-4 text-sm text-fg hover:bg-surface-2">{inner}</Link> : <div className="flex min-h-12 items-center gap-3 px-4 text-sm text-fg">{inner}</div>}
                      </li>
                    )
                  })}
                </ul>
                {cards.data.length >= SEARCH_LIMIT ? <p className="mt-2 text-xs text-fg-subtle">Showing the first {SEARCH_LIMIT}; narrow the search for more.</p> : null}
              </>
            ) : null}
          </section>
        </div>
      )}
    </>
  )
}
