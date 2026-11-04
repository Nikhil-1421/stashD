import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoutes, signedInAs } from '@/test/render'
import type { UserSetOverview } from '@/features/sets/api'
import { CollectionsPage } from '@/features/sets/CollectionsPage'

let listUserSetsImpl: () => Promise<UserSetOverview[]> = () => Promise.resolve([])
vi.mock('@/features/sets/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sets/api')>()
  return { ...actual, listUserSets: () => listUserSetsImpl() }
})

const set = (over: Partial<UserSetOverview>): UserSetOverview => ({
  id: 'us-1',
  user_id: 'user-1',
  catalog_set_id: 'cs-1',
  tracking_name: null,
  status: 'active',
  favorite: false,
  card_order: 'number',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  set_name: 'Base Set',
  set_code: 'BS',
  series: null,
  release_date: '1999-01-09',
  language: 'en',
  description: null,
  image_url: null,
  set_owner_id: 'user-1',
  provider_id: null,
  game_id: 'g-1',
  game_slug: 'pokemon',
  game_name: 'Pokémon',
  card_count: 102,
  variant_count: 1,
  printing_count: 102,
  owned_printings: 0,
  owned_quantity: 0,
  ...over,
})

const routes = [{ path: '/sets', element: <CollectionsPage /> }]

describe('CollectionsPage', () => {
  beforeEach(() => {
    listUserSetsImpl = () => Promise.resolve([])
  })

  it('shows the empty state with a create action when nothing is tracked', async () => {
    listUserSetsImpl = () => Promise.resolve([])
    renderRoutes(routes, { auth: signedInAs(), initialEntries: ['/sets'] })
    expect(await screen.findByRole('heading', { name: /no sets yet/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /new custom set/i })).toHaveAttribute('href', '/sets/new')
  })

  it('lists sets with counts and filters by search and game', async () => {
    listUserSetsImpl = () => Promise.resolve([
      set({}),
      set({ id: 'us-2', catalog_set_id: 'cs-2', set_name: '2024 Topps Chrome F1', set_code: null, game_slug: 'f1', game_name: 'Formula 1', card_count: 390, variant_count: 30 }),
    ])
    renderRoutes(routes, { auth: signedInAs(), initialEntries: ['/sets'] })
    expect(await screen.findByRole('link', { name: /base set/i })).toHaveAttribute('href', '/sets/us-1')
    expect(screen.getByText(/390 cards · 30 variants/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Formula 1' }))
    expect(screen.queryByRole('link', { name: /base set/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /topps chrome/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    await userEvent.type(screen.getByRole('searchbox', { name: /search sets/i }), 'bs')
    expect(screen.getByRole('link', { name: /base set/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /topps chrome/i })).not.toBeInTheDocument()
  })

  it('surfaces a load error', async () => {
    listUserSetsImpl = () => Promise.reject(new Error('permission denied for view user_set_overview'))
    renderRoutes(routes, { auth: signedInAs(), initialEntries: ['/sets'] })
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission denied/)
  })
})
