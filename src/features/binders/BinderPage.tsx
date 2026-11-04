import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { UndoToast } from '@/components/ui/UndoToast'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'
import { binderKeys, deleteBinder, updateBinder, type BinderPage as BinderPageRow } from './api'
import { BinderCanvas } from './BinderCanvas'
import { BinderDndProvider } from './BinderDndProvider'
import { BinderOverview } from './BinderOverview'
import { BinderForm } from './BinderForm'
import { printingLabel } from './binder-utils'
import { CardSourcePanel, type ArmedPrinting } from './CardSourcePanel'
import { useDragSource, useDropTarget } from './dnd'
import { resolveDrop, type DragData, type DropData } from './domain/dnd'
import { dimensionsLabel, LAYOUT_PRESETS, MAX_DIMENSION, MIN_DIMENSION, remapPlacements, slotCount, type Dimensions } from './domain/layout'
import { pagePlacements, type Placement, type SlotRef } from './domain/placements'
import { GeneratePanel } from './GeneratePanel'
import type { BinderFormInput } from './schema'
import { useBinderEditor, type SaveStatus } from './useBinderEditor'
import { usePrintingDetails } from './usePrintingDetails'

const DIMENSIONS = Array.from({ length: MAX_DIMENSION - MIN_DIMENSION + 1 }, (_, i) => MIN_DIMENSION + i)

type ResizePreview = { pageId: string; dims: Dimensions; dropped: { slotIndex: number; placement: Placement }[] }

