import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
  { value: 8, label: '8 W', ariaLabel: '8 Wochen' },
  { value: 12, label: '12 W', ariaLabel: '12 Wochen' },
  { value: 26, label: '26 W', ariaLabel: '26 Wochen' },
] as const

function Harness({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <button type="button">davor</button>
      <SegmentedControl<number>
        label="Zeitraum"
        options={OPTIONS}
        value={value}
        onChange={setValue}
      />
    </>
  )
}

describe('SegmentedControl', () => {
  it('is one tab stop; arrows, Home and End move the selection and the focus', async () => {
    const user = userEvent.setup()
    render(<Harness initial={12} />)
    const radio = (name: string) => screen.getByRole('radio', { name })

    await user.click(screen.getByRole('button', { name: 'davor' }))
    await user.tab()
    expect(radio('12 Wochen')).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(radio('26 Wochen')).toHaveFocus()
    expect(radio('26 Wochen')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowRight}') // wraps
    expect(radio('8 Wochen')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowUp}')
    expect(radio('26 Wochen')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Home}')
    expect(radio('8 Wochen')).toHaveFocus()
    await user.keyboard('{End}')
    expect(radio('26 Wochen')).toHaveAttribute('aria-checked', 'true')

    expect(radio('8 Wochen')).toHaveAttribute('tabindex', '-1')
    expect(radio('26 Wochen')).toHaveAttribute('tabindex', '0')
  })

  it('keeps one tab stop when nothing is selected', () => {
    render(<Harness initial={-1} />)
    expect(screen.getByRole('radio', { name: '8 Wochen' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: '12 Wochen' })).toHaveAttribute('tabindex', '-1')
  })
})
