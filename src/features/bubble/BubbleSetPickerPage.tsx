import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { listUserSets, setDisplayName, setKeys } from '@/features/sets/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Entry point for Bubble Check: pick one of your tracked sets. */
export function BubbleSetPickerPage() {
  useDocumentTitle('Bubble Check')
  const query = useQuery({ queryKey: setKeys.list(), queryFn: listUserSets })
  const sets = query.data ?? []

  return (
    <>
      <PageHeader title="Bubble Check" description="Pick a set, then tap through its cards. Progress updates as you go." />
      {query.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : query.isError ? (
        <Alert tone="danger" title="Could not load your sets">{query.error.message}</Alert>
      ) : sets.length === 0 ? (
        <EmptyState title="No sets to check yet" description="Create or import a set first; Bubble Check works on any set you track." action={<ButtonLink to="/sets/new">New custom set</ButtonLink>} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => {
            const total = set.printing_count
            const owned = set.owned_printings
            const percent = total === 0 ? 0 : Math.round((owned / total) * 100)
            return (
              <li key={set.id}>
                <Link to={`/sets/${set.id}/bubble`} className="block rounded-lg border border-line bg-surface-1 p-4 transition-colors hover:border-line-strong hover:bg-surface-2">
                  <p className="truncate text-sm font-semibold text-fg">{setDisplayName(set)}</p>
                  <p className="mt-0.5 truncate text-xs text-fg-muted">{[set.game_name, set.set_code].filter(Boolean).join(' · ') || 'No game assigned'}</p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-1.5 font-mono text-xs text-fg-subtle">
                    {owned}/{total} printings owned · {set.card_count} {set.card_count === 1 ? 'card' : 'cards'}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
