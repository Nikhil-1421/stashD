import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { cardKeys, listAllCards, listVariants } from '@/features/cards/api'
import { CollectionProgress } from '@/features/collection/CollectionProgress'
import { ruleFor, type RequirementRule } from '@/features/collection/domain/requirements'
import { coarserExcludes, useSetCollection } from '@/features/collection/useSetCollection'
import { getUserSet, setDisplayName, setKeys } from '@/features/sets/api'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import type { RequirementScope } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'
import { BubbleGrid } from './BubbleGrid'
import { PILL_BASE, PILL_STATE } from './bubble-styles'
import { buildBubbles, distinctRarities, EMPTY_FILTER, filterBubbles, isBubbleUnit, matchesStatus, rangeKeys, toggleWrites, type Bubble, type BubbleFilter, type BubbleState, type BubbleStatusFilter, type BubbleUnit } from './domain/bubbles'
import { COPY_FORMATS, formatBubbles, isCopyFormat, type CopyFormat } from './domain/clipboard'
import { UndoToast } from '@/components/ui/UndoToast'
import { useUndoStack } from '@/hooks/useUndoStack'

const STATUS_FILTERS: readonly { value: BubbleStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'missing', label: 'Missing' },
  { value: 'owned', label: 'Owned' },
  { value: 'excluded', label: 'Not required' },
]
const MAX_RARITY_CHIPS = 10
const EMPTY_SELECTION: ReadonlySet<string> = new Set()

type CopyResult = { kind: 'copied'; count: number; listName: string } | { kind: 'fallback'; text: string; listName: string }

