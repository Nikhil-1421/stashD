import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderRoutes, signedInAs } from '@/test/render'
import { BindersPage } from './BindersPage'

let created: unknown[] = []

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    listBinders: () => Promise.resolve([]),
    createBinder: (input: unknown) => {
      created.push(input)
      return Promise.resolve('b-new')
    },
  }
})
vi.mock('@/features/sets/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sets/api')>()
  return { ...actual, listGames: () => Promise.resolve([]) }
})

describe('BindersPage', () => {
  it('creates a binder with a layout preset and opens it', async () => {
    created = []
    const { router } = renderRoutes([{ path: '/binders', element: <BindersPage /> }, { path: '/binders/:binderId', element: <p>editor</p> }], { auth: signedInAs(), initialEntries: ['/binders'] })
    await userEvent.click(await screen.findByRole('button', { name: 'New binder' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create binder' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Give the binder a name.')

    await userEvent.type(screen.getByLabelText('Name'), 'Showcase')
    await userEvent.selectOptions(screen.getByLabelText('Page layout'), '3 × 4')
    await userEvent.click(screen.getByRole('button', { name: 'Create binder' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/binders/b-new'))
    expect(created).toEqual([{ name: 'Showcase', description: '', gameId: '', rows: 3, columns: 4 }])
  })
})
