import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { fieldErrors, type FieldErrors } from '@/features/auth/validation'
import { cardStatusLabel, type CardStatus } from '@/features/collection/domain/completion'
import type { SetCollection } from '@/features/collection/useSetCollection'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import { addPrinting, CARDS_PAGE_SIZE, cardKeys, createCard, deleteCard, listCards, removePrinting, updateCard, type CatalogCard, type VariantDefinition } from './api'
import { cardSchema, EMPTY_CARD_INPUT, type CardInput } from './schema'

type Mode = 'collect' | 'edit'
type Props = { setId: string; editable: boolean; variants: VariantDefinition[]; collection: SetCollection }

/**
 * Paginated, searchable card table. Two modes over the same cards × variants grid:
 * - collect (default): each cell is an owned toggle for that printing; rows show completion status.
 * - edit (owners only): each cell says whether the printing exists; rows can be edited/deleted.
 */
export function CardsSection({ setId, editable, variants, collection }: Props) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('collect')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim(), 300)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const effectiveMode: Mode = editable ? mode : 'collect'

  const cards = useQuery({
    queryKey: cardKeys.list(setId, page, term),
    queryFn: () => listCards(setId, page, term),
    enabled: setId !== '',
    placeholderData: keepPreviousData,
  })
  const printingByCell = new Map(collection.printings.map((p) => [`${p.cardId}:${p.variantId}`, p.id]))

  const invalidateCards = () => queryClient.invalidateQueries({ queryKey: cardKeys.all(setId) })
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: setKeysAll })
  const invalidatePrintings = () => queryClient.invalidateQueries({ queryKey: ['printings', setId] })

  const create = useMutation({
    mutationFn: (input: CardInput) => createCard(setId, input),
    onSuccess: async () => {
      await Promise.all([invalidateCards(), invalidateList(), invalidatePrintings()])
    },
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CardInput }) => updateCard(id, input),
    onSuccess: async () => {
      setEditingId(null)
      await invalidateCards()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteCard(id),
    onSuccess: async () => {
      await Promise.all([invalidateCards(), invalidateList(), invalidatePrintings()])
    },
  })
  const togglePrinting = useMutation({
    mutationFn: ({ cardId, variantId, printingId }: { cardId: string; variantId: string; printingId: string | undefined }) =>
      printingId ? removePrinting(printingId) : addPrinting(cardId, variantId),
    onSuccess: async () => {
      await Promise.all([invalidatePrintings(), invalidateList()])
    },
  })

  const total = cards.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / CARDS_PAGE_SIZE))
  const rows = cards.data?.rows ?? []
  const firstError = [create, update, remove, togglePrinting].find((m) => m.isError)?.error ?? collection.mutationError
  const collectionReady = collection.status === 'ready'
  const colSpan = 3 + variants.length + 1

  return (
    <section aria-labelledby="cards-heading" className="rounded-lg border border-line bg-surface-1">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="cards-heading" className="text-base font-semibold text-fg">Cards</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            {total} {total === 1 ? 'card' : 'cards'}.{' '}
            {effectiveMode === 'collect' ? 'Tap a cell to mark that printing owned. Dashed cells are not required.' : 'A ticked cell means the card exists in that variant.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <div role="group" aria-label="Table mode" className="inline-flex rounded-md border border-line p-0.5">
              {(['collect', 'edit'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={effectiveMode === m}
                  onClick={() => setMode(m)}
                  className={cn('rounded px-3 py-1 text-sm transition-colors', effectiveMode === m ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg')}
                >
                  {m === 'collect' ? 'Collect' : 'Edit checklist'}
                </button>
              ))}
            </div>
          ) : null}
          <Input
            type="search"
            aria-label="Search cards by name or number"
            placeholder="Search name or number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="w-56"
          />
        </div>
      </div>

      {effectiveMode === 'edit' ? <AddCardForm pending={create.isPending} onSubmit={(input) => create.mutate(input)} /> : null}
      {firstError ? <Alert tone="danger" className="mx-5 mt-4">{firstError.message}</Alert> : null}

      <div className="overflow-x-auto px-5 py-4 scrollbar-thin">
        {cards.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : cards.isError ? (
          <Alert tone="danger">{cards.error.message}</Alert>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">{term ? 'No cards match your search.' : editable ? 'No cards yet. Switch to "Edit checklist" to add some, or use Import.' : 'No cards in this set yet.'}</p>
        ) : (
          <table className={cn('w-full border-collapse text-sm', cards.isPlaceholderData && 'opacity-60')}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-fg-subtle">
                <th scope="col" className="w-24 py-2 pr-3 font-medium">#</th>
                <th scope="col" className="py-2 pr-3 font-medium">Name</th>
                <th scope="col" className="w-32 py-2 pr-3 font-medium">Rarity</th>
                {variants.map((v) => (
                  <th key={v.id} scope="col" className="w-16 py-2 pr-2 text-center font-medium" title={v.name}>
                    <span className="block truncate">{v.name}</span>
                  </th>
                ))}
                <th scope="col" className="w-40 py-2 text-right font-medium">{effectiveMode === 'edit' ? 'Actions' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((card) => {
                if (editingId === card.id && effectiveMode === 'edit') {
                  return <EditCardRow key={card.id} card={card} colSpan={colSpan} pending={update.isPending} onCancel={() => setEditingId(null)} onSave={(input) => update.mutate({ id: card.id, input })} />
                }
                const status = collection.completion.byCard.get(card.id)?.status ?? 'excluded'
                return (
                  <CardRowGroup key={card.id}>
                    <tr className="border-t border-line">
                      <td className="py-2 pr-3 font-mono text-xs text-fg-muted">{card.number ?? '—'}</td>
                      <td className="py-2 pr-3 text-fg">{card.name}</td>
                      <td className="py-2 pr-3 text-fg-muted">{card.rarity ?? ''}</td>
                      {variants.map((v) => {
                        const printingId = printingByCell.get(`${card.id}:${v.id}`)
                        return (
                          <td key={v.id} className="py-2 pr-2 text-center">
                            {effectiveMode === 'edit' ? (
                              <input
                                type="checkbox"
                                className="size-4 accent-accent"
                                aria-label={`${card.name} exists as ${v.name}`}
                                checked={printingId !== undefined}
                                disabled={!collectionReady || togglePrinting.isPending}
                                onChange={() => togglePrinting.mutate({ cardId: card.id, variantId: v.id, printingId })}
                              />
                            ) : printingId === undefined ? (
                              <span className="text-fg-subtle" aria-label={`${card.name} does not exist as ${v.name}`}>—</span>
                            ) : (
                              <OwnedCell
                                label={`${card.name} ${v.name}`}
                                quantity={collection.itemsByPrinting.get(printingId)?.quantity ?? 0}
                                required={collection.required.has(printingId)}
                                disabled={!collectionReady || collection.pendingPrinting === printingId}
                                onToggle={(next) => collection.setQuantity(printingId, next)}
                              />
                            )}
                          </td>
                        )
                      })}
                      <td className="py-2 text-right">
                        {effectiveMode === 'edit' ? (
                          <span className="inline-flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditingId(card.id)}>Edit</Button>
                            <InlineConfirm label="Delete" confirmLabel="Delete card" pending={remove.isPending && remove.variables === card.id} onConfirm={() => remove.mutate(card.id)} />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-2">
                            {collectionReady ? <StatusPill status={status} /> : null}
                            <Button variant="ghost" size="sm" aria-expanded={detailsId === card.id} onClick={() => setDetailsId((d) => (d === card.id ? null : card.id))}>
                              Details
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                    {detailsId === card.id && effectiveMode === 'collect' ? (
                      <ItemDetailsRow card={card} variants={variants} colSpan={colSpan} printingByCell={printingByCell} collection={collection} onClose={() => setDetailsId(null)} />
                    ) : null}
                  </CardRowGroup>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {total > CARDS_PAGE_SIZE ? (
        <nav aria-label="Card pages" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-fg-muted">
          <span>
            Showing {page * CARDS_PAGE_SIZE + 1}–{Math.min(total, (page + 1) * CARDS_PAGE_SIZE)} of {total}
          </span>
          <span className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
            <span className="font-mono text-xs">{page + 1} / {pageCount}</span>
            <Button variant="secondary" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </span>
        </nav>
      ) : null}
    </section>
  )
}

const setKeysAll = ['user-sets'] as const

/** Fragment wrapper so a card can render one or two <tr>s without breaking table semantics. */
function CardRowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function OwnedCell({ label, quantity, required, disabled, onToggle }: { label: string; quantity: number; required: boolean; disabled: boolean; onToggle: (next: number) => void }) {
  const owned = quantity > 0
  return (
    <button
      type="button"
      aria-pressed={owned}
      aria-label={`${label}: ${owned ? `owned${quantity > 1 ? ` ×${quantity}` : ''}` : 'not owned'}${required ? '' : ', not required'}`}
      disabled={disabled}
      onClick={() => onToggle(owned ? 0 : 1)}
      className={cn(
        'inline-grid size-7 place-items-center rounded-full border font-mono text-[11px] transition-colors disabled:opacity-50',
        owned ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong bg-surface-2 text-transparent hover:border-accent',
        !required && 'border-dashed opacity-60',
      )}
    >
      {quantity > 1 ? quantity : owned ? '✓' : '·'}
    </button>
  )
}

const STATUS_STYLES: Record<CardStatus, string> = {
  complete: 'bg-success-soft text-success',
  partial: 'bg-warning-soft text-warning',
  missing: 'bg-surface-3 text-fg-muted',
  excluded: 'bg-surface-2 text-fg-subtle',
}

function StatusPill({ status }: { status: CardStatus }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS_STYLES[status])}>{cardStatusLabel(status)}</span>
}

function ItemDetailsRow({ card, variants, colSpan, printingByCell, collection, onClose }: { card: CatalogCard; variants: VariantDefinition[]; colSpan: number; printingByCell: Map<string, string>; collection: SetCollection; onClose: () => void }) {
  const printings = variants.map((v) => ({ variant: v, printingId: printingByCell.get(`${card.id}:${v.id}`) })).filter((p): p is { variant: VariantDefinition; printingId: string } => p.printingId !== undefined)
  return (
    <tr className="border-t border-line bg-surface-2">
      <td colSpan={colSpan} className="px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-fg">{card.name} · copies, condition and notes per printing</p>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        {printings.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">This card has no printings yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {printings.map(({ variant, printingId }) => (
              <ItemForm key={printingId} label={variant.name} item={collection.itemsByPrinting.get(printingId)} required={collection.required.has(printingId)} onSave={(patch) => collection.patchItem(printingId, patch)} onRequired={(r) => collection.setRequired('printing', printingId, r)} />
            ))}
          </ul>
        )}
      </td>
    </tr>
  )
}

function ItemForm({ label, item, required, onSave, onRequired }: { label: string; item: SetCollection['itemsByPrinting'] extends Map<string, infer V> ? V | undefined : never; required: boolean; onSave: (patch: { quantity: number; condition: string; notes: string }) => Promise<void>; onRequired: (required: boolean) => void }) {
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 0))
  const [condition, setCondition] = useState(item?.condition ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = quantity !== String(item?.quantity ?? 0) || condition !== (item?.condition ?? '') || notes !== (item?.notes ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const q = Number.parseInt(quantity, 10)
    if (!Number.isInteger(q) || q < 0 || q > 9999) {
      setError('Copies must be a whole number from 0 to 9999.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave({ quantity: q, condition: condition.trim().slice(0, 40), notes: notes.trim().slice(0, 2000) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li>
      <form onSubmit={(e) => void submit(e)} noValidate aria-label={`${label} details`} className="grid items-end gap-2 sm:grid-cols-[8rem_5rem_9rem_1fr_auto]">
        <span className="text-sm text-fg">{label}</span>
        <label className="text-xs text-fg-muted">
          Copies
          <Input type="number" min={0} max={9999} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 h-9" />
        </label>
        <label className="text-xs text-fg-muted">
          Condition
          <Input list="condition-options" maxLength={40} value={condition} placeholder="NM, LP…" onChange={(e) => setCondition(e.target.value)} className="mt-1 h-9" />
        </label>
        <label className="text-xs text-fg-muted">
          Notes
          <Input maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 h-9" />
        </label>
        <span className="flex items-center gap-2 pb-0.5">
          <Button type="submit" size="sm" loading={saving} disabled={!dirty}>Save</Button>
          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-muted">
            <input type="checkbox" className="size-4 accent-accent" checked={required} onChange={(e) => onRequired(e.target.checked)} />
            Required
          </label>
        </span>
        {error ? <p role="alert" className="text-xs text-danger sm:col-span-5">{error}</p> : null}
      </form>
      <datalist id="condition-options">
        {['Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'].map((c) => <option key={c} value={c} />)}
      </datalist>
    </li>
  )
}

function AddCardForm({ pending, onSubmit }: { pending: boolean; onSubmit: (input: CardInput) => void }) {
  const [fields, setFields] = useState<CardInput>(EMPTY_CARD_INPUT)
  const [errors, setErrors] = useState<FieldErrors<CardInput>>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = cardSchema.safeParse(fields)
    if (!parsed.success) {
      setErrors(fieldErrors<CardInput>(parsed.error))
      return
    }
    setErrors({})
    onSubmit(parsed.data)
    // Keep the rarity for fast manual entry: clear number/name only.
    setFields({ number: '', name: '', rarity: parsed.data.rarity })
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Add card" className="grid gap-2 border-b border-line px-5 py-4 sm:grid-cols-[6rem_1fr_8rem_auto]">
      <div>
        <Input aria-label="Number" placeholder="#" maxLength={30} value={fields.number} invalid={Boolean(errors.number)} onChange={(e) => setFields((f) => ({ ...f, number: e.target.value }))} />
        {errors.number ? <p role="alert" className="mt-1 text-xs text-danger">{errors.number}</p> : null}
      </div>
      <div>
        <Input aria-label="Card name" placeholder="Card name" maxLength={200} value={fields.name} invalid={Boolean(errors.name)} onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))} />
        {errors.name ? <p role="alert" className="mt-1 text-xs text-danger">{errors.name}</p> : null}
      </div>
      <div>
        <Input aria-label="Rarity" placeholder="Rarity" maxLength={60} value={fields.rarity} invalid={Boolean(errors.rarity)} onChange={(e) => setFields((f) => ({ ...f, rarity: e.target.value }))} />
        {errors.rarity ? <p role="alert" className="mt-1 text-xs text-danger">{errors.rarity}</p> : null}
      </div>
      <Button type="submit" loading={pending}>Add card</Button>
    </form>
  )
}