/** Bubble Check: a dense pill per printing (or per card) that toggles ownership on tap. */
export function BubbleCheckPage() {
  const { userSetId = '' } = useParams()
  const set = useQuery({ queryKey: setKeys.detail(userSetId), queryFn: () => getUserSet(userSetId) })
  const catalogSetId = set.data?.catalog_set_id ?? ''
  const variants = useQuery({ queryKey: cardKeys.variants(catalogSetId), queryFn: () => listVariants(catalogSetId), enabled: catalogSetId !== '' })
  const cards = useQuery({ queryKey: cardKeys.allCards(catalogSetId), queryFn: () => listAllCards(catalogSetId), enabled: catalogSetId !== '' })
  const collection = useSetCollection(userSetId, catalogSetId, variants.data)
  const setName = set.data ? setDisplayName(set.data) : 'Set'
  useDocumentTitle(set.data ? `Bubble Check · ${setName}` : 'Bubble Check')

  const [storedUnit, setStoredUnit] = useLocalStorageState<BubbleUnit>('bubble.unit', 'printing', isBubbleUnit)
  const [filter, setFilter] = useState<BubbleFilter>(EMPTY_FILTER)
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search, 200)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(EMPTY_SELECTION)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [copyFormat, setCopyFormat] = useLocalStorageState<CopyFormat>('bubble.copyFormat', 'number-name', isCopyFormat)
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const undo = useUndoStack()

  const multiVariant = (variants.data?.length ?? 0) > 1
  const unit: BubbleUnit = multiVariant ? storedUnit : 'printing'
  const bubbles = useMemo(
    () => buildBubbles({ unit, cards: cards.data ?? [], variants: variants.data ?? [], printings: collection.printings, required: collection.required, owned: collection.owned, byCard: collection.completion.byCard }),
    [unit, cards.data, variants.data, collection.printings, collection.required, collection.owned, collection.completion.byCard],
  )
  const activeFilter = useMemo<BubbleFilter>(() => ({ ...filter, search: term }), [filter, term])
  const visible = useMemo(() => filterBubbles(bubbles, activeFilter), [bubbles, activeFilter])
  const rarities = useMemo(() => distinctRarities(cards.data ?? []), [cards.data])
  const statusCounts = useMemo(() => {
    const scoped = filterBubbles(bubbles, { ...activeFilter, status: 'all' })
    return Object.fromEntries(STATUS_FILTERS.map((f) => [f.value, scoped.filter((b) => matchesStatus(b, f.value)).length])) as Record<BubbleStatusFilter, number>
  }, [bubbles, activeFilter])
  const selectedBubbles = useMemo(() => bubbles.filter((b) => selected.has(b.key)), [bubbles, selected])

  const ready = collection.status === 'ready' && cards.isSuccess && variants.isSuccess
  const busy = collection.bulkPending || undo.busy

  const undoAction = undo.undo
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void undoAction()
      } else if (e.key === 'Escape') {
        setSelected(EMPTY_SELECTION)
        setAnchor(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoAction])

  async function applyWrites(writes: readonly { printingId: string; quantity: number }[], label: string) {
    if (writes.length === 0) return
    const previous = writes.map((w) => ({ printingId: w.printingId, quantity: collection.owned.get(w.printingId) ?? 0 }))
    setActionError(null)
    undo.push({ label, revert: () => collection.setQuantities(previous) })
    try {
      await collection.setQuantities(writes)
    } catch (err) {
      undo.discard()
      setActionError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  async function applyRules(targets: readonly string[], required: boolean, label: string) {
    if (targets.length === 0) return
    const scope: RequirementScope = unit === 'printing' ? 'printing' : 'card'
    const targetSet = new Set(targets)
    const previous = collection.rules.filter((r) => r.scope === scope && targetSet.has(r.target))
    const next: RequirementRule[] = required
      ? targets.filter((t) => coarserExcludes(collection.rules, scope, t, collection.printings)).map((t) => ruleFor(scope, t, true))
      : targets.map((t) => ruleFor(scope, t, false))
    setActionError(null)
    try {
      await collection.replaceRules(scope, targets, next)
      undo.push({ label, revert: () => collection.replaceRules(scope, targets, previous) })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  function toggle(b: Bubble) {
    const writes = toggleWrites(b, collection.owned, collection.required)
    const turningOn = writes.some((w) => w.quantity > 0)
    void applyWrites(writes, `${describe(b)} marked ${turningOn ? 'owned' : 'not owned'}`)
  }

  function select(b: Bubble, range: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (range) for (const k of rangeKeys(visible, anchor, b.key)) next.add(k)
      else if (next.has(b.key)) next.delete(b.key)
      else next.add(b.key)
      return next
    })
    if (!range) setAnchor(b.key)
    if (!selecting) setSelecting(true)
  }

  function clearSelection() {
    setSelected(EMPTY_SELECTION)
    setAnchor(null)
  }

  function bulkOwned(owned: boolean) {
    const writes = selectedBubbles.flatMap((b) => {
      if (!owned) return b.printingIds.filter((id) => (collection.owned.get(id) ?? 0) > 0).map((id) => ({ printingId: id, quantity: 0 }))
      const targets = b.unit === 'printing' ? b.printingIds : b.printingIds.filter((id) => collection.required.has(id))
      return (targets.length > 0 ? targets : b.printingIds).filter((id) => (collection.owned.get(id) ?? 0) === 0).map((id) => ({ printingId: id, quantity: 1 }))
    })
    void applyWrites(writes, `${writes.length} ${writes.length === 1 ? 'printing' : 'printings'} marked ${owned ? 'owned' : 'not owned'}`)
  }

  function bulkRequired(required: boolean) {
    const targets = selectedBubbles.flatMap((b) => {
      const target = b.unit === 'printing' ? b.printingIds[0] : b.cardId
      return target === undefined ? [] : [target]
    })
    void applyRules(targets, required, `${targets.length} ${unit === 'printing' ? 'printings' : 'cards'} ${required ? 'now count' : 'no longer count'} toward completion`)
  }

  async function copy(status: 'missing' | 'owned') {
    const listName = status === 'missing' ? 'Missing' : 'Owned'
    const list = filterBubbles(bubbles, { ...activeFilter, status })
    const text = formatBubbles(list, copyFormat, { setName, listName })
    try {
      await navigator.clipboard.writeText(text)
      setCopyResult({ kind: 'copied', count: list.length, listName })
    } catch {
      setCopyResult({ kind: 'fallback', text, listName })
    }
  }

  if (set.isPending) return <Skeleton className="h-40 w-full" />
  if (set.isError) return <Alert tone="danger" title="Could not load the set">{set.error.message}</Alert>
  if (!set.data) return <Alert tone="warning" title="Set not found">It may have been deleted, or the link is wrong.</Alert>

  const loadError = variants.error ?? cards.error ?? collection.error
  const legendStates: BubbleState[] = unit === 'printing' ? ['missing', 'owned', 'excluded'] : ['missing', 'partial', 'complete', 'excluded']

  return (
    <>
      <PageHeader
        title={setName}
        description="Bubble Check · tap a pill to mark it owned. Shift-click or use Select to act on many at once."
        actions={<ButtonLink to={`/sets/${userSetId}`} variant="secondary" size="sm">Open set</ButtonLink>}
      />

      <div className="space-y-4">
        <CollectionProgress completion={collection.completion} pending={!ready && !loadError} />
        {loadError ? <Alert tone="danger" title="Could not load this set">{loadError.message}</Alert> : null}
        {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
        {collection.mutationError && !actionError ? <Alert tone="danger">{collection.mutationError.message}</Alert> : null}

        <section aria-label="Filters" className="space-y-3 rounded-lg border border-line bg-surface-1 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Status" className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((f) => (
                <Chip key={f.value} active={filter.status === f.value} onClick={() => setFilter((cur) => ({ ...cur, status: f.value }))}>
                  {f.label}
                  <span className="font-mono text-[11px] text-fg-subtle">{statusCounts[f.value]}</span>
                </Chip>
              ))}
            </div>
            <Input type="search" aria-label="Search by name or number" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48 text-sm" />
          </div>

          {multiVariant ? (
            <div role="group" aria-label="Variant" className="flex flex-wrap gap-1">
              <Chip active={filter.variantId === null} onClick={() => setFilter((cur) => ({ ...cur, variantId: null }))}>All variants</Chip>
              {(variants.data ?? []).map((v) => (
                <Chip key={v.id} active={filter.variantId === v.id} onClick={() => setFilter((cur) => ({ ...cur, variantId: v.id }))}>{v.name}</Chip>
              ))}
            </div>
          ) : null}

          {rarities.length > 1 ? (
            rarities.length <= MAX_RARITY_CHIPS ? (
              <div role="group" aria-label="Rarity" className="flex flex-wrap gap-1">
                <Chip active={filter.rarity === null} onClick={() => setFilter((cur) => ({ ...cur, rarity: null }))}>All rarities</Chip>
                {rarities.map((r) => (
                  <Chip key={r} active={filter.rarity === r} onClick={() => setFilter((cur) => ({ ...cur, rarity: r }))}>{r === '' ? 'No rarity' : r}</Chip>
                ))}
              </div>
            ) : (
              <label className="flex items-center gap-2 text-xs text-fg-muted">
                Rarity
                <Select value={filter.rarity ?? '*'} onChange={(e) => setFilter((cur) => ({ ...cur, rarity: e.target.value === '*' ? null : e.target.value }))} className="h-8 w-48 text-sm">
                  <option value="*">All rarities</option>
                  {rarities.map((r) => <option key={r} value={r}>{r === '' ? 'No rarity' : r}</option>)}
                </Select>
              </label>
            )
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            {multiVariant ? (
              <div role="group" aria-label="One pill per" className="inline-flex rounded-md border border-line p-0.5">
                {(['printing', 'card'] as const).map((u) => (
                  <button key={u} type="button" aria-pressed={unit === u} onClick={() => { setStoredUnit(u); clearSelection() }} className={cn('rounded px-3 py-1 text-xs transition-colors', unit === u ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg')}>
                    {u === 'printing' ? 'Printings' : 'Cards'}
                  </button>
                ))}
              </div>
            ) : null}
            <Chip active={selecting} onClick={() => { if (selecting) clearSelection(); setSelecting((s) => !s) }}>Select</Chip>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <Select aria-label="Copy format" value={copyFormat} onChange={(e) => { if (isCopyFormat(e.target.value)) setCopyFormat(e.target.value) }} className="h-8 w-auto text-xs">
                {COPY_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
              <Button variant="secondary" size="sm" disabled={!ready} onClick={() => void copy('missing')}>Copy missing</Button>
              <Button variant="secondary" size="sm" disabled={!ready} onClick={() => void copy('owned')}>Copy owned</Button>
            </span>
          </div>
        </section>

        {copyResult ? (
          copyResult.kind === 'copied' ? (
            <Alert tone="success" className="text-sm">
              Copied {copyResult.count} {copyResult.listName.toLowerCase()} {copyResult.count === 1 ? 'entry' : 'entries'} to the clipboard.{' '}
              <button type="button" className="underline underline-offset-4" onClick={() => setCopyResult(null)}>Dismiss</button>
            </Alert>
          ) : (
            <div className="rounded-lg border border-line bg-surface-1 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-fg">Clipboard access was blocked; copy the {copyResult.listName.toLowerCase()} list from here.</p>
                <Button variant="ghost" size="sm" onClick={() => setCopyResult(null)}>Close</Button>
              </div>
              <Textarea readOnly aria-label={`${copyResult.listName} list`} value={copyResult.text} rows={6} className="mt-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            </div>
          )
        ) : null}

        {selecting || selected.size > 0 ? (
          <div role="toolbar" aria-label="Selection actions" className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2 text-sm">
            <span className="font-medium text-fg">{selected.size} selected</span>
            <Button variant="ghost" size="sm" disabled={visible.length === 0} onClick={() => setSelected(new Set(visible.map((b) => b.key)))}>Select all visible</Button>
            <Button variant="ghost" size="sm" disabled={selected.size === 0} onClick={clearSelection}>Clear</Button>
            <span className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" disabled={selected.size === 0 || busy} onClick={() => bulkOwned(true)}>Mark owned</Button>
              <Button variant="secondary" size="sm" disabled={selected.size === 0 || busy} onClick={() => bulkOwned(false)}>Mark not owned</Button>
              <Button variant="secondary" size="sm" disabled={selected.size === 0 || busy} onClick={() => bulkRequired(false)}>Exclude from completion</Button>
              <Button variant="secondary" size="sm" disabled={selected.size === 0 || busy} onClick={() => bulkRequired(true)}>Include in completion</Button>
            </span>
          </div>
        ) : null}

        {!ready && !loadError ? (
          <Skeleton className="h-64 w-full" />
        ) : bubbles.length === 0 ? (
          <EmptyState title="Nothing to check yet" description="This set has no printings. Add cards and variants on the set page, or import a checklist." action={<ButtonLink to={`/sets/${userSetId}`} variant="secondary">Open set</ButtonLink>} />
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-fg-muted">No cards match these filters.</p>
        ) : (
          <BubbleGrid bubbles={visible} selected={selected} selecting={selecting} pending={collection.pendingPrintings} disabled={!ready} onToggle={toggle} onSelect={select} aria-label={`${setName} cards`} />
        )}

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-muted">
          {legendStates.map((s) => (
            <span key={s} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={cn(PILL_BASE, PILL_STATE[s], 'h-5 w-8 text-[10px]')}>01</span>
              {LEGEND[s]}
            </span>
          ))}
          <span className="ml-auto hidden md:inline">Arrow keys move · Space toggles · Shift+Space selects a range · ⌘Z undo</span>
        </footer>
      </div>

      {undo.visible && undo.latest ? (
        <UndoToast label={undo.latest.label} busy={undo.busy} error={undo.error} onUndo={() => void undo.undo()} onDismiss={undo.dismiss} onPause={undo.pause} onResume={undo.resume} />
      ) : null}
    </>
  )
}

const LEGEND: Record<BubbleState, string> = {
  missing: 'Missing',
  owned: 'Owned',
  partial: 'Partly owned',
  complete: 'Complete',
  excluded: 'Not required',
}

function describe(b: Bubble): string {
  const head = b.number ? `#${b.number} ${b.name}` : b.name
  return b.unit === 'printing' && b.variantName && b.label !== (b.number ?? b.name.slice(0, 4)) ? `${head} (${b.variantName})` : head
}
