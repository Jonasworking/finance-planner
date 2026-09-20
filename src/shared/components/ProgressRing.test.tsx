import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressRing } from './ProgressRing'

const arcs = (container: HTMLElement) => container.querySelectorAll('circle').length - 1 // − track

describe('ProgressRing', () => {
  it('announces used + reserved and draws the reserved share as its own arc', () => {
    const { container } = render(<ProgressRing value={0.3} reserved={0.45} label="Budget" />)
    expect(screen.getByRole('progressbar', { name: 'Budget' })).toHaveAttribute(
      'aria-valuenow',
      '75',
    )
    expect(arcs(container)).toBe(2)
  })

  it('draws a single arc without anything reserved', () => {
    const { container } = render(<ProgressRing value={0.3} label="Budget" />)
    expect(arcs(container)).toBe(1)
  })

  it('draws no arc at zero (a round cap would leave a dot) and clamps beyond 100 %', () => {
    const empty = render(<ProgressRing value={0} label="Leer" />)
    expect(arcs(empty.container)).toBe(0)
    expect(screen.getByRole('progressbar', { name: 'Leer' })).toHaveAttribute('aria-valuenow', '0')

    render(<ProgressRing value={0.9} reserved={0.6} label="Drüber" />)
    expect(screen.getByRole('progressbar', { name: 'Drüber' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
  })
})