function EditCardRow({ card, colSpan, pending, onCancel, onSave }: { card: CatalogCard; colSpan: number; pending: boolean; onCancel: () => void; onSave: (input: CardInput) => void }) {
  const [fields, setFields] = useState<CardInput>({ name: card.name, number: card.number ?? '', rarity: card.rarity ?? '' })
  const [errors, setErrors] = useState<FieldErrors<CardInput>>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = cardSchema.safeParse(fields)
    if (!parsed.success) {
      setErrors(fieldErrors<CardInput>(parsed.error))
      return
    }
    setErrors({})
    onSave(parsed.data)
  }

  return (
    <tr className="border-t border-line bg-surface-2">
      <td colSpan={colSpan} className="py-2">
        <form onSubmit={submit} noValidate aria-label={`Edit ${card.name}`} className="grid gap-2 sm:grid-cols-[6rem_1fr_8rem_auto]">
          <Input aria-label="Number" maxLength={30} value={fields.number} invalid={Boolean(errors.number)} onChange={(e) => setFields((f) => ({ ...f, number: e.target.value }))} />
          <Input aria-label="Card name" maxLength={200} value={fields.name} invalid={Boolean(errors.name)} onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))} />
          <Input aria-label="Rarity" maxLength={60} value={fields.rarity} invalid={Boolean(errors.rarity)} onChange={(e) => setFields((f) => ({ ...f, rarity: e.target.value }))} />
          <span className="flex gap-1">
            <Button type="submit" size="md" loading={pending}>Save</Button>
            <Button type="button" variant="ghost" size="md" disabled={pending} onClick={onCancel}>Cancel</Button>
          </span>
          {errors.name ? <p role="alert" className="text-xs text-danger sm:col-span-4">{errors.name}</p> : null}
        </form>
      </td>
    </tr>
  )
}
