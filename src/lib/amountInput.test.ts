import { describe, expect, it } from 'vitest'
import {
  amountInputToCents,
  applyNumpadKey,
  centsToAmountInput,
  formatAmountInput,
  type NumpadKey,
} from './amountInput'

const type = (keys: string, start = '') =>
  keys
    .split('')
    .reduce(
      (state, key) => applyNumpadKey(state, (key === '<' ? 'backspace' : key) as NumpadKey),
      start,
    )

describe('applyNumpadKey', () => {
  it('builds up an amount with at most two decimals', () => {
    expect(type('12,5')).toBe('12,5')
    expect(type('12,505')).toBe('12,50')
    expect(type('1600')).toBe('1600')
  })

  it('handles the comma: once only, and with a leading zero', () => {
    expect(type(',5')).toBe('0,5')
    expect(type('3,,4')).toBe('3,4')
    expect(type('3,4,')).toBe('3,4')
  })

  it('avoids leading zeros and caps the integer part', () => {
    expect(type('007')).toBe('7')
    expect(type('0,07')).toBe('0,07')
    expect(type('12345678')).toBe('123456')
    expect(type('123456,78')).toBe('123456,78')
  })

  it('deletes from the end and survives deleting nothing', () => {
    expect(type('12,5<')).toBe('12,')
    expect(type('12,5<<')).toBe('12')
    expect(type('<<')).toBe('')
  })
})

describe('amountInputToCents', () => {
  it('reads the entry as far as it is typed', () => {
    expect(amountInputToCents('')).toBe(0)
    expect(amountInputToCents('12')).toBe(1200)
    expect(amountInputToCents('12,')).toBe(1200)
    expect(amountInputToCents('12,5')).toBe(1250)
    expect(amountInputToCents('0,07')).toBe(7)
  })
})

describe('formatAmountInput', () => {
  it('shows exactly what was typed, with grouping', () => {
    expect(formatAmountInput('')).toBe('A$0')
    expect(formatAmountInput('1600')).toBe('A$1.600')
    expect(formatAmountInput('12,')).toBe('A$12,')
    expect(formatAmountInput('12,5')).toBe('A$12,5')
    expect(formatAmountInput('0,07')).toBe('A$0,07')
  })
})

describe('centsToAmountInput', () => {
  it('turns stored cents back into editable text', () => {
    expect(centsToAmountInput(1250)).toBe('12,50')
    expect(centsToAmountInput(1200)).toBe('12')
    expect(centsToAmountInput(7)).toBe('0,07')
    expect(centsToAmountInput(160_000)).toBe('1600')
    expect(amountInputToCents(centsToAmountInput(123_456))).toBe(123_456)
  })
})
