import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders, signedInAs } from '@/test/render'
import type { SetNote } from './notes-api'
import { SetNotesSection } from './SetNotesSection'

let notes: SetNote[] = []
const note = (id: string, body: string): SetNote => ({ id, user_set_id: 'us-1', body, created_at: '2026-11-04T10:00:00Z', updated_at: '2026-11-04T10:00:00Z' })

vi.mock('./notes-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./notes-api')>()
  return {
    ...actual,
    listNotes: () => Promise.resolve(notes),
    addNote: (_userSetId: string, body: string) => {
      const n = note(`n${notes.length + 1}`, body)
      notes = [n, ...notes]
      return Promise.resolve(n)
    },
    deleteNote: (id: string) => {
      notes = notes.filter((n) => n.id !== id)
      return Promise.resolve()
    },
  }
})

describe('SetNotesSection', () => {
  it('adds and deletes timestamped notes, newest first', async () => {
    notes = [note('n1', 'first')]
    renderWithProviders(<SetNotesSection userSetId="us-1" />, { auth: signedInAs() })
    await userEvent.click(screen.getByRole('button', { name: /Notes/ }))
    expect(await screen.findByText('first')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'New note' }), 'pulled a holo')
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }))
    await waitFor(() => expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('pulled a holo'), expect.stringContaining('first')]))
    expect(screen.getByRole('textbox', { name: 'New note' })).toHaveValue('')

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]!)
    await userEvent.click(screen.getByRole('button', { name: 'Delete note' }))
    await waitFor(() => expect(screen.queryByText('first')).not.toBeInTheDocument())
  })
})
