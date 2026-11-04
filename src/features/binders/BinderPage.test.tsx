import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogCard, VariantDefinition } from '@/features/cards/api'
import type { UserSetOverview } from '@/features/sets/api'
import { renderRoutes, signedInAs } from '@/test/render'
import type { BinderOverview, BinderPage as BinderPageRow, BinderPlacementRow, PrintingDetail } from './api'
import { BinderPage } from './BinderPage'
import type { SlotWrite } from './domain/placements'

const binder: BinderOverview = { id: 'b1', user_id: 'user-1', name: 'Showcase', description: null, cover_image_url: null, game_id: null, game_name: null, default_rows: 2, default_columns: 2, notes: null, created_at: '', updated_at: '', page_count: 1, placement_count: 0, slot_count: 4 }
const page1: BinderPageRow = { id: 'page1', binder_id: 'b1', page_order: 0, rows: 2, columns: 2, label: null, created_at: '', updated_at: '' }
const overview: UserSetOverview = { id: 'us-1', user_id: 'user-1', catalog_set_id: 'cs-1', tracking_name: null, status: 'active', favorite: false, created_at: '', updated_at: '', set_name: 'Base Set', set_code: null, series: null, release_date: null, language: 'en', description: null, image_url: null, set_owner_id: 'user-1', provider_id: null, game_id: null, game_slug: null, game_name: null, card_count: 1, variant_count: 1, printing_count: 1, owned_printings: 0, owned_quantity: 0, card_order: 'number', visibility: 'private', other_tracker_count: 0 }
const pikachu: CatalogCard = { id: 'c25', catalog_set_id: 'cs-1', owner_id: 'user-1', provider_card_id: null, name: 'Pikachu', number: '25', sort_key: '0000000025', rarity: null, artist: null, language: null, image_url: null, external_ids: {}, metadata: {}, position: 0, created_at: '', updated_at: '' }
const base: VariantDefinition = { id: 'v-base', catalog_set_id: 'cs-1', owner_id: 'user-1', slug: 'base', name: 'Base', category: 'finish', applies_by_default: true, position: 0, metadata: {}, created_at: '', updated_at: '' }
const detail: PrintingDetail = { id: 'p25', cardId: 'c25', name: 'Pikachu', number: '25', setId: 'cs-1', variantName: 'Base', variantPosition: 0 }

let placements: BinderPlacementRow[] = []
let saveCalls: SlotWrite[][] = []
let saveImpl: (writes: readonly SlotWrite[]) => Promise<void> = () => Promise.resolve()
let resizeCalls: [string, number, number][] = []

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    getBinder: () => Promise.resolve(binder),
    listPages: () => Promise.resolve([page1]),
    listPlacements: () => Promise.resolve(placements),
    listPrintingDetails: () => Promise.resolve([detail]),
    savePlacements: (writes: readonly SlotWrite[]) => {
      saveCalls.push(writes.map((w) => ({ slot: { ...w.slot }, placement: w.placement })))
      return saveImpl(writes)
    },
    resizePage: (pageId: string, rows: number, columns: number) => {
      resizeCalls.push([pageId, rows, columns])
      return Promise.resolve(1)
    },
  }
})
vi.mock('@/features/sets/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sets/api')>()
  return { ...actual, listUserSets: () => Promise.resolve([overview]), listGames: () => Promise.resolve([]) }
})
vi.mock('@/features/cards/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/cards/api')>()
  return {
    ...actual,
    listVariants: () => Promise.resolve([base]),
    listCards: () => Promise.resolve({ rows: [pikachu], total: 1 }),
    listPrintings: () => Promise.resolve([{ id: 'p25', catalog_card_id: 'c25', variant_definition_id: 'v-base' }]),
  }
})

function renderPage() {
  return renderRoutes([{ path: '/binders/:binderId', element: <BinderPage /> }], { auth: signedInAs(), initialEntries: ['/binders/b1'] })
}
const slot = (name: string) => screen.getByRole('button', { name })

describe('BinderPage', () => {
  beforeEach(() => {
    placements = []
    saveCalls = []
    resizeCalls = []
    saveImpl = () => Promise.resolve()
  })

  it('places a card from the panel, moves it, batches the saves and can undo', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Pikachu Base' }))
    expect(screen.getByText(/^Placing/)).toHaveTextContent('Placing #25 Pikachu')

    await userEvent.click(await screen.findByRole('button', { name: 'Slot 1: empty' }))
    expect(slot('Slot 1: #25 Pikachu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pikachu Base, placed 1' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(saveCalls).toHaveLength(1), { timeout: 3000 })
    expect(saveCalls[0]).toEqual([{ slot: { pageId: 'page1', slotIndex: 0 }, placement: { printingId: 'p25', notes: null } }])
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())

    await userEvent.click(slot('Slot 1: #25 Pikachu'))
    expect(screen.getByRole('toolbar', { name: 'Selected slot' })).toHaveTextContent('Slot 1')
    await userEvent.click(slot('Slot 3: empty'))
    expect(slot('Slot 3: #25 Pikachu')).toBeInTheDocument()
    expect(slot('Slot 1: empty')).toBeInTheDocument()
    await waitFor(() => expect(saveCalls).toHaveLength(2), { timeout: 3000 })
    expect(saveCalls[1]).toEqual([
      { slot: { pageId: 'page1', slotIndex: 2 }, placement: { printingId: 'p25', notes: null } },
      { slot: { pageId: 'page1', slotIndex: 0 }, placement: null },
    ])

    await userEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(slot('Slot 1: #25 Pikachu')).toBeInTheDocument()
    expect(slot('Slot 3: empty')).toBeInTheDocument()
    await waitFor(() => expect(saveCalls).toHaveLength(3), { timeout: 3000 })
  })

  it('keeps edits pending when saving fails and retries them', async () => {
    saveImpl = () => Promise.reject(new Error('network down'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Pikachu Base' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Slot 2: empty' }))
    await waitFor(() => expect(screen.getByText('Save failed')).toBeInTheDocument(), { timeout: 3000 })
    expect(slot('Slot 2: #25 Pikachu')).toBeInTheDocument()

    saveImpl = () => Promise.resolve()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
    expect(saveCalls).toHaveLength(2)
    expect(saveCalls[1]).toEqual(saveCalls[0])
  })

  it('previews what a resize would drop and applies only after confirmation', async () => {
    placements = [{ id: 'pl1', page_id: 'page1', slot_index: 3, printing_id: 'p25', collection_item_id: null, notes: null, created_at: '', updated_at: '' }]
    renderPage()
    await screen.findByRole('button', { name: 'Slot 4: #25 Pikachu' })
    const columns = screen.getByRole('combobox', { name: 'Columns' })
    await userEvent.selectOptions(columns, '1')
    const preview = await screen.findByRole('alert')
    expect(preview).toHaveTextContent('Resizing to 2 × 1 removes 1 placement')
    expect(within(preview).getByText('Slot 4: #25 Pikachu')).toBeInTheDocument()
    await userEvent.click(within(preview).getByRole('button', { name: 'Keep current layout' }))
    expect(resizeCalls).toEqual([])

    await userEvent.selectOptions(columns, '1')
    await userEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Resize and remove them' }))
    await waitFor(() => expect(resizeCalls).toEqual([['page1', 2, 1]]))
  })
})
