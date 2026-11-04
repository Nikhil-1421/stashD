import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { listUserSets, setKeys } from '@/features/sets/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { libraryKeys, listLibrary, type LibraryEntry } from './api'
import { LibraryActions } from './LibraryActions'

/** `/checklists`: checklists other collectors have published. Add one to track it, or copy it to edit. */
export function ChecklistLibraryPage() {
  useDocumentTitle('Checklist Library')
  const auth = useAuth()
  const library = useQuery({ queryKey: libraryKeys.list(), queryFn: listLibrary })
  const mine = useQuery({ queryKey: setKeys.list(), queryFn: listUserSets })
  const [search, setSearch] = useState('')
  const [gameSlug, setGameSlug] = useState<string | null>(null)

  const entries = library.data ?? []
  const trackedByCatalog = new Map((mine.data ?? []).map((s) => [s.catalog_set_id, s.id]))
  const games = Array.from(new Map(entries.filter((e) => e.game_slug).map((e) => [e.game_slug as string, e.game_name ?? e.game_slug])).entries())
  const term = search.trim().toLowerCase()
  const visible = entries.filter((e) => (gameSlug === null || e.game_slug === gameSlug) && (term === '' || e.name.toLowerCase().includes(term) || (e.set_code ?? '').toLowerCase().includes(term) || e.publisher_name.toLowerCase().includes(term)))

  return (
    <>
      <PageHeader title="Checklist Library" description="Checklists published by other collectors. Add one to track your own progress against it, or copy it to make it yours." />
      {library.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : library.isError ? (
        <Alert tone="danger" title="Could not load the library">{library.error.message}</Alert>
      ) : entries.length === 0 ? (
        <EmptyState title="Nothing published yet" description="When a collector publishes a custom set, it shows up here. You can publish your own from a set page: Edit checklist → Checklist Library → Published." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input type="search" aria-label="Search the library" placeholder="Search by name, code or publisher…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            {games.length > 1 ? (
              <div role="group" aria-label="Filter by game" className="flex flex-wrap gap-1">
                <Chip active={gameSlug === null} onClick={() => setGameSlug(null)}>All</Chip>
                {games.map(([slug, name]) => <Chip key={slug} active={gameSlug === slug} onClick={() => setGameSlug(slug)}>{name}</Chip>)}
              </div>
            ) : null}
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">No checklists match.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {visible.map((e) => (
                <li key={e.id}>
                  <LibraryTile entry={e} trackedUserSetId={trackedByCatalog.get(e.id) ?? null} isPublisher={e.publisher_id === auth.user?.id} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

function LibraryTile({ entry, trackedUserSetId, isPublisher }: { entry: LibraryEntry; trackedUserSetId: string | null; isPublisher: boolean }) {
  const year = entry.release_date ? entry.release_date.slice(0, 4) : null
  return (
    <article className="flex h-full flex-col rounded-lg border border-line bg-surface-1 p-4">
      <Link to={`/checklists/${entry.id}`} className="text-sm font-semibold text-fg underline-offset-4 hover:underline">{entry.name}</Link>
      <p className="mt-0.5 truncate text-xs text-fg-muted">{[entry.game_name, entry.set_code, year].filter(Boolean).join(' · ') || 'No game assigned'}</p>
      <p className="mt-2 font-mono text-xs text-fg-subtle">
        {entry.card_count} {entry.card_count === 1 ? 'card' : 'cards'} · {entry.variant_count} {entry.variant_count === 1 ? 'variant' : 'variants'} · {entry.tracker_count} {entry.tracker_count === 1 ? 'collector' : 'collectors'}
      </p>
      <p className="mt-1 text-xs text-fg-muted">Published by {isPublisher ? 'you' : entry.publisher_name}</p>
      {entry.description ? <p className="mt-2 line-clamp-2 text-sm text-fg-muted">{entry.description}</p> : null}
      <div className="mt-auto pt-3">
        <LibraryActions catalogSetId={entry.id} trackedUserSetId={trackedUserSetId} isPublisher={isPublisher} />
      </div>
    </article>
  )
}
