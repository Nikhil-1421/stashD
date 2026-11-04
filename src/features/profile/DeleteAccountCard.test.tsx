import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoutes, signedInAs } from '@/test/render'
import { DeleteAccountCard } from './DeleteAccountCard'

const deleteAccount = vi.fn()
vi.mock('@/features/auth/api', () => ({ deleteAccount: () => deleteAccount() }))

const routes = [
  { path: '/settings', element: <DeleteAccountCard /> },
  { path: '/login', element: <p>login page</p> },
]

describe('DeleteAccountCard', () => {
  beforeEach(() => deleteAccount.mockReset())

  it('hides the form behind a first click and keeps the delete button disabled until the email matches', async () => {
    renderRoutes(routes, { auth: signedInAs('ash@example.com'), initialEntries: ['/settings'] })
    expect(screen.queryByRole('button', { name: /permanently delete/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /delete my account/i }))
    const submit = screen.getByRole('button', { name: /permanently delete/i })
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/type ash@example.com to confirm/i), 'ash@example.co')
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/type ash@example.com to confirm/i), 'm')
    expect(submit).toBeEnabled()
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('calls the API once confirmed and sends the user to the login page with a notice', async () => {
    deleteAccount.mockResolvedValue({ ok: true, data: undefined })
    const { router } = renderRoutes(routes, { auth: signedInAs('ash@example.com'), initialEntries: ['/settings'] })
    await userEvent.click(screen.getByRole('button', { name: /delete my account/i }))
    await userEvent.type(screen.getByLabelText(/to confirm/i), 'ASH@example.com')
    await userEvent.click(screen.getByRole('button', { name: /permanently delete/i }))

    expect(deleteAccount).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('login page')).toBeInTheDocument()
    expect(router.state.location.state).toMatchObject({ notice: expect.stringMatching(/deleted/) })
  })

  it('shows the server error and stays on the page when deletion fails', async () => {
    deleteAccount.mockResolvedValue({ ok: false, error: 'permission denied' })
    renderRoutes(routes, { auth: signedInAs('ash@example.com'), initialEntries: ['/settings'] })
    await userEvent.click(screen.getByRole('button', { name: /delete my account/i }))
    await userEvent.type(screen.getByLabelText(/to confirm/i), 'ash@example.com')
    await userEvent.click(screen.getByRole('button', { name: /permanently delete/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission denied/)
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })
})