/** `/binders/:binderId`: page strip, page canvas, card source panel, page tools and autosave. */
export function BinderPage() {
  const { binderId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const editor = useBinderEditor(binderId)
  const { binder, pages, placements } = editor
  useDocumentTitle(binder ? binder.name : 'Binder')

  const [currentPageId, setCurrentPageId] = useState<string | null>(null)
  const currentPage: BinderPageRow | undefined = pages.find((p) => p.id === currentPageId) ?? pages[0]
  const [selected, setSelected] = useState<SlotRef | null>(null)
  const [armed, setArmed] = useState<ArmedPrinting | null>(null)
  const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [view, setView] = useState<'page' | 'overview'>('page')

  const currentPlacements = useMemo(() => (currentPage ? pagePlacements(placements, currentPage.id) : new Map<number, Placement>()), [placements, currentPage])
  const detailIds = useMemo(() => {
    const ids = new Set<string>()
    for (const p of placements.values()) ids.add(p.printingId)
    if (armed) ids.add(armed.printingId)
    return [...ids]
  }, [placements, armed])
  const details = usePrintingDetails(detailIds)
  const placedCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of placements.values()) counts.set(p.printingId, (counts.get(p.printingId) ?? 0) + 1)
    return counts
  }, [placements])
  const selectedPlacement = selected ? placements.get(`${selected.pageId}:${selected.slotIndex}`) : undefined
  const selectedDetail = selectedPlacement ? details.byId.get(selectedPlacement.printingId) : undefined
  const moving = selected !== null && selectedPlacement !== undefined

  const undoAction = editor.undo.undo
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void undoAction()
      } else if (e.key === 'Escape') {
        setArmed(null)
        setSelected(null)
        setResizePreview(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoAction])

  const update = useMutation({
    mutationFn: (input: BinderFormInput) => updateBinder(binderId, { name: input.name, description: input.description, gameId: input.gameId, rows: input.rows, columns: input.columns }),
    onSuccess: async () => {
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: binderKeys.all })
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteBinder(binderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: binderKeys.all })
      void navigate('/binders', { replace: true })
    },
  })

  function activateSlot(slotIndex: number) {
    if (!currentPage) return
    const slot: SlotRef = { pageId: currentPage.id, slotIndex }
    if (armed) {
      editor.apply({ type: 'place', slot, placement: { printingId: armed.printingId, notes: null } }, `Placed ${printingLabel(armed.detail)} in slot ${slotIndex + 1}`)
      return
    }
    if (selected && selectedPlacement) {
      if (selected.pageId === slot.pageId && selected.slotIndex === slot.slotIndex) {
        setSelected(null)
        return
      }
      const target = placements.get(`${slot.pageId}:${slotIndex}`)
      editor.apply({ type: 'move', from: selected, to: slot }, `${target ? 'Swapped' : 'Moved'} ${printingLabel(selectedDetail)} to slot ${slotIndex + 1}`)
      setSelected(null)
      return
    }
    if (currentPlacements.has(slotIndex)) setSelected(slot)
    else setNotice('Pick a card from the panel first, or select a filled slot to move it.')
  }

  function removeSlot(slotIndex: number) {
    if (!currentPage) return
    const placement = currentPlacements.get(slotIndex)
    if (!placement) return
    editor.apply({ type: 'remove', slot: { pageId: currentPage.id, slotIndex } }, `Removed ${printingLabel(details.byId.get(placement.printingId))} from slot ${slotIndex + 1}`)
    if (selected?.slotIndex === slotIndex && selected.pageId === currentPage.id) setSelected(null)
  }

  function handleDrop(source: DragData, target: DropData) {
    const outcome = resolveDrop(source, target, { placements, pages, describe: (id) => printingLabel(details.byId.get(id)) })
    if (!outcome) return
    if (outcome.type === 'reject') {
      setNotice(outcome.reason)
      return
    }
    setSelected(null)
    if (outcome.type === 'op') {
      editor.apply(outcome.op, outcome.label)
      return
    }
    void runPageOp(() => editor.pageOps.reorder(outcome.pageIds))
  }

  function requestResize(dims: Dimensions) {
    if (!currentPage) return
    if (dims.rows === currentPage.rows && dims.columns === currentPage.columns) return
    const remap = remapPlacements([...currentPlacements].map(([slotIndex, placement]) => ({ slotIndex, item: placement })), currentPage, dims)
    if (remap.dropped.length === 0) {
      void applyResize(currentPage.id, dims)
      return
    }
    setResizePreview({ pageId: currentPage.id, dims, dropped: remap.dropped.map((d) => ({ slotIndex: d.from, placement: d.item })) })
  }

  async function applyResize(pageId: string, dims: Dimensions) {
    setResizePreview(null)
    setSelected(null)
    try {
      const dropped = await editor.pageOps.resize(pageId, dims)
      await queryClient.invalidateQueries({ queryKey: binderKeys.placements(binderId) })
      setNotice(dropped > 0 ? `Page resized to ${dimensionsLabel(dims)}; ${dropped} ${dropped === 1 ? 'placement' : 'placements'} removed.` : null)
    } catch {
      /* surfaced through pageOps.error */
    }
  }

  async function runPageOp(task: () => Promise<unknown>, after?: (result: unknown) => void) {
    setSelected(null)
    try {
      const result = await task()
      after?.(result)
    } catch {
      /* surfaced through pageOps.error */
    }
  }

  if (editor.status === 'pending' && !binder) return <Skeleton className="h-64 w-full" />
  if (editor.status === 'error' && editor.error && !binder) return <Alert tone="danger" title="Could not load the binder">{editor.error.message}</Alert>
  if (binder === null) return <Alert tone="warning" title="Binder not found">It may have been deleted, or the link is wrong.</Alert>
  if (!binder) return <Skeleton className="h-64 w-full" />

  const pageIndex = currentPage ? pages.findIndex((p) => p.id === currentPage.id) : -1
  const defaults: Dimensions = { rows: binder.default_rows, columns: binder.default_columns }

  return (
    <BinderDndProvider onDrop={handleDrop}>
      <PageHeader
        title={binder.name}
        description={[binder.game_name, `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`, binder.description].filter(Boolean).join(' · ')}
        actions={
          <>
            <SaveIndicator status={editor.save.status} pendingCount={editor.save.pendingCount} error={editor.save.error} onRetry={editor.save.retry} />
            <Button variant="secondary" size="sm" onClick={() => setEditing((e) => !e)}>Edit details</Button>
            <InlineConfirm label="Delete binder" confirmLabel="Delete binder and all its pages" pending={remove.isPending} onConfirm={() => remove.mutate()} />
          </>
        }
      />
      {editing ? (
        <div className="mb-6 max-w-2xl">
          <BinderForm initial={{ name: binder.name, description: binder.description ?? '', gameId: binder.game_id ?? '', rows: binder.default_rows, columns: binder.default_columns }} pending={update.isPending} error={update.error?.message ?? null} submitLabel="Save changes" onSubmit={(input) => update.mutate(input)} onCancel={() => setEditing(false)} />
        </div>
      ) : null}
      {remove.isError ? <Alert tone="danger" className="mb-4">{remove.error.message}</Alert> : null}
      {editor.pageOps.error ? <Alert tone="danger" className="mb-4" title="Page change failed">{editor.pageOps.error.message}</Alert> : null}
      {editor.error ? <Alert tone="danger" className="mb-4">{editor.error.message}</Alert> : null}
      {notice ? (
        <Alert tone="info" className="mb-4">
          {notice} <button type="button" className="underline underline-offset-4" onClick={() => setNotice(null)}>Dismiss</button>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <details open className="rounded-lg border border-line bg-surface-1 lg:open" >
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-fg">Cards</summary>
            <div className="border-t border-line px-4 py-3">
              <CardSourcePanel armed={armed} onArm={(next) => { setArmed(next); setSelected(null) }} placedCount={(id) => placedCounts.get(id) ?? 0} />
            </div>
          </details>
          <details className="rounded-lg border border-line bg-surface-1">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-fg">Generate pages from a set</summary>
            <div className="border-t border-line px-4 py-3">
              <GeneratePanel defaults={defaults} pending={editor.pageOps.pending} onGenerate={(ids, dims) => editor.pageOps.generate(ids, dims).then(async (n) => { await queryClient.invalidateQueries({ queryKey: binderKeys.placements(binderId) }); return n })} />
            </div>
          </details>
        </aside>

        <section className="space-y-3" aria-label="Binder pages">
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Pages" className="flex max-w-full gap-1 overflow-x-auto scrollbar-thin">
              {pages.map((p, i) => (
                <PageTab key={p.id} page={p} index={i} current={currentPage?.id === p.id && view === 'page'} disabled={editor.pageOps.pending} onSelect={() => { setCurrentPageId(p.id); setSelected(null); setView('page') }} />
              ))}
            </div>
            <Button variant="secondary" size="sm" loading={editor.pageOps.pending} onClick={() => void runPageOp(editor.pageOps.add, (page) => { setCurrentPageId((page as BinderPageRow).id); setView('page') })}>Add page</Button>
            <Button variant={view === 'overview' ? 'primary' : 'secondary'} size="sm" aria-pressed={view === 'overview'} onClick={() => { setView((v) => (v === 'overview' ? 'page' : 'overview')); setSelected(null) }}>Overview</Button>
          </div>

          {armed ? (
            <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2 text-sm text-fg">
              <span>Placing <strong>{printingLabel(armed.detail)}</strong>. Click a slot; click again for another copy.</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setArmed(null)}>Done</Button>
            </div>
          ) : selected && selectedPlacement ? (
            <div role="toolbar" aria-label="Selected slot" className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2 text-sm text-fg">
              <span>Slot {selected.slotIndex + 1}: <strong>{printingLabel(selectedDetail)}</strong>. Click another slot to move or swap.</span>
              <span className="ml-auto flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { if (selectedDetail) setArmed({ printingId: selectedPlacement.printingId, detail: selectedDetail }); setSelected(null) }} disabled={!selectedDetail}>Duplicate</Button>
                <Button variant="secondary" size="sm" onClick={() => removeSlot(selected.slotIndex)}>Remove</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Deselect</Button>
              </span>
            </div>
          ) : null}

          {view === 'overview' ? (
            <BinderOverview pages={pages} placements={placements} currentPageId={currentPage?.id ?? null} disabled={editor.pageOps.pending} onOpen={(id) => { setCurrentPageId(id); setView('page') }} />
          ) : !currentPage ? (
            <div className="rounded-lg border border-dashed border-line-strong bg-surface-1 px-6 py-12 text-center">
              <p className="text-sm text-fg">This binder has no pages.</p>
              <p className="mt-1 text-sm text-fg-muted">Add a page, or generate pages from a set.</p>
            </div>
          ) : (
            <>
              <BinderCanvas page={currentPage} placements={currentPlacements} details={details.byId} selectedSlot={selected?.pageId === currentPage.id ? selected.slotIndex : null} placing={armed !== null} moving={moving} disabled={editor.pageOps.pending} onActivate={activateSlot} onRemove={removeSlot} />

              {resizePreview ? (
                <Alert tone="warning" title={`Resizing to ${dimensionsLabel(resizePreview.dims)} removes ${resizePreview.dropped.length} ${resizePreview.dropped.length === 1 ? 'placement' : 'placements'}`}>
                  <ul className="mt-1 list-inside list-disc">
                    {resizePreview.dropped.map((d) => <li key={d.slotIndex}>Slot {d.slotIndex + 1}: {printingLabel(details.byId.get(d.placement.printingId))}</li>)}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <Button variant="danger" size="sm" loading={editor.pageOps.pending} onClick={() => void applyResize(resizePreview.pageId, resizePreview.dims)}>Resize and remove them</Button>
                    <Button variant="ghost" size="sm" onClick={() => setResizePreview(null)}>Keep current layout</Button>
                  </div>
                </Alert>
              ) : null}

              <PageTools
                page={currentPage}
                index={pageIndex}
                total={pages.length}
                pending={editor.pageOps.pending}
                filled={currentPlacements.size}
                onLabel={(label) => void runPageOp(() => editor.pageOps.setLabel(currentPage.id, label))}
                onResize={requestResize}
                onMove={(dir) => void runPageOp(() => editor.pageOps.move(currentPage.id, dir))}
                onDuplicate={() => void runPageOp(() => editor.pageOps.duplicate(currentPage.id), (id) => { setCurrentPageId(id as string); void queryClient.invalidateQueries({ queryKey: binderKeys.placements(binderId) }) })}
                onClear={() => editor.apply({ type: 'clear-page', pageId: currentPage.id, slotCount: slotCount(currentPage) }, `Cleared page ${pageIndex + 1}`)}
                onDelete={() => void runPageOp(() => editor.pageOps.remove(currentPage.id), () => setCurrentPageId(null))}
              />
            </>
          )}
          <p className="text-xs text-fg-subtle">Drag cards onto slots or page tabs (long-press on touch) · Arrow keys move between slots · Enter places, selects or moves · Delete clears a slot · Esc cancels · ⌘Z undoes.</p>
        </section>
      </div>

      {editor.undo.visible && editor.undo.latest ? (
        <UndoToast label={editor.undo.latest.label} busy={editor.undo.busy} error={editor.undo.error} onUndo={() => void editor.undo.undo()} onDismiss={editor.undo.dismiss} onPause={editor.undo.pause} onResume={editor.undo.resume} />
      ) : null}
    </BinderDndProvider>
  )
}

