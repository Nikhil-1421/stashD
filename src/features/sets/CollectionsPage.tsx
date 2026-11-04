import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useEntitlements } from '@/features/entitlements/context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'
import { listUserSets, setDisplayName, setKeys, type UserSetOverview } from './api'

export function CollectionsPage() {
  useDocumentTitle('Collections')
  const entitlements = useEntitlements()
  const query = useQuery({ queryKey: setKeys.list(), queryFn: listUserSets })
  const [search, setSearch] = useState('')
  const [gameSlug, setGameSlug] = useState<string | null>(null)

  const sets = query.data ?? []
  const games = Array.from(new Map(sets.filter((s) => s.game_slug).map((s) => [s.game_slug as string, s.game_name ?? s.game_slug])).entries())
  const term = search.trim().toLowerCase()
  const visible = sets.filter(
    (s) =>
      (gameSlug === null || s.game_slug === gameSlug) &&
      (term === '' || setDisplayName(s).toLowerCase().includes(term) || (s.set_code ?? '').toLowerCase().includes(term)),
  )

  const newSetAction = entitlements.can('sets.create') ? <ButtonLink to="/sets/new">New custom set</ButtonLink> : null

  return (
    <>
      <PageHeader title="Collections" description="The sets you track." actions={sets.length > 0 ? newSetAction : null} />

      {query.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : query.isError ? (
        <Alert tone="danger" title="Could not load your sets">{query.error.message}</Alert>
      ) : sets.length === 0 ? (
        <EmptyState
          title="No sets yet"
          description="Create a custom set to start a checklist from scratch. Importing files and adding from catalogs arrive in later milestones."
          action={newSetAction}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              type="search"
              aria-label="Search sets"
              placeholder="Search sets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            {games.length > 1 ? (
              <div role="group" aria-label="Filter by game" className="flex flex-wrap gap-1">
                <FilterChip active={gameSlug === null} onClick={() => setGameSlug(null)}>All</FilterChip>
                {games.map(([slug, name]) => (
                  <FilterChip key={slug} active={gameSlug === slug} onClick={() => setGameSlug(slug)}>{name}</FilterChip>
                ))}
              </div>
            ) : null}
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">No sets match.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((set) => (
                <li key={set.id}>
                  <SetTile set={set} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
        active ? 'border-line-strong bg-surface-3 text-fg' : 'border-line text-fg-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

export function SetTile({ set }: { set: UserSetOverview }) {
  const year = set.release_date ? set.release_date.slice(0, 4) : null
  return (
    <Link
      to={`/sets/${set.id}`}
      className="block rounded-lg border border-line bg-surface-1 p-4 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <p className="truncate text-sm font-semibold text-fg">{setDisplayName(set)}</p>
      <p className="mt-0.5 truncate text-xs text-fg-muted">
        {[set.game_name, set.set_code, year].filter(Boolean).join(' · ') || 'No game assigned'}
      </p>
      <p className="mt-3 font-mono text-xs text-fg-subtle">
        {set.card_count} {set.card_count === 1 ? 'card' : 'cards'} · {set.variant_count} {set.variant_count === 1 ? 'variant' : 'variants'}
        {set.printing_count > 0 ? ` · ${set.owned_printings}/${set.printing_count} owned` : ''}
        {set.set_owner_id ? ' · custom' : ''}
      </p>
    </Link>
  )
}
