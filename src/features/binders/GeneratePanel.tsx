import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { cardKeys, listAllCards, listVariants } from '@/features/cards/api'
import { collectionKeys, listAllPrintings } from '@/features/collection/api'
import { listUserSets, setDisplayName, setKeys } from '@/features/sets/api'
import { dimensionsLabel, LAYOUT_PRESETS, planPages, type Dimensions } from './domain/layout'

type Props = { defaults: Dimensions; pending: boolean; onGenerate: (printingIds: readonly string[], dims: Dimensions) => Promise<number> }

/** Auto-layout: append pages filled with a set's printings in checklist order. Never touches existing pages. */
export function GeneratePanel({ defaults, pending, onGenerate }: Props) {
  const sets = useQuery({ queryKey: setKeys.list(), queryFn: listUserSets })
  const [setId, setSetId] = useState('')
  const [dims, setDims] = useState<Dimensions>(defaults)
  const [firstVariantOnly, setFirstVariantOnly] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (sets.data ?? []).find((s) => s.id === setId)
  const catalogSetId = set?.catalog_set_id ?? ''

  const variants = useQuery({ queryKey: cardKeys.variants(catalogSetId), queryFn: () => listVariants(catalogSetId), enabled: catalogSetId !== '' })
  const order = set?.card_order ?? 'number'
  const cards = useQuery({ queryKey: cardKeys.allCards(catalogSetId, order), queryFn: () => listAllCards(catalogSetId, order), enabled: catalogSetId !== '' })
  const variantIds = useMemo(() => (variants.data ?? []).map((v) => v.id), [variants.data])
  const printings = useQuery({ queryKey: [...collectionKeys.allPrintings(catalogSetId), variantIds.join(',')], queryFn: () => listAllPrintings(variantIds), enabled: variants.isSuccess && variantIds.length > 0 })

  const ordered = useMemo(() => {
    if (!cards.data || !variants.data || !printings.data) return null
    const variantPos = new Map(variants.data.map((v, i) => [v.id, i]))
    const byCard = new Map<string, { id: string; pos: number }[]>()
    for (const p of printings.data) byCard.set(p.catalog_card_id, [...(byCard.get(p.catalog_card_id) ?? []), { id: p.id, pos: variantPos.get(p.variant_definition_id) ?? 0 }])
    const out: string[] = []
    for (const c of cards.data) {
      const list = (byCard.get(c.id) ?? []).sort((a, b) => a.pos - b.pos)
      for (const p of firstVariantOnly ? list.slice(0, 1) : list) out.push(p.id)
    }
    return out
  }, [cards.data, variants.data, printings.data, firstVariantOnly])
  const plan = ordered ? planPages(ordered.length, dims) : null
  const loadError = variants.error ?? cards.error ?? printings.error

  async function generate() {
    if (!ordered || ordered.length === 0) return
    setError(null)
    setResult(null)
    try {
      const pages = await onGenerate(ordered, dims)
      setResult(`Added ${pages} ${pages === 1 ? 'page' : 'pages'} from ${set ? setDisplayName(set) : 'the set'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate pages.')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">Append pages filled with a set in checklist order. Existing pages are left as they are.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-xs font-medium text-fg-muted">
          Set
          <Select value={setId} onChange={(e) => { setSetId(e.target.value); setResult(null) }} disabled={sets.isPending} className="mt-1 h-9 text-sm">
            <option value="">Choose a set…</option>
            {(sets.data ?? []).map((s) => <option key={s.id} value={s.id}>{setDisplayName(s)}</option>)}
          </Select>
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Page layout
          <Select value={dimensionsLabel(dims)} onChange={(e) => { const p = LAYOUT_PRESETS.find((x) => x.label === e.target.value); if (p) setDims({ rows: p.rows, columns: p.columns }) }} className="mt-1 h-9 text-sm">
            {LAYOUT_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            {LAYOUT_PRESETS.some((p) => p.rows === dims.rows && p.columns === dims.columns) ? null : <option value={dimensionsLabel(dims)}>{dimensionsLabel(dims)}</option>}
          </Select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input type="checkbox" className="size-4 accent-accent" checked={firstVariantOnly} onChange={(e) => setFirstVariantOnly(e.target.checked)} />
        One slot per card (first variant only)
      </label>
      {loadError ? <Alert tone="danger">{loadError.message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {result ? <Alert tone="success">{result}</Alert> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg" aria-live="polite">
          {setId === '' ? 'Pick a set to preview.' : !ordered || !plan ? 'Counting…' : ordered.length === 0 ? 'That set has no printings.' : `${ordered.length} printings → ${plan.pages} ${plan.pages === 1 ? 'page' : 'pages'}, ${plan.emptySlots} empty ${plan.emptySlots === 1 ? 'slot' : 'slots'}.`}
        </p>
        <Button onClick={() => void generate()} disabled={!ordered || ordered.length === 0} loading={pending}>Add pages</Button>
      </div>
    </div>
  )
}
