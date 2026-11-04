import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { describedBy } from '@/components/ui/form-utils'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { fieldErrors, type FieldErrors } from '@/features/auth/validation'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { createCustomSet, getUserSet, listGames, setKeys, updateCustomSet, type UserSetOverview } from './api'
import { customSetSchema, EMPTY_SET_INPUT, LANGUAGE_OPTIONS, type CustomSetInput } from './schema'

/** `/sets/new` and `/sets/:userSetId/edit`. */
export function SetFormPage() {
  const { userSetId } = useParams()
  const isEdit = userSetId !== undefined
  useDocumentTitle(isEdit ? 'Edit set' : 'New custom set')

  const existing = useQuery({
    queryKey: setKeys.detail(userSetId ?? ''),
    queryFn: () => getUserSet(userSetId ?? ''),
    enabled: isEdit,
  })

  if (isEdit) {
    if (existing.isPending) return <Skeleton className="h-64 w-full" />
    if (existing.isError) return <Alert tone="danger" title="Could not load the set">{existing.error.message}</Alert>
    if (!existing.data) return <Alert tone="warning" title="Set not found">It may have been deleted.</Alert>
    if (!existing.data.set_owner_id) {
      return <Alert tone="info" title="Shared catalog set">Catalog sets cannot be edited. Create a custom set to change details.</Alert>
    }
    return <SetForm existing={existing.data} />
  }
  return <SetForm />
}

function toInput(set: UserSetOverview): CustomSetInput {
  return {
    name: set.set_name,
    gameId: set.game_id ?? '',
    setCode: set.set_code ?? '',
    series: set.series ?? '',
    releaseDate: set.release_date ?? '',
    language: set.language,
    description: set.description ?? '',
  }
}

function SetForm({ existing }: { existing?: UserSetOverview }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const games = useQuery({ queryKey: setKeys.games, queryFn: listGames, staleTime: Infinity })
  const [fields, setFields] = useState<CustomSetInput>(existing ? toInput(existing) : EMPTY_SET_INPUT)
  const [errors, setErrors] = useState<FieldErrors<CustomSetInput>>({})

  const mutation = useMutation({
    mutationFn: async (input: CustomSetInput) => {
      if (existing) {
        await updateCustomSet(existing.catalog_set_id, input)
        return existing.id
      }
      return createCustomSet(input)
    },
    onSuccess: async (userSetId) => {
      await queryClient.invalidateQueries({ queryKey: setKeys.all })
      void navigate(`/sets/${userSetId}`, { replace: true })
    },
  })

  function set<K extends keyof CustomSetInput>(key: K, value: CustomSetInput[K]) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = customSetSchema.safeParse(fields)
    if (!parsed.success) {
      setErrors(fieldErrors<CustomSetInput>(parsed.error))
      return
    }
    setErrors({})
    mutation.mutate(parsed.data)
  }

  const backTo = existing ? `/sets/${existing.id}` : '/sets'

  return (
    <>
      <PageHeader
        title={existing ? 'Edit set' : 'New custom set'}
        description={existing ? undefined : 'A set you define yourself. You can add cards and variants next.'}
      />
      <form onSubmit={onSubmit} noValidate className="max-w-2xl space-y-5 rounded-lg border border-line bg-surface-1 p-5">
        {mutation.isError ? <Alert tone="danger" title="Could not save">{mutation.error.message}</Alert> : null}

        <FormField id="name" label="Name" error={errors.name}>
          <Input id="name" required maxLength={120} value={fields.name} invalid={Boolean(errors.name)} aria-describedby={describedBy('name', errors.name)} onChange={(e) => set('name', e.target.value)} />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="gameId" label="Game" error={errors.gameId}>
            <Select id="gameId" value={fields.gameId} onChange={(e) => set('gameId', e.target.value)} disabled={games.isPending}>
              <option value="">Not specified</option>
              {(games.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField id="language" label="Language" error={errors.language}>
            <Select id="language" value={fields.language} onChange={(e) => set('language', e.target.value)}>
              {LANGUAGE_OPTIONS.map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </Select>
          </FormField>
          <FormField id="setCode" label="Set code" error={errors.setCode} hint="Optional, e.g. SV01">
            <Input id="setCode" maxLength={20} value={fields.setCode} invalid={Boolean(errors.setCode)} aria-describedby={describedBy('setCode', errors.setCode, 'hint')} onChange={(e) => set('setCode', e.target.value)} />
          </FormField>
          <FormField id="releaseDate" label="Release date" error={errors.releaseDate} hint="Optional">
            <Input id="releaseDate" type="date" value={fields.releaseDate} invalid={Boolean(errors.releaseDate)} aria-describedby={describedBy('releaseDate', errors.releaseDate, 'hint')} onChange={(e) => set('releaseDate', e.target.value)} />
          </FormField>
          <FormField id="series" label="Series" error={errors.series} hint="Optional, e.g. Scarlet & Violet" className="sm:col-span-2">
            <Input id="series" maxLength={120} value={fields.series} invalid={Boolean(errors.series)} aria-describedby={describedBy('series', errors.series, 'hint')} onChange={(e) => set('series', e.target.value)} />
          </FormField>
        </div>

        <FormField id="description" label="Description" error={errors.description} hint="Optional">
          <Textarea id="description" maxLength={2000} value={fields.description} invalid={Boolean(errors.description)} aria-describedby={describedBy('description', errors.description, 'hint')} onChange={(e) => set('description', e.target.value)} />
        </FormField>

        <div className="flex items-center justify-end gap-3">
          <Link to={backTo} className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">Cancel</Link>
          <Button type="submit" loading={mutation.isPending}>{existing ? 'Save changes' : 'Create set'}</Button>
        </div>
      </form>
    </>
  )
}
