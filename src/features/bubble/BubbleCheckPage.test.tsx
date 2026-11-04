import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardSummary, VariantDefinition } from '@/features/cards/api'
import type { CollectionItem, PrintingRow, QuantityWrite } from '@/features/collection/api'
import type { RequirementRule } from '@/features/collection/domain/requirements'
import type { UserSetOverview } from '@/features/sets/api'
import { renderRoutes, signedInAs } from '@/test/render'
import { BubbleCheckPage } from './BubbleCheckPage'

const overview: UserSetOverview = {
  id: 'us-1', user_id: 'user-1', catalog_set_id: 'cs-1', tracking_name: null, status: 'active', favorite: false, created_at: '', updated_at: '',
  set_name: 'Base Set', set_code: 'BS', series: null, release_date: null, language: 'en', description: null, image_url: null, set_owner_id: 'user-1', provider_id: null,
  game_id: null, game_slug: null, game_name: null, card_count: 2, variant_count: 2, printing_count: 4, owned_printings: 0, owned_quantity: 0,
}
const cards: CardSummary[] = [
  { id: 'c1', name: 'Bulbasaur', number: '1', rarity: 'Common' },
  { id: 'c2', name: 'Pikachu', number: '25', rarity: 'Rare' },
]
const base: VariantDefinition = { id: 'v-base', catalog_set_id: 'cs-1', owner_id: 'user-1', slug: 'base', name: 'Base', category: 'finish', applies_by_default: true, position: 0, metadata: {}, created_at: '', updated_at: '' }
const reverse: VariantDefinition = { ...base, id: 'v-rev', slug: 'reverse-holo', name: 'Reverse Holo', position: 1 }
const printings: PrintingRow[] = [
  { id: 'p1b', catalog_card_id: 'c1', variant_definition_id: 'v-base' },
  { id: 'p1r', catalog_card_id: 'c1', variant_definition_id: 'v-rev' },
  { id: 'p2b', catalog_card_id: 'c2', variant_definition_id: 'v-base' },
  { id: 'p2r', catalog_card_id: 'c2', variant_definition_id: 'v-rev' },
]
const item = (printingId: string, quantity: number): CollectionItem => ({ id: `i-${printingId}`, user_set_id: 'us-1', printing_id: printingId, quantity, condition: null, notes: null, created_at: '', updated_at: '' })

let bulkCalls: QuantityWrite[][] = []
let bulkImpl: (writes: readonly QuantityWrite[]) => Promise<CollectionItem[]> = () => Promise.reject(new Error('not stubbed'))
let rules: RequirementRule[] = []
let upsertedRules: RequirementRule[][] = []
let deletedRules: { scope: string; targets: string[] }[] = []

vi.mock('@/features/sets/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sets/api')>()
  return { ...actual, getUserSet: () => Promise.resolve(overview) }
})
vi.mock('@/features/cards/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/cards/api')>()
  return { ...actual, listAllCards: () => Promise.resolve(cards), listVariants: () => Promise.resolve([base, reverse]) }
})
vi.mock('@/features/collection/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/collection/api')>()
  return {
    ...actual,
    listAllPrintings: () => Promise.resolve(printings),
    listItems: () => Promise.resolve([]),
    listRules: () => Promise.resolve(rules),
    setItemsBulk: (_userSetId: string, writes: readonly QuantityWrite[]) => {
      bulkCalls.push([...writes])
      return bulkImpl(writes)
    },
    upsertRules: (_userSetId: string, next: readonly RequirementRule[]) => {
      if (next.length === 0) return Promise.resolve()
      upsertedRules.push([...next])
      rules = [...rules.filter((r) => !next.some((n) => n.scope === r.scope && n.target === r.target)), ...next]
      return Promise.resolve()
    },
    deleteRules: (_userSetId: string, scope: string, targets: readonly string[]) => {
      deletedRules.push({ scope, targets: [...targets] })
      rules = rules.filter((r) => !(r.scope === scope && targets.includes(r.target)))
      return Promise.resolve()
    },
  }
})

function renderPage() {
  return renderRoutes([{ path: '/sets/:userSetId/bubble', element: <BubbleCheckPage /> }], { auth: signedInAs(), initialEntries: ['/sets/us-1/bubble'] })
}

