import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUndoStack } from '@/hooks/useUndoStack'
import { addPage, binderKeys, deletePage, duplicatePage, generatePages, getBinder, listPages, listPlacements, reorderPages, resizePage, savePlacements, updatePageLabel, type BinderOverview, type BinderPage, type BinderPlacementRow } from './api'
import type { Dimensions } from './domain/layout'
import { applyOp, slotKey, type Placement, type PlacementMap, type PlacementOp, type SlotWrite } from './domain/placements'

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed'

const FLUSH_DELAY_MS = 800

export type BinderEditor = {
  binder: BinderOverview | null | undefined
  pages: BinderPage[]
  placements: PlacementMap
  status: 'pending' | 'error' | 'ready'
  error: Error | null
  /** Placement autosave. */
  save: { status: SaveStatus; error: string | null; pendingCount: number; retry: () => void; flush: () => Promise<void> }
  apply: (op: PlacementOp, label: string) => void
  undo: ReturnType<typeof useUndoStack>
  pageOps: {
    add: () => Promise<BinderPage>
    duplicate: (pageId: string) => Promise<string>
    remove: (pageId: string) => Promise<void>
    move: (pageId: string, direction: -1 | 1) => Promise<void>
    resize: (pageId: string, dims: Dimensions) => Promise<number>
    setLabel: (pageId: string, label: string) => Promise<void>
    generate: (printingIds: readonly string[], dims: Dimensions) => Promise<number>
    pending: boolean
    error: Error | null
  }
}

/**
 * Editing state for one binder: server placements + a local overlay of edits, batched to the
 * server after a short pause. Failed batches stay pending (never claimed saved) and can be retried.
 * Page-structure changes flush pending placements first so no write targets a page that is gone.
 */
