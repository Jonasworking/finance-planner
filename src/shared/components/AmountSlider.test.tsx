import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import { stubResizeObserver } from '@/test/ui'
import { AmountSlider } from './AmountSlider'

beforeAll(stubResizeObserver)

function Harness({ initial }: { initial: number }) {
  const [cents, setCents] = useState(initial)
  return (
    <>
      <AmountSlider
        valueCents={cents}
        maxCents={100_000}
        stepCents={500}
        onValueChange={setCents}
        aria-label="Wochenbudget"
      />
      <output>{cents}</output>
    </>
  )
}

describe('AmountSlider', () => {
  it('moves in steps by keyboard and reports cents', async () => {
    const user = userEvent.setup()
    render(<Harness initial={40_000} />)
    const slider = screen.getByRole('slider', { name: 'Wochenbudget' })
    expect(slider).toHaveAttribute('aria-valuenow', '40000')

    slider.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowLeft}')
    expect(screen.getByRole('status')).toHaveTextContent('40500')

    await user.keyboard('{Home}')
    expect(screen.getByRole('status')).toHaveTextContent('0')
  })

  it('keeps the thumb at the end when the value is beyond the range', () => {
    render(<Harness initial={250_000} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '100000')
  })
})
