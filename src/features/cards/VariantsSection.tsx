import { useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { describedBy } from '@/components/ui/form-utils'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { fieldErrors, type FieldErrors } from '@/features/auth/validation'
import { cardKeys, createVariant, deleteVariant, updateVariant, type VariantDefinition } from './api'
import { EMPTY_VARIANT_INPUT, VARIANT_CATEGORIES, variantSchema, type VariantInput } from './schema'

type Props = { setId: string; editable: boolean; variants: UseQueryResult<VariantDefinition[]> }

/** Per-set variant taxonomy. Each variant is a column in the card table and a printing per card. */
export function VariantsSection({ setId, editable, variants }: Props) {
  const queryClient = useQueryClient()
  const [fields, setFields] = useState<VariantInput>(EMPTY_VARIANT_INPUT)
  const [errors, setErrors] = useState<FieldErrors<VariantInput>>({})
  const invalidate = () => queryClient.invalidateQueries({ queryKey: cardKeys.variants(setId) })
  const invalidateAll = async () => {
    await invalidate()
    await queryClient.invalidateQueries({ queryKey: ['printings', setId] })
    await queryClient.invalidateQueries({ queryKey: cardKeys.all(setId) })
  }

  const create = useMutation({
    mutationFn: (input: VariantInput) => createVariant(setId, input, variants.data?.length ?? 0),
    onSuccess: async () => {
      setFields(EMPTY_VARIANT_INPUT)
      await invalidateAll()
    },
  })
  const toggleDefault = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => updateVariant(id, { applies_by_default: value }),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: string) => deleteVariant(id), onSuccess: invalidateAll })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = variantSchema.safeParse(fields)
    if (!parsed.success) {
      setErrors(fieldErrors<VariantInput>(parsed.error))
      return
    }
    setErrors({})
    create.mutate(parsed.data)
  }

  return (
    <section aria-labelledby="variants-heading" className="rounded-lg border border-line bg-surface-1">
      <div className="border-b border-line px-5 py-4">
        <h2 id="variants-heading" className="text-base font-semibold text-fg">Variants</h2>
        <p className="mt-0.5 text-sm text-fg-muted">
          The printings a card can come in (base, reverse holo, 1st edition…). Each one becomes a column in the checklist.
        </p>
      </div>
      <div className="px-5 py-4">
        {variants.isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : variants.isError ? (
          <Alert tone="danger">{variants.error.message}</Alert>
        ) : variants.data.length === 0 ? (
          <p className="text-sm text-fg-muted">No variants. Add at least one so cards have something to own.</p>
        ) : (
          <ul className="divide-y divide-line">
            {variants.data.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-fg">{v.name}</span>
                  <span className="ml-2 rounded-sm border border-line px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{v.category}</span>
                </span>
                <label className="flex items-center gap-2 text-sm text-fg-muted">
                  <input
                    type="checkbox"
                    className="size-4 accent-accent"
                    checked={v.applies_by_default}
                    disabled={!editable || toggleDefault.isPending}
                    onChange={(e) => toggleDefault.mutate({ id: v.id, value: e.target.checked })}
                  />
                  Applies to new cards
                </label>
                {editable ? (
                  <InlineConfirm
                    label="Remove"
                    confirmLabel="Remove variant"
                    description="Removes this printing from every card."
                    pending={remove.isPending && remove.variables === v.id}
                    onConfirm={() => remove.mutate(v.id)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {(toggleDefault.isError || remove.isError) ? (
          <Alert tone="danger" className="mt-3">{(toggleDefault.error ?? remove.error)?.message}</Alert>
        ) : null}

        {editable ? (
          <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <FormField id="variant-name" label="New variant" error={errors.name}>
              <Input id="variant-name" placeholder="e.g. Reverse Holo" maxLength={60} value={fields.name} invalid={Boolean(errors.name)} aria-describedby={describedBy('variant-name', errors.name)} onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField id="variant-category" label="Category" error={errors.category}>
              <Select id="variant-category" value={fields.category} onChange={(e) => setFields((f) => ({ ...f, category: e.target.value as VariantInput['category'] }))}>
                {VARIANT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </FormField>
            <div className="flex items-center gap-3 pb-0.5">
              <label className="flex items-center gap-2 text-sm text-fg-muted">
                <input type="checkbox" className="size-4 accent-accent" checked={fields.appliesByDefault} onChange={(e) => setFields((f) => ({ ...f, appliesByDefault: e.target.checked }))} />
                Add to every card
              </label>
              <Button type="submit" size="md" loading={create.isPending}>Add variant</Button>
            </div>
            {create.isError ? <Alert tone="danger" className="sm:col-span-3">{create.error.message}</Alert> : null}
          </form>
        ) : null}
      </div>
    </section>
  )
}
