import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { setKeys } from '@/features/sets/api'
import { duplicateSet, libraryKeys, trackSet } from './api'

type Props = { catalogSetId: string; trackedUserSetId: string | null; isPublisher: boolean; size?: 'sm' | 'md' }

/** "Add to my collection" / "In your collection" + "Copy as my own" for a library entry. */
export function LibraryActions({ catalogSetId, trackedUserSetId, isPublisher, size = 'sm' }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: setKeys.all })
    await queryClient.invalidateQueries({ queryKey: libraryKeys.all })
  }
  const track = useMutation({ mutationFn: () => trackSet(catalogSetId), onSuccess: async (userSetId) => { await invalidate(); void navigate(`/sets/${userSetId}`) } })
  const copy = useMutation({ mutationFn: () => duplicateSet(catalogSetId), onSuccess: async (userSetId) => { await invalidate(); void navigate(`/sets/${userSetId}`, { state: { notice: 'Copied into a private set of your own. Edit it freely.' } }) } })
  const error = track.error ?? copy.error

  return (
    <div className="flex flex-wrap items-center gap-2">
      {trackedUserSetId ? (
        <ButtonLink to={`/sets/${trackedUserSetId}`} variant="secondary" size={size}>{isPublisher ? 'Open your set' : 'In your collection'}</ButtonLink>
      ) : (
        <Button size={size} loading={track.isPending} disabled={copy.isPending} onClick={() => track.mutate()}>Add to my collection</Button>
      )}
      <Button variant="secondary" size={size} loading={copy.isPending} disabled={track.isPending} onClick={() => copy.mutate()}>Copy as my own</Button>
      {error ? <Alert tone="danger" className="basis-full">{error.message}</Alert> : null}
    </div>
  )
}
