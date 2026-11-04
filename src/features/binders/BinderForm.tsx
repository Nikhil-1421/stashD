import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { describedBy } from '@/components/ui/form-utils'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { fieldErrors, type FieldErrors } from '@/features/auth/validation'
import { listGames, setKeys } from '@/features/sets/api'
import { LAYOUT_PRESETS, MAX_DIMENSION, MIN_DIMENSION } from './domain/layout'
import { binderSchema, EMPTY_BINDER_INPUT, type BinderFormInput } from './schema'

type Props = { initial?: BinderFormInput; pending: boolean; error: string | null; submitLabel: string; onSubmit: (input: BinderFormInput) => void; onCancel: () => void }

const DIMENSIONS = Array.from({ length: MAX_DIMENSION - MIN_DIMENSION + 1 }, (_, i) => MIN_DIMENSION + i)

/** Create / edit a binder's details and default page layout. */
export function BinderForm({ initial = EMPTY_BINDER_INPUT, pending, error, submitLabel, onSubmit, onCancel }: Props) {
  const games = useQuery({ queryKey: setKeys.games, queryFn: listGames, staleTime: Infinity })
  const [fields, setFields] = useState<BinderFormInput>(initial)
  const [errors, setErrors] = useState<FieldErrors<BinderFormInput>>({})

  function set<K extends keyof BinderFormInput>(key: K, value: BinderFormInput[K]) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = binderSchema.safeParse(fields)
    if (!parsed.success) {
      setErrors(fieldErrors<BinderFormInput>(parsed.error))
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  const presetValue = LAYOUT_PRESETS.find((p) => p.rows === fields.rows && p.columns === fields.columns)?.label ?? 'custom'

  return (
    <form onSubmit={submit} noValidate aria-label={submitLabel} className="space-y-5 rounded-lg border border-line bg-surface-1 p-5">
      {error ? <Alert tone="danger" title="Could not save">{error}</Alert> : null}
      <FormField id="binder-name" label="Name" error={errors.name}>
        <Input id="binder-name" required maxLength={120} value={fields.name} invalid={Boolean(errors.name)} aria-describedby={describedBy('binder-name', errors.name)} onChange={(e) => set('name', e.target.value)} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="binder-game" label="Game" error={errors.gameId}>
          <Select id="binder-game" value={fields.gameId} onChange={(e) => set('gameId', e.target.value)} disabled={games.isPending}>
            <option value="">Not specified</option>
            {(games.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </FormField>
        <FormField id="binder-preset" label="Page layout" hint="Rows × columns; each page can differ later.">
          <Select
            id="binder-preset"
            value={presetValue}
            aria-describedby={describedBy('binder-preset', undefined, 'hint')}
            onChange={(e) => {
              const preset = LAYOUT_PRESETS.find((p) => p.label === e.target.value)
              if (preset) setFields((f) => ({ ...f, rows: preset.rows, columns: preset.columns }))
            }}
          >
            {LAYOUT_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            <option value="custom">Custom</option>
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="binder-rows" label="Rows" error={errors.rows}>
            <Select id="binder-rows" value={fields.rows} onChange={(e) => set('rows', Number(e.target.value))}>
              {DIMENSIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </FormField>
          <FormField id="binder-columns" label="Columns" error={errors.columns}>
            <Select id="binder-columns" value={fields.columns} onChange={(e) => set('columns', Number(e.target.value))}>
              {DIMENSIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </FormField>
        </div>
      </div>
      <FormField id="binder-description" label="Description" error={errors.description} hint="Optional">
        <Textarea id="binder-description" maxLength={2000} rows={2} value={fields.description} invalid={Boolean(errors.description)} aria-describedby={describedBy('binder-description', errors.description, 'hint')} onChange={(e) => set('description', e.target.value)} />
      </FormField>
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={pending}>{submitLabel}</Button>
      </div>
    </form>
  )
}
