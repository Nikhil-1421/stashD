import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { binderKeys, createBinder, listBinders, type BinderOverview } from './api'
import { BinderForm } from './BinderForm'
import { dimensionsLabel } from './domain/layout'
import type { BinderFormInput } from './schema'

export function BindersPage() {
  useDocumentTitle('Binders')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: binderKeys.list(), queryFn: listBinders })
  const [creating, setCreating] = useState(false)

  const create = useMutation({
    mutationFn: (input: BinderFormInput) => createBinder({ name: input.name, description: input.description, gameId: input.gameId, rows: input.rows, columns: input.columns }),
    onSuccess: async (binderId) => {
      await queryClient.invalidateQueries({ queryKey: binderKeys.all })
      void navigate(`/binders/${binderId}`)
    },
  })

  const binders = query.data ?? []
  const newButton = <Button onClick={() => setCreating(true)} disabled={creating}>New binder</Button>

  return (
    <>
      <PageHeader title="Binders" description="Plan how your cards sit in physical binders. Placement is independent of what you own." actions={binders.length > 0 ? newButton : null} />
      {creating ? (
        <div className="mb-6 max-w-2xl">
          <BinderForm pending={create.isPending} error={create.error?.message ?? null} submitLabel="Create binder" onSubmit={(input) => create.mutate(input)} onCancel={() => setCreating(false)} />
        </div>
      ) : null}
      {query.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : query.isError ? (
        <Alert tone="danger" title="Could not load your binders">{query.error.message}</Alert>
      ) : binders.length === 0 ? (
        creating ? null : <EmptyState title="No binders yet" description="Create a binder, pick a page layout, then fill pages from any set you track or generate them in one go." action={newButton} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {binders.map((b) => (
            <li key={b.id}>
              <BinderTile binder={b} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function BinderTile({ binder }: { binder: BinderOverview }) {
  return (
    <Link to={`/binders/${binder.id}`} className="block rounded-lg border border-line bg-surface-1 p-4 transition-colors hover:border-line-strong hover:bg-surface-2">
      <p className="truncate text-sm font-semibold text-fg">{binder.name}</p>
      <p className="mt-0.5 truncate text-xs text-fg-muted">{[binder.game_name, dimensionsLabel({ rows: binder.default_rows, columns: binder.default_columns })].filter(Boolean).join(' · ')}</p>
      <p className="mt-3 font-mono text-xs text-fg-subtle">
        {binder.page_count} {binder.page_count === 1 ? 'page' : 'pages'} · {binder.placement_count}/{binder.slot_count} slots filled
      </p>
    </Link>
  )
}
