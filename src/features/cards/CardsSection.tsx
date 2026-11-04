import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { fieldErrors, type FieldErrors } from '@/features/auth/validation'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import {
  addPrinting,
  CARDS_PAGE_SIZE,
  cardKeys,
  createCard,
  deleteCard,
  listCards,
  listPrintings,
  removePrinting,
  updateCard,
  type CatalogCard,
  type VariantDefinition,
} from './api'
import { cardSchema, EMPTY_CARD_INPUT, type CardInput } from './schema'

type Props = { setId: string; editable: boolean; variants: VariantDefinition[] }

/** Paginated, searchable checklist editor: cards × variants (printing exists / does not). */
export function CardsSection({ setId, editable, variants }: Props) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim(), 300)
  const [editingId, setEditingId] = useState<string | null>(null)

  const cards = useQuery({
    queryKey: cardKeys.list(setId, page, term),
    queryFn: () => listCards(setId, page, term),
    enabled: setId !== '',
    placeholderData: keepPreviousData,
  })
  const cardIds = (cards.data?.rows ?? []).map((c) => c.id)
  const printings = useQuery({
    queryKey: cardKeys.printings(setId, cardIds),
    queryFn: () => listPrintings(cardIds),
    enabled: cardIds.length > 0,
  })
  const printingByCell = new Map((printings.data ?? []).map((p) => [`${p.catalog_card_id}:${p.variant_definition_id}`, p.id]))

  const invalidateCards = () => queryClient.invalidateQueries({ queryKey: cardKeys.all(setId) })
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: setKeysAll })
  const invalidatePrintings = () => queryClient.invalidateQueries({ queryKey: ['printings', setId] })

  const create = useMutation({
    mutationFn: (input: CardInput) => createCard(setId, input),
    onSuccess: async () => {
      await Promise.all([invalidateCards(), invalidateList()])
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
      await Promise.all([invalidateCards(), invalidateList()])
    },
  })
  const togglePrinting = useMutation({
    mutationFn: ({ cardId, variantId, printingId }: { cardId: string; variantId: string; printingId: string | undefined }) =>
      printingId ? removePrinting(printingId) : addPrinting(cardId, variantId),
    onSuccess: invalidatePrintings,
  })

  const total = cards.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / CARDS_PAGE_SIZE))
  const rows = cards.data?.rows ?? []
  const firstError = [create, update, remove, togglePrinting].find((m) => m.isError)?.error

  return (
    <section aria-labelledby="cards-heading" className="rounded-lg border border-line bg-surface-1">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="cards-heading" className="text-base font-semibold text-fg">Cards</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            {total} {total === 1 ? 'card' : 'cards'}. A ticked cell means the card exists in that variant.
          </p>
        </div>
        <Input
          type="search"
          aria-label="Search cards by name or number"
          placeholder="Search name or number…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          className="max-w-xs"
        />
      </div>

      {editable ? <AddCardForm pending={create.isPending} onSubmit={(input) => create.mutate(input)} /> : null}
      {firstError ? <Alert tone="danger" className="mx-5 mt-4">{firstError.message}</Alert> : null}

      <div className="overflow-x-auto px-5 py-4 scrollbar-thin">
        {cards.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : cards.isError ? (
          <Alert tone="danger">{cards.error.message}</Alert>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">{term ? 'No cards match your search.' : 'No cards yet. Add the first one above.'}</p>
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
                {editable ? <th scope="col" className="w-40 py-2 text-right font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((card) =>
                editingId === card.id ? (
                  <EditCardRow
                    key={card.id}
                    card={card}
                    colSpan={3 + variants.length + 1}
                    pending={update.isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(input) => update.mutate({ id: card.id, input })}
                  />
                ) : (
                  <tr key={card.id} className="border-t border-line">
                    <td className="py-2 pr-3 font-mono text-xs text-fg-muted">{card.number ?? '—'}</td>
                    <td className="py-2 pr-3 text-fg">{card.name}</td>
                    <td className="py-2 pr-3 text-fg-muted">{card.rarity ?? ''}</td>
                    {variants.map((v) => {
                      const printingId = printingByCell.get(`${card.id}:${v.id}`)
                      return (
                        <td key={v.id} className="py-2 pr-2 text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-accent"
                            aria-label={`${card.name} exists as ${v.name}`}
                            checked={printingId !== undefined}
                            disabled={!editable || printings.isPending || togglePrinting.isPending}
                            onChange={() => togglePrinting.mutate({ cardId: card.id, variantId: v.id, printingId })}
                          />
                        </td>
                      )
                    })}
                    {editable ? (
                      <td className="py-2 text-right">
                        <span className="inline-flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(card.id)}>Edit</Button>
                          <InlineConfirm label="Delete" confirmLabel="Delete card" pending={remove.isPending && remove.variables === card.id} onConfirm={() => remove.mutate(card.id)} />
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ),
              )}
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
    // Keep the number field's momentum for fast manual entry: clear name/rarity only.
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
