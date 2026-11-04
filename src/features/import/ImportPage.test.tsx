import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoutes, signedInAs } from '@/test/render'
import type { VariantDefinition } from '@/features/cards/api'
import type { UserSetOverview } from '@/features/sets/api'
import type { ImportSummary } from '@/features/import/api'
import type { ExistingCard } from '@/features/import/domain/plan'
import { ImportPage } from '@/features/import/ImportPage'

let getUserSetImpl: () => Promise<UserSetOverview | null> = () => Promise.resolve(null)
let listCardKeysImpl: () => Promise<ExistingCard[]> = () => Promise.resolve([])
let importChecklistImpl: (args: unknown) => Promise<ImportSummary> = () => Promise.reject(new Error('not stubbed'))
let importCalls: unknown[] = []

vi.mock('@/features/sets/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sets/api')>()
  return { ...actual, getUserSet: () => getUserSetImpl() }
})
vi.mock('@/features/cards/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/cards/api')>()
  const base: VariantDefinition = { id: 'v-base', catalog_set_id: 'cs-1', owner_id: 'user-1', slug: 'base', name: 'Base', category: 'finish', applies_by_default: true, position: 0, metadata: {}, created_at: '', updated_at: '' }
  return { ...actual, listVariants: () => Promise.resolve([base]) }
})
vi.mock('@/features/import/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/import/api')>()
  return {
    ...actual,
    listCardKeys: () => listCardKeysImpl(),
    importChecklist: (args: unknown) => {
      importCalls.push(args)
      return importChecklistImpl(args)
    },
  }
})

const ownSet: UserSetOverview = {
  id: 'us-1', user_id: 'user-1', catalog_set_id: 'cs-1', tracking_name: null, status: 'active', favorite: false,
  created_at: '', updated_at: '', set_name: 'Base Set', set_code: 'BS', series: null, release_date: null, language: 'en',
  description: null, image_url: null, set_owner_id: 'user-1', provider_id: null, game_id: null, game_slug: null, game_name: null,
  card_count: 1, variant_count: 1, printing_count: 1, owned_printings: 0, owned_quantity: 0,
}

const routes = [
  { path: '/sets/:userSetId/import', element: <ImportPage /> },
  { path: '/sets/:userSetId', element: <h1>Set page</h1> },
]

describe('ImportPage', () => {
  beforeEach(() => {
    getUserSetImpl = () => Promise.resolve(ownSet)
    listCardKeysImpl = () => Promise.resolve([{ id: 'c-1', name: 'Bulbasaur', number: '001' }])
    importChecklistImpl = () => Promise.resolve({ job_id: 'j', created: 1, updated: 0, skipped: 1, printings: 1, variants: 1 })
    importCalls = []
  })

  it('refuses shared sets', async () => {
    getUserSetImpl = () => Promise.resolve({ ...ownSet, set_owner_id: null, provider_id: 'p-1' })
    renderRoutes(routes, { auth: signedInAs(), initialEntries: ['/sets/us-1/import'] })
    expect(await screen.findByText(/only custom sets accept imports/i)).toBeInTheDocument()
  })

  it('pastes, reviews matches and commits the reviewed payload', async () => {
    const user = userEvent.setup()
    const { router } = renderRoutes(routes, { auth: signedInAs(), initialEntries: ['/sets/us-1/import'] })

    const textarea = await screen.findByRole('textbox', { name: /checklist text/i })
    await user.type(textarea, '001 - Bulbasaur - Reverse Holo{enter}002 - Ivysaur{enter}garbage line')
    // One stray line in three is below the auto-detect threshold, so pick the format by hand.
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 lines recognised'))
    await user.selectOptions(screen.getByRole('combobox', { name: /line format/i }), 'number-dash-name')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 lines recognised, 1 not understood'))

    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/1 row matches a card already in the set/i)).toBeInTheDocument()
    expect(screen.getByText(/1 new variant will be created/i)).toBeInTheDocument()
    expect(screen.getByText(/line 3/)).toBeInTheDocument()
    expect(screen.getByText('Exists · skip')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /update existing cards/i }))
    expect(screen.getByText('Exists · update')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /import 2 cards/i }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sets/us-1'))
    expect(importCalls).toHaveLength(1)
    expect(importCalls[0]).toEqual({
      setId: 'cs-1',
      source: 'paste',
      strategy: 'update',
      variants: [{ slug: 'reverse-holo', name: 'Reverse Holo' }],
      cards: [
        { name: 'Bulbasaur', number: '001', rarity: null, artist: null, language: null, external_id: null, variants: ['reverse-holo'], existing_id: 'c-1' },
        { name: 'Ivysaur', number: '002', rarity: null, artist: null, language: null, external_id: null, variants: [], existing_id: null },
      ],
    })
    expect(router.state.location.state).toEqual({ notice: 'Import complete: 1 added, 1 skipped, 1 new variant, 1 printing.' })
  })

  it('shows the RPC error and stays on the review step', async () => {
    importChecklistImpl = () => Promise.reject(new Error('imports are limited to 5000 cards at a time'))
    const user = userEvent.setup()
    renderRoutes(routes, { auth: signedInAs(), initialEntries: ['/sets/us-1/import'] })
    await user.type(await screen.findByRole('textbox', { name: /checklist text/i }), 'Charmander')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 line recognised'))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(await screen.findByRole('button', { name: /import 1 card/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/limited to 5000/)
    expect(screen.getByRole('button', { name: /import 1 card/i })).toBeEnabled()
  })
})