export function useBinderEditor(binderId: string): BinderEditor {
  const queryClient = useQueryClient()
  const binderQuery = useQuery({ queryKey: binderKeys.detail(binderId), queryFn: () => getBinder(binderId), enabled: binderId !== '' })
  const pagesQuery = useQuery({ queryKey: binderKeys.pages(binderId), queryFn: () => listPages(binderId), enabled: binderId !== '' })
  const pageIds = useMemo(() => (pagesQuery.data ?? []).map((p) => p.id), [pagesQuery.data])
  const placementsKey = binderKeys.placements(binderId)
  const placementsQuery = useQuery({ queryKey: [...placementsKey, pageIds.join(',')], queryFn: () => listPlacements(pageIds), enabled: pagesQuery.isSuccess })
  const rowsKey = useMemo(() => [...placementsKey, pageIds.join(',')] as const, [placementsKey, pageIds])

  const serverMap = useMemo<PlacementMap>(() => new Map((placementsQuery.data ?? []).map((r) => [slotKey({ pageId: r.page_id, slotIndex: r.slot_index }), { printingId: r.printing_id, notes: r.notes }])), [placementsQuery.data])
  const [overlay, setOverlay] = useState<ReadonlyMap<string, Placement | null>>(new Map())
  const placements = useMemo<PlacementMap>(() => {
    if (overlay.size === 0) return serverMap
    const next = new Map(serverMap)
    for (const [key, value] of overlay) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    return next
  }, [serverMap, overlay])
  const placementsRef = useRef<PlacementMap>(placements)
  useEffect(() => {
    placementsRef.current = placements
  }, [placements])

  const pending = useRef<Map<string, SlotWrite>>(new Map())
  const inFlight = useRef(false)
  const timer = useRef<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const undo = useUndoStack()

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    if (inFlight.current || pending.current.size === 0) return
    const batch = [...pending.current.values()]
    pending.current = new Map()
    inFlight.current = true
    setSaveStatus('saving')
    try {
      await savePlacements(batch)
      queryClient.setQueryData<BinderPlacementRow[]>(rowsKey, (old = []) => applyToRows(old, batch))
      setOverlay((prev) => {
        const next = new Map(prev)
        for (const w of batch) if (!pending.current.has(slotKey(w.slot))) next.delete(slotKey(w.slot))
        return next
      })
      setSaveError(null)
      setSaveStatus(pending.current.size > 0 ? 'dirty' : 'saved')
      void queryClient.invalidateQueries({ queryKey: binderKeys.list() })
    } catch (err) {
      // Keep the batch pending, older than anything queued meanwhile.
      const merged = new Map(batch.map((w) => [slotKey(w.slot), w]))
      for (const [k, w] of pending.current) merged.set(k, w)
      pending.current = merged
      setSaveError(err instanceof Error ? err.message : 'Could not save.')
      setSaveStatus('failed')
    } finally {
      inFlight.current = false
      setPendingCount(pending.current.size)
    }
  }, [queryClient, rowsKey])

  const schedule = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), FLUSH_DELAY_MS)
  }, [flush])

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  // After a successful flush, anything queued during it goes out next.
  useEffect(() => {
    if (saveStatus === 'dirty' && !inFlight.current && pending.current.size > 0 && timer.current === null) schedule()
  }, [saveStatus, schedule])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0 || inFlight.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const applyRaw = useCallback(
    (op: PlacementOp): PlacementOp[] => {
      const { next, writes, inverse } = applyOp(placementsRef.current, op)
      if (writes.length === 0) return []
      placementsRef.current = next
      setOverlay((prev) => {
        const merged = new Map(prev)
        for (const w of writes) merged.set(slotKey(w.slot), w.placement)
        return merged
      })
      for (const w of writes) pending.current.set(slotKey(w.slot), w)
      setPendingCount(pending.current.size)
      setSaveStatus('dirty')
      schedule()
      return inverse
    },
    [schedule],
  )

  const apply = useCallback(
    (op: PlacementOp, label: string) => {
      const inverse = applyRaw(op)
      if (inverse.length === 0) return
      undo.push({
        label,
        revert: () => {
          for (const i of inverse) applyRaw(i)
          return Promise.resolve()
        },
      })
    },
    [applyRaw, undo],
  )

  const invalidateStructure = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: binderKeys.pages(binderId) })
    await queryClient.invalidateQueries({ queryKey: binderKeys.detail(binderId) })
    await queryClient.invalidateQueries({ queryKey: binderKeys.list() })
  }, [queryClient, binderId])

  const pages = pagesQuery.data ?? EMPTY_PAGES
  const binder = binderQuery.data
  const structure = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => {
      await flush()
      if (pending.current.size > 0) throw new Error('Unsaved placements could not be saved; retry before changing pages.')
      return task()
    },
    onSuccess: invalidateStructure,
  })
  const run = <T,>(task: () => Promise<T>): Promise<T> => structure.mutateAsync(task) as Promise<T>

  const pageOps: BinderEditor['pageOps'] = {
    add: () =>
      run(() => {
        const order = pages.reduce((max, p) => Math.max(max, p.page_order), -1) + 1
        return addPage(binderId, order, binder?.default_rows ?? 3, binder?.default_columns ?? 3)
      }),
    duplicate: (pageId) => run(() => duplicatePage(pageId)),
    remove: (pageId) => run(() => deletePage(pageId)),
    move: (pageId, direction) =>
      run(async () => {
        const ids = pages.map((p) => p.id)
        const i = ids.indexOf(pageId)
        const j = i + direction
        if (i === -1 || j < 0 || j >= ids.length) return
        const next = [...ids]
        next[i] = ids[j] as string
        next[j] = pageId
        await reorderPages(binderId, next)
      }),
    resize: (pageId, dims) => run(() => resizePage(pageId, dims.rows, dims.columns)),
    setLabel: (pageId, label) => run(() => updatePageLabel(pageId, label)),
    generate: (printingIds, dims) => run(() => generatePages(binderId, printingIds, dims.rows, dims.columns)),
    pending: structure.isPending,
    error: structure.error,
  }

  const status = binderQuery.isError || pagesQuery.isError || placementsQuery.isError ? 'error' : binderQuery.isPending || pagesQuery.isPending || (pagesQuery.isSuccess && placementsQuery.isPending) ? 'pending' : 'ready'

  return {
    binder,
    pages,
    placements,
    status,
    error: binderQuery.error ?? pagesQuery.error ?? placementsQuery.error,
    save: { status: saveStatus, error: saveError, pendingCount, retry: () => void flush(), flush },
    apply,
    undo,
    pageOps,
  }
}

const EMPTY_PAGES: BinderPage[] = []

/** Mirrors a saved batch into the cached rows so a refetch is not needed. */
function applyToRows(rows: readonly BinderPlacementRow[], batch: readonly SlotWrite[]): BinderPlacementRow[] {
  const byKey = new Map(rows.map((r) => [slotKey({ pageId: r.page_id, slotIndex: r.slot_index }), r]))
  for (const w of batch) {
    const key = slotKey(w.slot)
    if (w.placement === null) {
      byKey.delete(key)
      continue
    }
    const existing = byKey.get(key)
    byKey.set(key, existing ? { ...existing, printing_id: w.placement.printingId, notes: w.placement.notes } : { id: `local-${key}`, page_id: w.slot.pageId, slot_index: w.slot.slotIndex, printing_id: w.placement.printingId, collection_item_id: null, notes: w.placement.notes, created_at: '', updated_at: '' })
  }
  return [...byKey.values()]
}
