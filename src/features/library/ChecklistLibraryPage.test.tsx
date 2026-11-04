import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserSetOverview } from '@/features/sets/api'
import { renderRoutes, signedInAs } from '@/test/render'
import type { LibraryEntry } from './api'
import { ChecklistLibraryPage } from './ChecklistLibraryPage'

const entry = (over: Partial<LibraryEntry>): LibraryEntry => ({
  id: 'cs-pub', name: 'Jungle', set_code: 'JU', series: null, release_date: '1999-06-16', language: 'en', description: 'Full 64-card checklist', card_order: 'number', published_at: '2026-11-04T00:00:00Z', updated_at: '',
  publisher_id: 'user-2', publisher_name: 'Misty', game_id: 'g1', game_slug: 'pokemon', game_name: 'Pokémon', card_count: 64, variant_count: 2, printing_count: 128, tracker_count: 3, ...over,
})
const tracked: UserSetOverview = { id: 'us-9', user_id: 'user-1', catalog_set_id: 'cs-mine', tracking_name: null, status: 'active', favorite: false, created_at: '', updated_at: '', set_name: 'Fossil', set_code: 'FO', series: null, release_date: null, language: 'en', description: null, image_url: null, set_owner_id: 'user-3', provider_id: null, game_id: 'g1', game_slug: 'pokemon', game_name: 'Pokémon', card_count: 62, variant_count: 1, printing_count: 62, owned_printings: 0, owned_quantity: 0, card_order: 'number', visibility: 'public', other_tracker_count: 1 }

let calls: string[] = []
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    listLibrary: () => Promise.resolve([entry({}), entry({ id: 'cs-mine', name: 'Fossil', set_code: 'FO', publisher_id: 'user-3', publisher_name: 'Brock' }), entry({ id: 'cs-f1', name: 'Topps Chrome F1', game_slug: 'f1', game_name: 'Formula 1', publisher_id: 'user-1' })]),
    trackSet: (id: string) => { calls.push(`track:${id}`); return Promise.resolve('us-new') },
    duplicateSet: (id: string) => { calls.push(`copy:${id}`); return Promise.resolve('us-copy') },
  }
})
vi.mock('@/features/sets/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sets/api')>()
  return { ...actual, listUserSets: () => Promise.resolve([tracked]) }
})

function renderPage() {
  return renderRoutes([{ path: '/checklists', element: <ChecklistLibraryPage /> }, { path: '/sets/:id', element: <p>set page</p> }], { auth: signedInAs(), initialEntries: ['/checklists'] })
}

describe('ChecklistLibraryPage', () => {
  beforeEach(() => {
    calls = []
  })

  it('lists published checklists, shows which are already tracked or yours, and filters by game', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'Jungle' })).toHaveAttribute('href', '/checklists/cs-pub')
    expect(screen.getByText('Published by Misty')).toBeInTheDocument()
    expect(screen.getByText('Published by you')).toBeInTheDocument()
    const fossil = screen.getByRole('link', { name: 'Fossil' }).closest('article')!
    expect(within(fossil).getByRole('link', { name: 'In your collection' })).toHaveAttribute('href', '/sets/us-9')
    await userEvent.click(screen.getByRole('button', { name: 'Formula 1' }))
    expect(screen.queryByRole('link', { name: 'Jungle' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Topps Chrome F1' })).toBeInTheDocument()
  })

  it('adds a checklist to the collection and opens it', async () => {
    const { router } = renderPage()
    const jungle = (await screen.findByRole('link', { name: 'Jungle' })).closest('article')!
    await userEvent.click(within(jungle).getByRole('button', { name: 'Add to my collection' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sets/us-new'))
    expect(calls).toEqual(['track:cs-pub'])
  })

  it('copies a checklist into a private set', async () => {
    const { router } = renderPage()
    const jungle = (await screen.findByRole('link', { name: 'Jungle' })).closest('article')!
    await userEvent.click(within(jungle).getByRole('button', { name: 'Copy as my own' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sets/us-copy'))
    expect(calls).toEqual(['copy:cs-pub'])
  })
})
