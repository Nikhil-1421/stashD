import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { CardsSection } from '@/features/cards/CardsSection'
import { VariantsSection } from '@/features/cards/VariantsSection'
import { cardKeys, listVariants } from '@/features/cards/api'
import { CollectionProgress } from '@/features/collection/CollectionProgress'
import { variantRequired } from '@/features/collection/domain/requirements'
import { useSetCollection } from '@/features/collection/useSetCollection'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { duplicateSet, libraryKeys, untrackSet } from '@/features/library/api'
import { PublishPanel } from '@/features/library/PublishPanel'
import { Button } from '@/components/ui/Button'
import { deleteCustomSet, getUserSet, setDisplayName, setKeys } from './api'
import { SetNotesSection } from './SetNotesSection'

export function SetDetailPage() {
  const { userSetId = '' } = useParams()
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: unknown } | null)?.notice
  const queryClient = useQueryClient()

  const set = useQuery({ queryKey: setKeys.detail(userSetId), queryFn: () => getUserSet(userSetId) })
  const catalogSetId = set.data?.catalog_set_id ?? ''
  const variants = useQuery({ queryKey: cardKeys.variants(catalogSetId), queryFn: () => listVariants(catalogSetId), enabled: catalogSetId !== '' })
  const collection = useSetCollection(userSetId, catalogSetId, variants.data)
  useDocumentTitle(set.data ? setDisplayName(set.data) : 'Set')

  const remove = useMutation({
    mutationFn: () => deleteCustomSet(catalogSetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: setKeys.all })
      await queryClient.invalidateQueries({ queryKey: libraryKeys.all })
      void navigate('/sets', { replace: true })
    },
  })
  const untrack = useMutation({
    mutationFn: () => untrackSet(userSetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: setKeys.all })
      await queryClient.invalidateQueries({ queryKey: libraryKeys.all })
      void navigate('/sets', { replace: true })
    },
  })
  const copy = useMutation({
    mutationFn: () => duplicateSet(catalogSetId),
    onSuccess: async (newUserSetId) => {
      await queryClient.invalidateQueries({ queryKey: setKeys.all })
      void navigate(`/sets/${newUserSetId}`, { state: { notice: 'Copied into a private set of your own. Edit it freely.' } })
    },
  })

  if (set.isPending) return <Skeleton className="h-40 w-full" />
  if (set.isError) return <Alert tone="danger" title="Could not load the set">{set.error.message}</Alert>
  if (!set.data) return <Alert tone="warning" title="Set not found">It may have been deleted, or the link is wrong.</Alert>

  const data = set.data
  const isOwner = data.set_owner_id !== null && data.set_owner_id === auth.user?.id
  const meta = [data.game_name, data.set_code, data.series, data.release_date, data.language.toUpperCase()].filter(Boolean).join(' · ')

  return (
    <>
      <PageHeader
        title={setDisplayName(data)}
        description={meta || undefined}
        actions={
          <>
            <ButtonLink to={`/sets/${data.id}/bubble`} size="sm">Bubble Check</ButtonLink>
            {isOwner ? (
              <>
                <ButtonLink to={`/sets/${data.id}/import`} variant="secondary" size="sm">Import</ButtonLink>
                <ButtonLink to={`/sets/${data.id}/edit`} variant="secondary" size="sm">Edit details</ButtonLink>
                <InlineConfirm
                  label="Delete set"
                  confirmLabel={data.visibility === 'public' && data.other_tracker_count > 0 ? `Delete for you and ${data.other_tracker_count} other ${data.other_tracker_count === 1 ? 'collector' : 'collectors'}` : 'Delete set and all its cards'}
                  description={data.visibility === 'public' && data.other_tracker_count > 0 ? 'This checklist is published and others track it; deleting it removes their progress too. Unpublish instead to keep theirs.' : 'This removes the set, its cards, variants and printings.'}
                  pending={remove.isPending}
                  onConfirm={() => remove.mutate()}
                />
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" loading={copy.isPending} onClick={() => copy.mutate()}>Copy as my own</Button>
                <InlineConfirm
                  label="Remove from my collection"
                  confirmLabel="Remove and discard my progress"
                  description="Your owned marks, rules and notes for this set are deleted. The checklist itself stays in the library."
                  pending={untrack.isPending}
                  onConfirm={() => untrack.mutate()}
                />
              </>
            )}
          </>
        }
      />
      {typeof notice === 'string' ? <Alert tone="success" className="mb-4">{notice}</Alert> : null}
      {remove.isError ? <Alert tone="danger" className="mb-4">{remove.error.message}</Alert> : null}
      {untrack.isError ? <Alert tone="danger" className="mb-4">{untrack.error.message}</Alert> : null}
      {copy.isError ? <Alert tone="danger" className="mb-4">{copy.error.message}</Alert> : null}
      {!isOwner && data.set_owner_id ? <Alert tone="info" className="mb-4">This checklist comes from the Checklist Library. Your progress, rules and notes are private; copy it to change the cards.</Alert> : null}
      {data.description ? <p className="mb-6 max-w-3xl text-sm text-fg-muted">{data.description}</p> : null}

      <div className="space-y-6">
        <CollectionProgress completion={collection.completion} pending={collection.status === 'pending' || variants.isPending} />
        {collection.status === 'error' && collection.error ? <Alert tone="danger" title="Could not load your collection for this set">{collection.error.message}</Alert> : null}
        <VariantsSection
          setId={catalogSetId}
          editable={isOwner}
          variants={variants}
          requirements={{
            ready: collection.status === 'ready',
            isRequired: (v) => variantRequired(v, collection.rules),
            setRequired: (variantId, required) => collection.setRequired('variant', variantId, required),
          }}
        />
        <CardsSection setId={catalogSetId} editable={isOwner} variants={variants.data ?? []} collection={collection} order={data.card_order} />
        <SetNotesSection userSetId={data.id} />
        {isOwner ? <PublishPanel set={data} /> : null}
      </div>
    </>
  )
}