describe('BubbleCheckPage', () => {
  beforeEach(() => {
    bulkCalls = []
    upsertedRules = []
    deletedRules = []
    rules = [{ scope: 'variant', target: 'v-rev', action: 'exclude' }]
    bulkImpl = (writes) => Promise.resolve(writes.map((w) => item(w.printingId, w.quantity)))
  })

  it('renders a labelled pill per printing with its requirement state', async () => {
    renderPage()
    const grid = await screen.findByRole('group', { name: 'Base Set cards' })
    const pills = within(grid).getAllByRole('button')
    expect(pills.map((p) => p.getAttribute('aria-label'))).toEqual(['Bulbasaur Base: missing', 'Bulbasaur Reverse Holo: not required', 'Pikachu Base: missing', 'Pikachu Reverse Holo: not required'])
    expect(pills.map((p) => p.textContent)).toEqual(['1', '1rh', '25', '25rh'])
    expect(screen.getByRole('button', { name: /^Missing/ })).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: /^Not required/ })).toHaveTextContent('2')
  })

  it('toggles ownership on tap, updates progress and offers undo', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Pikachu Base: missing' }))
    expect(await screen.findByRole('button', { name: 'Pikachu Base: owned' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(bulkCalls).toEqual([[{ printingId: 'p2b', quantity: 1 }]]))
    expect(screen.getByRole('progressbar', { name: 'Completion' })).toHaveAttribute('aria-valuenow', '50')

    const toast = screen.getByRole('status', { name: '' })
    expect(toast).toHaveTextContent('#25 Pikachu marked owned')
    await userEvent.click(within(toast).getByRole('button', { name: /Undo/ }))
    expect(await screen.findByRole('button', { name: 'Pikachu Base: missing' })).toBeInTheDocument()
    await waitFor(() => expect(bulkCalls).toHaveLength(2))
    expect(bulkCalls[1]).toEqual([{ printingId: 'p2b', quantity: 0 }])
    await waitFor(() => expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument())
  })

  it('rolls back and reports the error when the write fails', async () => {
    bulkImpl = () => Promise.reject(new Error('permission denied for table collection_items'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Bulbasaur Base: missing' }))
    expect(await screen.findByText(/permission denied/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bulbasaur Base: missing' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument()
  })

  it('selects pills and marks them owned in one bulk write', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Select' }))
    await userEvent.click(screen.getByRole('button', { name: 'Bulbasaur Base: missing' }))
    await userEvent.click(screen.getByRole('button', { name: 'Pikachu Base: missing' }))
    const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' })
    expect(toolbar).toHaveTextContent('2 selected')
    expect(screen.getByRole('button', { name: 'Pikachu Base: missing, selected' })).toBeInTheDocument()

    await userEvent.click(within(toolbar).getByRole('button', { name: 'Mark owned' }))
    await waitFor(() => expect(bulkCalls).toEqual([[{ printingId: 'p1b', quantity: 1 }, { printingId: 'p2b', quantity: 1 }]]))
    expect(await screen.findByRole('button', { name: 'Bulbasaur Base: owned, selected' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Completion' })).toHaveAttribute('aria-valuenow', '100')
  })

  it('writes printing-scope exclude rules for the selection and can undo them', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Select' }))
    await userEvent.click(screen.getByRole('button', { name: 'Bulbasaur Base: missing' }))
    await userEvent.click(screen.getByRole('button', { name: 'Exclude from completion' }))
    await waitFor(() => expect(upsertedRules).toEqual([[{ scope: 'printing', target: 'p1b', action: 'exclude' }]]))
    expect(deletedRules).toEqual([{ scope: 'printing', targets: ['p1b'] }])
    expect(await screen.findByRole('button', { name: 'Bulbasaur Base: not required, selected' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Undo/ }))
    await waitFor(() => expect(deletedRules).toHaveLength(2))
    expect(upsertedRules).toHaveLength(1)
    expect(await screen.findByRole('button', { name: 'Bulbasaur Base: missing, selected' })).toBeInTheDocument()
  })

  it('falls back to a text box when the clipboard is unavailable', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Base Set cards' })
    await userEvent.click(screen.getByRole('button', { name: 'Copy missing' }))
    const box = await screen.findByRole('textbox', { name: 'Missing list' })
    expect(box).toHaveValue('1 - Bulbasaur\n25 - Pikachu')
  })
})
