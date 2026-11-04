import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BinderOverview } from '@/features/binders/api'
import type { UserSetOverview } from '@/features/sets/api'
import { renderRoutes, signedInAs } from '@/test/render'
import type { CardHit } from './api'
import { SearchPage } from './SearchPage'

const set: UserSetOverview = { id: 'us-1', user_id: 'user-1', catalog_set_id: 'cs-1', tracking_name: null, status: 'active', favorite: false, created_at: '', updated_at: '', set_name: 'Base Set', set_code: 'BS', series: null, release_date: null, language: 'en', description: null, image_url: null, set_owner_id: 'user-1', provider_id: null, game_id: null, game_slug: null, game_name: null, card_count: 2, variant_count: 1, printing_count: 2, owned_printings: 1, owned_quantity: 1, card_order: 'number' }
const binder: BinderOverview = { id: 'b1', user_id: 'user-1', name: 'Pikachu showcase', description: null, cover_image_url: null, game_id: null, game_name: null, default_rows: 3, default_columns: 3, notes: null, created_at: '', updated_at: '', page_count: 2, placement_count: 0, slot_count: 18 }
const hits: CardHit[] = [{ id: 'c25', catalog_set_id: 'cs-1', name: 'Pikachu', number: '25', rarity: 'Common' }]
let searched: [string[], string][] = []

vi.mock('@/features/sets/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sets/api')>()
  return { ...actual, listUserSets: () => Promise.resolve([set]) }
})
vi.mock('@/features/binders/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/binders/api')>()
  return { ...actual, listBinders: () => Promise.resolve([binder]) }
})
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    searchCards: (ids: string[], term: string) => {
      searched.push([ids, term])
      return Promise.resolve(term.toLowerCase() === 'pika' ? hits : [])
    },
  }
})

describe('SearchPage', () => {
  it('searches sets, binders and cards from the query string and links cards into their set', async () => {
    searched = []
    renderRoutes([{ path: '/search', element: <SearchPage /> }], { auth: signedInAs(), initialEntries: ['/search?q=pika'] })
    expect(await screen.findByRole('link', { name: /Pikachu showcase/ })).toHaveAttribute('href', '/binders/b1')
    const card = await screen.findByRole('link', { name: /#25.*Pikachu.*Base Set/ })
    expect(card).toHaveAttribute('href', '/sets/us-1?q=25')
    expect(screen.queryByRole('link', { name: /^Base Set/ })).not.toBeInTheDocument()
    await waitFor(() => expect(searched).toEqual([[['cs-1'], 'pika']]))
  })

  it('submits a new term into the URL and reports when nothing matches', async () => {
    const { router } = renderRoutes([{ path: '/search', element: <SearchPage /> }], { auth: signedInAs(), initialEntries: ['/search'] })
    expect(screen.getByText(/Type something to search/)).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz{Enter}')
    await waitFor(() => expect(router.state.location.search).toBe('?q=zzz'))
    expect(await screen.findByText('Nothing matches “zzz”.')).toBeInTheDocument()
  })
})
