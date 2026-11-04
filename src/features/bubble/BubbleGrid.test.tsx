import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { BubbleGrid } from './BubbleGrid'
import type { Bubble } from './domain/bubbles'

const bubble = (n: number, state: Bubble['state'] = 'missing'): Bubble => ({
  key: `printing:p${n}`, unit: 'printing', cardId: `c${n}`, printingIds: [`p${n}`], label: String(n), number: String(n), name: `Card ${n}`, variantId: 'v', variantName: 'Base', rarity: null, state, quantity: state === 'owned' ? 1 : 0, required: state !== 'excluded',
})
const bubbles = [bubble(1), bubble(2, 'owned'), bubble(3)]

describe('BubbleGrid keyboard support', () => {
  it('moves focus with the arrow keys using a roving tabindex and activates with Space', async () => {
    const onToggle = vi.fn()
    renderWithProviders(<BubbleGrid bubbles={bubbles} selected={new Set()} selecting={false} pending={new Set()} disabled={false} onToggle={onToggle} onSelect={() => {}} aria-label="Cards" />)
    const [first, second, third] = screen.getAllByRole('button')
    expect(first).toHaveAttribute('tabindex', '0')
    expect(second).toHaveAttribute('tabindex', '-1')

    await userEvent.tab()
    expect(first).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('tabindex', '0')
    await userEvent.keyboard('{Control>}{End}{/Control}')
    expect(third).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(second).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(onToggle).toHaveBeenCalledWith(bubbles[1])
  })

  it('selects a range with Shift+Space and with shift-click', async () => {
    const onSelect = vi.fn()
    renderWithProviders(<BubbleGrid bubbles={bubbles} selected={new Set(['printing:p1'])} selecting={false} pending={new Set()} disabled={false} onToggle={() => {}} onSelect={onSelect} aria-label="Cards" />)
    expect(screen.getByRole('button', { name: 'Card 1 Base: missing, selected' })).toBeInTheDocument()
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}{Shift>} {/Shift}')
    expect(onSelect).toHaveBeenCalledWith(bubbles[1], true)
    const user = userEvent.setup()
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('button', { name: 'Card 3 Base: missing' }))
    await user.keyboard('{/Shift}')
    expect(onSelect).toHaveBeenLastCalledWith(bubbles[2], true)
  })
})
