import { describe, expect, it } from 'vitest'
import {
  AUD_DISPLAY,
  formatAUD,
  formatEUR,
  formatMoney,
  formatRate,
  isValidRate,
  moneyDisplay,
  parseAmountInput,
  parseRateInput,
  ratio,
} from './money'

const MINUS = String.fromCharCode(0x2212)
const NBSP = String.fromCharCode(0xa0)

describe('formatAUD', () => {
  it('formats with German separators and A$ prefix', () => {
    expect(formatAUD(160000)).toBe('A$1.600,00')
    expect(formatAUD(1250)).toBe('A$12,50')
    expect(formatAUD(0)).toBe('A$0,00')
    expect(formatAUD(123456789)).toBe('A$1.234.567,89')
  })

  it('uses a real minus sign in front of the currency', () => {
    expect(formatAUD(-1250)).toBe(`${MINUS}A$12,50`)
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
    expect(formatEUR(160000, 0.6)).toBe(`960,00${NBSP}€`)
    expect(formatEUR(-10000, 0.5)).toBe(`${MINUS}50,00${NBSP}€`)
  })

  it('supports signed deltas and whole amounts like formatAUD', () => {
    expect(formatEUR(10000, 0.6, { signed: true })).toBe(`+60,00${NBSP}€`)
    expect(formatEUR(-10000, 0.6, { signed: true })).toBe(`${MINUS}60,00${NBSP}€`)
    expect(formatEUR(0, 0.6, { signed: true })).toBe(`0,00${NBSP}€`)
    expect(formatEUR(199_990, 0.6, { decimals: false })).toBe(`1.200${NBSP}€`)
    expect(formatEUR(-40, 0.6, { decimals: false })).toBe(`0${NBSP}€`) // no "minus zero"
  })
})

describe('moneyDisplay / formatMoney', () => {
  it('shows EUR only when it is switched on and a rate exists', () => {
    expect(moneyDisplay({ showEur: true, eurRate: 0.6 })).toEqual({ currency: 'EUR', rate: 0.6 })
    expect(moneyDisplay({ showEur: false, eurRate: 0.6 })).toBe(AUD_DISPLAY)
    expect(moneyDisplay({ showEur: true, eurRate: null })).toBe(AUD_DISPLAY)
    expect(moneyDisplay({ showEur: true, eurRate: 0 })).toBe(AUD_DISPLAY)
  })

  it('formats in the chosen currency', () => {
    expect(formatMoney(160000, AUD_DISPLAY)).toBe('A$1.600,00')
    expect(formatMoney(160000, { currency: 'EUR', rate: 0.6 }, { decimals: false })).toBe(
      `960${NBSP}€`,
    )
    expect(formatMoney(-2500, AUD_DISPLAY, { signed: true })).toBe(`${MINUS}A$25,00`)
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

describe('exchange rate input', () => {
  it.each([
    ['0,61', 0.61],
    ['0.61', 0.61],
    [' 0,6 ', 0.6],
    ['1', 1],
    ['.5', 0.5],
    ['0,60749', 0.6075],
  ])('parses %j', (input, expected) => {
    expect(parseRateInput(input)).toBe(expected)
  })

  it.each(['', '0', '0,00001', '-0,6', 'abc', '0,6,1', '1.000,5', '101'])('rejects %j', (input) => {
    expect(parseRateInput(input)).toBeNull()
  })

  it('knows a usable rate and formats it for the field', () => {
    expect(isValidRate(0.61)).toBe(true)
    expect(isValidRate(0)).toBe(false)
    expect(isValidRate(Number.NaN)).toBe(false)
    expect(isValidRate(Number.POSITIVE_INFINITY)).toBe(false)
    expect(formatRate(0.6)).toBe('0,60')
    expect(formatRate(0.6075)).toBe('0,6075')
  })
})
