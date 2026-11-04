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
import { deleteCustomSet, getUserSet, setDisplayName, setKeys } from './api'

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
      void navigate('/sets', { replace: true })
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
          isOwner ? (
            <>
              <ButtonLink to={`/sets/${data.id}/import`} variant="secondary" size="sm">Import</ButtonLink>
              <ButtonLink to={`/sets/${data.id}/edit`} variant="secondary" size="sm">Edit details</ButtonLink>
              <InlineConfirm
                label="Delete set"
                confirmLabel="Delete set and all its cards"
                description="This removes the set, its cards, variants and printings."
                pending={remove.isPending}
                onConfirm={() => remove.mutate()}
              />
            </>
          ) : null
        }
      />
      {typeof notice === 'string' ? <Alert tone="success" className="mb-4">{notice}</Alert> : null}
      {remove.isError ? <Alert tone="danger" className="mb-4">{remove.error.message}</Alert> : null}
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
        <CardsSection setId={catalogSetId} editable={isOwner} variants={variants.data ?? []} collection={collection} />
      </div>
    </>
  )
}
