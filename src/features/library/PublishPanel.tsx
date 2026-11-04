import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/Alert'
import { setKeys, type UserSetOverview } from '@/features/sets/api'
import type { SetVisibility } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'
import { libraryKeys, setVisibility } from './api'

/** Owner control: publish a custom set's checklist to the library, or take it back. */
export function PublishPanel({ set }: { set: UserSetOverview }) {
  const queryClient = useQueryClient()
  const change = useMutation({
    mutationFn: (v: SetVisibility) => setVisibility(set.catalog_set_id, v),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: setKeys.all })
      await queryClient.invalidateQueries({ queryKey: libraryKeys.all })
    },
  })
  const others = set.other_tracker_count
  return (
    <section aria-labelledby="publish-heading" className="rounded-lg border border-line bg-surface-1 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="publish-heading" className="text-lg font-light text-fg">Checklist Library</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            {set.visibility === 'public'
              ? `Published. Any signed-in collector can add or copy this checklist. ${others} ${others === 1 ? 'other collector has' : 'other collectors have'} added it; their progress stays private to them.`
              : 'Private. Publish the checklist (cards, variants and printings only, never what you own) so other collectors can track or copy it.'}
          </p>
        </div>
        <div role="group" aria-label="Library visibility" className="inline-flex rounded-md border border-line p-0.5">
          {(['private', 'public'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={set.visibility === v} disabled={change.isPending} onClick={() => { if (set.visibility !== v) change.mutate(v) }} className={cn('rounded px-3 py-1 text-sm transition-colors', set.visibility === v ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg')}>
              {v === 'private' ? 'Private' : 'Published'}
            </button>
          ))}
        </div>
      </div>
      {set.visibility === 'public' && others > 0 ? <p className="mt-2 text-xs text-fg-subtle">Unpublishing removes it from the library; collectors who already added it keep their copy of the checklist and their progress.</p> : null}
      {change.isError ? <Alert tone="danger" className="mt-3">{change.error.message}</Alert> : null}
    </section>
  )
}
