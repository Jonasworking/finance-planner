import { describe, expect, it } from 'vitest'
import { makeCategory, makeExpense, makePot, NOW } from '@/test/fixtures'
import { centsToDecimalComma, csvCell, expensesToCsv } from './csv'

describe('centsToDecimalComma', () => {
  it('formats with a decimal comma and without grouping', () => {
    expect(centsToDecimalComma(1250)).toBe('12,50')
    expect(centsToDecimalComma(5)).toBe('0,05')
    expect(centsToDecimalComma(160_000)).toBe('1600,00')
    expect(centsToDecimalComma(-1005)).toBe('-10,05')
  })
})

describe('csvCell', () => {
  it('quotes separators, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
  })

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(csvCell('+61 400 000 000')).toBe("'+61 400 000 000")
    expect(csvCell('-10% Rabatt')).toBe("'-10% Rabatt")
    expect(csvCell('@home')).toBe("'@home")
    expect(csvCell('=1;2')).toBe('"\'=1;2"')
  })
})

describe('expensesToCsv', () => {
  it('exports active expenses sorted by date, for German spreadsheets', () => {
    const csv = expensesToCsv(
      [
        makeExpense('2026-09-22', 1250, { note: 'Kaffee; Kuchen', tags: ['cafe', 'treat'] }),
        makeExpense('2026-09-21', 25_000, { categoryId: 'cat:rent', recurringId: 'rent' }),
        makeExpense('2026-09-23', 80_000, { categoryId: 'cat:gone', fundedByPotId: 'pot:trip' }),
        makeExpense('2026-09-20', 999, { deletedAt: NOW }),
      ],
      [
        makeCategory('cat:groceries', { name: 'Lebensmittel' }),
        makeCategory('cat:rent', { name: 'Miete', group: 'Fixkosten' }),
      ],
      [makePot('pot:trip', { name: 'Reisen' })],
    )

    expect(csv.startsWith(String.fromCharCode(0xfeff))).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Datum;Betrag (AUD);Kategorie;Gruppe;Tags;Notiz;Aus Topf;Wiederkehrend',
      '2026-09-21;250,00;Miete;Fixkosten;;;;ja',
      '2026-09-22;12,50;Lebensmittel;Variabel;cafe, treat;"Kaffee; Kuchen";;nein',
      '2026-09-23;800,00;cat:gone;;;;Reisen;nein',
      '',
    ])
  })
})
