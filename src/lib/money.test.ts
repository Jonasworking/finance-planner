import { describe, expect, it } from 'vitest'
import { formatAUD, formatEUR, parseAmountInput, ratio } from './money'

describe('formatAUD', () => {
  it('formats with German separators and A$ prefix', () => {
    expect(formatAUD(160000)).toBe('A$1.600,00')
    expect(formatAUD(1250)).toBe('A$12,50')
    expect(formatAUD(0)).toBe('A$0,00')
    expect(formatAUD(123456789)).toBe('A$1.234.567,89')
  })

  it('uses a real minus sign in front of the currency', () => {
    expect(formatAUD(-1250)).toBe('−A$12,50')
  })

  it('supports signed and whole-dollar output', () => {
    expect(formatAUD(5000, { signed: true })).toBe('+A$50,00')
    expect(formatAUD(0, { signed: true })).toBe('A$0,00')
    expect(formatAUD(160049, { decimals: false })).toBe('A$1.600')
    expect(formatAUD(-40, { decimals: false })).toBe('A$0')
  })
})

describe('formatEUR', () => {
  it('converts with the given rate', () => {
    expect(formatEUR(160000, 0.6)).toBe('960,00 €')
    expect(formatEUR(-10000, 0.5)).toBe('−50,00 €')
  })
})

describe('parseAmountInput', () => {
  it.each([
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['1600', 160000],
    ['1.600', 160000],
    ['1.600,00', 160000],
    ['A$ 1.600,00', 160000],
    ['0,05', 5],
    [',5', 50],
  ])('parses %s', (input, cents) => {
    expect(parseAmountInput(input)).toBe(cents)
  })

  it.each(['', 'abc', '-5', '1,2,3', '1,234', ',', '.'])('rejects %j', (input) => {
    expect(parseAmountInput(input)).toBeNull()
  })
})

describe('ratio', () => {
  it('never divides by zero', () => {
    expect(ratio(200, 400)).toBe(0.5)
    expect(ratio(200, 0)).toBe(0)
  })
})
