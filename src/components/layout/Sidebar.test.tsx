import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NAV_ITEMS } from '@/app/navigation'
import { renderRoutes } from '@/test/render'
import { Sidebar } from './Sidebar'

function Harness({ collapsed = false, onToggle = () => {} }: { collapsed?: boolean; onToggle?: () => void }) {
  return <Sidebar collapsed={collapsed} onToggle={onToggle} />
}

describe('Sidebar', () => {
  it('lists every navigation section with an accessible name', () => {
    renderRoutes([{ path: '/', element: <Harness /> }])
    const nav = screen.getByRole('navigation')
    for (const item of NAV_ITEMS) {
      expect(nav).toContainElement(screen.getByRole('link', { name: new RegExp(item.label) }))
    }
  })

  it('keeps accessible labels when collapsed and exposes the toggle state', async () => {
    const onToggle = vi.fn()
    renderRoutes([{ path: '/', element: <Harness collapsed onToggle={onToggle} /> }])
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: /expand sidebar/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('marks unbuilt sections as planned', () => {
    renderRoutes([{ path: '/', element: <Harness /> }])
    const planned = NAV_ITEMS.filter((i) => i.status === 'planned').length
    expect(screen.getAllByText('Planned')).toHaveLength(planned)
  })
})