function SaveIndicator({ status, pendingCount, error, onRetry }: { status: SaveStatus; pendingCount: number; error: string | null; onRetry: () => void }) {
  if (status === 'idle') return null
  const text = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'dirty' ? `Unsaved (${pendingCount})` : 'Save failed'
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-xs', status === 'failed' ? 'text-danger' : status === 'saved' ? 'text-success' : 'text-fg-muted')} title={error ?? undefined}>
      {text}
      {status === 'failed' ? <Button variant="danger" size="sm" onClick={onRetry}>Retry</Button> : null}
    </span>
  )
}

type PageToolsProps = {
  page: BinderPageRow
  index: number
  total: number
  pending: boolean
  filled: number
  onLabel: (label: string) => void
  onResize: (dims: Dimensions) => void
  onMove: (direction: -1 | 1) => void
  onDuplicate: () => void
  onClear: () => void
  onDelete: () => void
}

function PageTools({ page, index, total, pending, filled, onLabel, onResize, onMove, onDuplicate, onClear, onDelete }: PageToolsProps) {
  const [label, setLabel] = useState(page.label ?? '')
  const [pageKey, setPageKey] = useState(page.id)
  if (pageKey !== page.id) {
    setPageKey(page.id)
    setLabel(page.label ?? '')
  }
  const presetValue = LAYOUT_PRESETS.find((p) => p.rows === page.rows && p.columns === page.columns)?.label ?? 'custom'

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface-1 px-4 py-3 text-sm">
      <label className="text-xs font-medium text-fg-muted">
        Page {index + 1} label
        <Input value={label} maxLength={80} placeholder="e.g. Holos" onChange={(e) => setLabel(e.target.value)} onBlur={() => { if (label !== (page.label ?? '')) onLabel(label.trim()) }} className="mt-1 h-9 w-40 text-sm" />
      </label>
      <label className="text-xs font-medium text-fg-muted">
        Layout
        <Select value={presetValue} onChange={(e) => { const p = LAYOUT_PRESETS.find((x) => x.label === e.target.value); if (p) onResize({ rows: p.rows, columns: p.columns }) }} disabled={pending} className="mt-1 h-9 w-28 text-sm">
          {LAYOUT_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
          <option value="custom">Custom</option>
        </Select>
      </label>
      <label className="text-xs font-medium text-fg-muted">
        Rows
        <Select aria-label="Rows" value={page.rows} onChange={(e) => onResize({ rows: Number(e.target.value), columns: page.columns })} disabled={pending} className="mt-1 h-9 w-16 text-sm">
          {DIMENSIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
      </label>
      <label className="text-xs font-medium text-fg-muted">
        Columns
        <Select aria-label="Columns" value={page.columns} onChange={(e) => onResize({ rows: page.rows, columns: Number(e.target.value) })} disabled={pending} className="mt-1 h-9 w-16 text-sm">
          {DIMENSIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
      </label>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={pending || index <= 0} onClick={() => onMove(-1)} aria-label="Move page earlier">← Move</Button>
        <Button variant="secondary" size="sm" disabled={pending || index >= total - 1} onClick={() => onMove(1)} aria-label="Move page later">Move →</Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={onDuplicate}>Duplicate page</Button>
        <InlineConfirm label="Clear page" confirmLabel={`Remove ${filled} ${filled === 1 ? 'card' : 'cards'}`} variant="secondary" onConfirm={onClear} />
        <InlineConfirm label="Delete page" confirmLabel="Delete page and its placements" pending={pending} onConfirm={onDelete} />
      </span>
    </div>
  )
}

function PageTab({ page, index, current, disabled, onSelect }: { page: BinderPageRow; index: number; current: boolean; disabled: boolean; onSelect: () => void }) {
  const { dragRef, isDragging } = useDragSource(`page:${page.id}`, { kind: 'page', pageId: page.id }, disabled)
  const { dropRef, isDropTarget } = useDropTarget(`page-drop:${page.id}`, { kind: 'page', pageId: page.id }, ['printing', 'slot', 'page'], disabled)
  return (
    <button
      ref={(el) => {
        dragRef(el)
        dropRef(el)
      }}
      type="button"
      role="tab"
      aria-selected={current}
      onClick={onSelect}
      className={cn('h-8 shrink-0 rounded-md border px-3 font-mono text-xs transition-colors', current ? 'border-line-strong bg-surface-3 text-fg' : 'border-line text-fg-muted hover:text-fg', isDropTarget && 'border-accent bg-accent-soft text-fg', isDragging && 'opacity-40')}
      title={page.label ?? undefined}
    >
      {index + 1}{page.label ? ` · ${page.label}` : ''}
    </button>
  )
}
