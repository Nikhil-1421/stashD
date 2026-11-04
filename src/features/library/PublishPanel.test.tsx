import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UserSetOverview } from '@/features/sets/api'
import { renderWithProviders, signedInAs } from '@/test/render'
import { PublishPanel } from './PublishPanel'

const set: UserSetOverview = { id: 'us-1', user_id: 'user-1', catalog_set_id: 'cs-1', tracking_name: null, status: 'active', favorite: false, created_at: '', updated_at: '', set_name: 'Base Set', set_code: null, series: null, release_date: null, language: 'en', description: null, image_url: null, set_owner_id: 'user-1', provider_id: null, game_id: null, game_slug: null, game_name: null, card_count: 1, variant_count: 1, printing_count: 1, owned_printings: 0, owned_quantity: 0, card_order: 'number', visibility: 'public', other_tracker_count: 2 }
let calls: string[] = []
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, setVisibility: (_id: string, v: string) => { calls.push(v); return Promise.resolve(v) } }
})

describe('PublishPanel', () => {
  it('explains the published state and unpublishes on request', async () => {
    renderWithProviders(<PublishPanel set={set} />, { auth: signedInAs() })
    expect(screen.getByText(/2 other collectors have added it/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Published' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Private' }))
    await waitFor(() => expect(calls).toEqual(['private']))
  })
})
