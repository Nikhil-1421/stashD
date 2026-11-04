import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, signedInAs } from '@/test/render'
import { CardsSection } from '@/features/cards/CardsSection'
import type { CatalogCard, VariantDefinition } from '@/features/cards/api'
import type { CollectionItem, PrintingRow } from '@/features/collection/api'
import { useSetCollection } from '@/features/collection/useSetCollection'

const card: CatalogCard = { id: 'c1', catalog_set_id: 'cs-1', owner_id: 'user-1', provider_card_id: null, name: 'Pikachu', number: '25', sort_key: '0000000025', rarity: null, artist: null, language: null, image_url: null, external_ids: {}, metadata: {}, position: 0, created_at: '', updated_at: '' }
const base: VariantDefinition = { id: 'v-base', catalog_set_id: 'cs-1', owner_id: 'user-1', slug: 'base', name: 'Base', category: 'finish', applies_by_default: true, position: 0, metadata: {}, created_at: '', updated_at: '' }
const reverse: VariantDefinition = { ...base, id: 'v-rev', slug: 'reverse-holo', name: 'Reverse Holo', position: 1 }
const printings: PrintingRow[] = [
  { id: 'p-base', catalog_card_id: 'c1', variant_definition_id: 'v-base' },
  { id: 'p-rev', catalog_card_id: 'c1', variant_definition_id: 'v-rev' },
]

let setItemImpl: (printingId: string, quantity: number | undefined) => Promise<CollectionItem> = () => Promise.reject(new Error('not stubbed'))
const item = (printingId: string, quantity: number): CollectionItem => ({ id: `i-${printingId}`, user_set_id: 'us-1', printing_id: printingId, quantity, condition: null, notes: null, created_at: '', updated_at: '' })

vi.mock('@/features/cards/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/cards/api')>()
  return { ...actual, listCards: () => Promise.resolve({ rows: [card], total: 1 }) }
})
vi.mock('@/features/collection/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/collection/api')>()
  return {
    ...actual,
    listAllPrintings: () => Promise.resolve(printings),
    listItems: () => Promise.resolve([]),
    listRules: () => Promise.resolve([{ scope: 'variant', target: 'v-rev', action: 'exclude' }]),
    setItem: (_userSetId: string, printingId: string, patch: { quantity?: number }) => setItemImpl(printingId, patch.quantity),
  }
})

function Harness() {
  const collection = useSetCollection('us-1', 'cs-1', [base, reverse])
  return (
    <>
      <p data-testid="progress">{collection.completion.owned}/{collection.completion.required}</p>
      <CardsSection setId="cs-1" editable={false} variants={[base, reverse]} collection={collection} />
    </>
  )
}

describe('CardsSection collect mode', () => {
  beforeEach(() => {
    setItemImpl = (printingId, quantity) => Promise.resolve(item(printingId, quantity ?? 1))
  })

  it('marks a printing owned optimistically and counts it against the requirements', async () => {
    renderWithProviders(<Harness />, { auth: signedInAs() })
    const cell = await screen.findByRole('button', { name: 'Pikachu Base: not owned' })
    expect(screen.getByTestId('progress')).toHaveTextContent('0/1')
    expect(screen.getByRole('button', { name: 'Pikachu Reverse Holo: not owned, not required' })).toBeInTheDocument()
    expect(screen.getByText('Missing')).toBeInTheDocument()

    await userEvent.click(cell)
    expect(await screen.findByRole('button', { name: 'Pikachu Base: owned' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByTestId('progress')).toHaveTextContent('1/1'))
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  it('rolls back and shows the error when the server rejects the change', async () => {
    setItemImpl = () => Promise.reject(new Error('permission denied for table collection_items'))
    renderWithProviders(<Harness />, { auth: signedInAs() })
    await userEvent.click(await screen.findByRole('button', { name: 'Pikachu Base: not owned' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission denied/)
    expect(screen.getByRole('button', { name: 'Pikachu Base: not owned' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('progress')).toHaveTextContent('0/1')
  })
})
