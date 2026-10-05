import { describe, expect, it } from 'vitest'
import sample from './__fixtures__/commbank-sample.csv?raw'
import {
  BANK_FORMATS,
  bankTxId,
  detectBankFormat,
  hashText,
  parseBankAmount,
  parseBankDate,
  parseBankFile,
  parseCsv,
  type BankFormat,
  type ParsedBankRow,
} from './bankImport'

const BOM = String.fromCharCode(0xfeff)

const rowsOf = (text: string): ParsedBankRow[] => {
  const result = parseBankFile(text)
  if (!result.ok) throw new Error(`not readable: ${result.reason}`)
  return result.rows
}

describe('parseCsv', () => {
  it('splits plain and quoted cells', () => {
    expect(parseCsv('a,b,c\n1,"2",3').map((record) => record.cells)).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('keeps commas, doubled quotes and line breaks inside quotes', () => {
    const records = parseCsv('1,"Smith, J","say ""hi""","two\nlines"\n2,x,y,z')
    expect(records).toEqual([
      { line: 1, cells: ['1', 'Smith, J', 'say "hi"', 'two\nlines'] },
      { line: 3, cells: ['2', 'x', 'y', 'z'] },
    ])
  })

  it('handles CRLF, a BOM, blank lines and a missing final line break', () => {
    const records = parseCsv(`${BOM}a,b\r\n\r\n  \r\nc,d`)
    expect(records).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 4, cells: ['c', 'd'] },
    ])
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('a,b\r\n')).toHaveLength(1)
  })

  it('keeps empty cells and supports another delimiter', () => {
    expect(parseCsv('a,,c,')[0]!.cells).toEqual(['a', '', 'c', ''])
    expect(parseCsv('a;b,c', ';')[0]!.cells).toEqual(['a', 'b,c'])
  })

  it('reads an unterminated quote to the end instead of failing', () => {
    expect(parseCsv('a,"open\nstill open')[0]!.cells).toEqual(['a', 'open\nstill open'])
  })
})

describe('parseBankDate', () => {
  it('reads day-first dates', () => {
    expect(parseBankDate('05/10/2026')).toBe('2026-10-05')
    expect(parseBankDate(' 1/2/2026 ')).toBe('2026-02-01')
    expect(parseBankDate('31/12/2026')).toBe('2026-12-31')
  })

  it('rejects days that do not exist and other shapes', () => {
    for (const raw of ['30/02/2026', '12/13/2026', '2026-10-05', '05/10/26', '', 'heute']) {
      expect(parseBankDate(raw)).toBeNull()
    }
  })
})

describe('parseBankAmount', () => {
  it('reads signed amounts as cents', () => {
    expect(parseBankAmount('-7.50')).toBe(-750)
    expect(parseBankAmount('+1763.94')).toBe(176_394)
    expect(parseBankAmount('1,763.94')).toBe(176_394)
    expect(parseBankAmount('-1,234,567.8')).toBe(-123_456_780)
    expect(parseBankAmount('12')).toBe(1_200)
    expect(parseBankAmount(' -0.05 ')).toBe(-5)
    expect(parseBankAmount('19.99')).toBe(1_999) // 19.99 * 100 is 1998.9999… as a float
    expect(Object.is(parseBankAmount('-0.00'), 0)).toBe(true)
  })

  it('rejects everything that is not an English decimal number', () => {
    for (const raw of ['', '-', '7,50', '1.234,56', '12.345', '1,23', '$5.00', '5.00 CR', '1e3']) {
      expect(parseBankAmount(raw)).toBeNull()
    }
    expect(parseBankAmount('99999999999999999999')).toBeNull()
  })
})

describe('hashText / bankTxId', () => {
  it('is deterministic and tells texts apart', () => {
    expect(hashText('abc')).toBe(hashText('abc'))
    expect(hashText('abc')).not.toBe(hashText('abd'))
    expect(hashText('')).toMatch(/^[0-9a-z]+$/)
  })

  it('depends on date, amount, text and the occurrence – not on case or spacing', () => {
    const row = { date: '2026-09-18', amountCents: -3_764, description: 'WOOLWORTHS 1234 MIDLAND' }
    const id = bankTxId(row, 0)
    expect(id).toMatch(/^bank:[0-9a-z]+:0$/)
    expect(bankTxId({ ...row, description: ' woolworths  1234 Midland ' }, 0)).toBe(id)
    expect(bankTxId(row, 1)).not.toBe(id)
    expect(bankTxId({ ...row, date: '2026-09-19' }, 0)).not.toBe(id)
    expect(bankTxId({ ...row, amountCents: 3_764 }, 0)).not.toBe(id)
    expect(bankTxId({ ...row, description: 'WOOLWORTHS 5678 MIDLAND' }, 0)).not.toBe(id)
  })
})

describe('parseBankFile – CommBank', () => {
  it('reads the sample export completely', () => {
    const result = parseBankFile(sample)
    expect(result).toMatchObject({ ok: true, format: 'commbank', errors: [] })
    const rows = rowsOf(sample)
    expect(rows).toHaveLength(19)

    // newest first, as in the file
    expect(rows[0]).toEqual({
      id: expect.stringMatching(/^bank:[0-9a-z]+:0$/),
      line: 1,
      date: '2026-09-20',
      valueDate: null,
      amountCents: -925,
      description: '4321-EXPRESS FUEL STOP PERTH AU',
      balanceCents: 231_893,
    })
    // a card purchase carries the day of the purchase
    expect(rows[2]).toMatchObject({
      date: '2026-09-18',
      valueDate: '2026-09-16',
      amountCents: -3_764,
      description: 'WOOLWORTHS 1234 MIDLAND WA AUS Card xx1234 Value Date: 16/09/2026',
    })
    // credits keep their sign
    const credits = rows.filter((row) => row.amountCents > 0)
    expect(credits.map((row) => row.amountCents)).toEqual([143_260, 104_000])
  })

  it('agrees with the running balance of the file (nothing misread)', () => {
    const rows = rowsOf(sample)
    for (let index = 0; index < rows.length - 1; index++) {
      expect(rows[index]!.balanceCents).toBe(
        rows[index + 1]!.balanceCents! + rows[index]!.amountCents,
      )
    }
  })

  it('gives the same ids when the same file is read again', () => {
    expect(rowsOf(sample).map((row) => row.id)).toEqual(rowsOf(sample).map((row) => row.id))
    expect(rowsOf(sample.replaceAll('\r\n', '\n')).map((row) => row.id)).toEqual(
      rowsOf(sample).map((row) => row.id),
    )
  })

  it('keeps two identical lines apart', () => {
    const rows = rowsOf(sample)
    const vending = rows.filter((row) => row.description.startsWith('QUICK VENDING'))
    expect(vending).toHaveLength(2)
    expect(vending[0]!.id).toMatch(/:0$/)
    expect(vending[1]!.id).toBe(vending[0]!.id.replace(/:0$/, ':1'))
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
  })

  it('gives overlapping exports the same ids for the days they share', () => {
    const lines = sample.trim().split('\r\n')
    // whole days only, as the bank exports them: 15.–20. Sep. and 08.–15. Sep.
    const newer = lines.filter((line) => line.slice(0, 2) >= '15').join('\r\n')
    const older = lines.filter((line) => line.slice(0, 2) <= '15').join('\r\n')
    const all = new Set(rowsOf(sample).map((row) => row.id))
    const newerIds = rowsOf(newer).map((row) => row.id)
    const olderIds = rowsOf(older).map((row) => row.id)

    expect(new Set([...newerIds, ...olderIds])).toEqual(all)
    const shared = newerIds.filter((id) => olderIds.includes(id))
    expect(shared).toHaveLength(3) // 15 Sep.: one supermarket line and the two identical ones
  })

  it('reports unreadable lines and keeps the rest', () => {
    const text = [
      '20/09/2026,"-9.25","SHOP A","+10.00"',
      '32/09/2026,"-1.00","BAD DATE","+9.00"',
      '19/09/2026,"abc","BAD AMOUNT","+9.00"',
      '19/09/2026,"0.00","ZERO","+9.00"',
      '19/09/2026,"-1.00"',
      '18/09/2026,"-2.00","NO BALANCE"',
      '18/09/2026,"-3.00","ODD BALANCE","n/a"',
    ].join('\n')
    const result = parseBankFile(text)
    expect(result).toMatchObject({
      ok: true,
      errors: [
        { line: 2, reason: 'date' },
        { line: 3, reason: 'amount' },
        { line: 4, reason: 'amount' },
        { line: 5, reason: 'columns' },
      ],
    })
    expect(rowsOf(text).map((row) => [row.description, row.balanceCents])).toEqual([
      ['SHOP A', 1_000],
      ['NO BALANCE', null],
      ['ODD BALANCE', null],
    ])
  })

  it('rejects empty files and files in another layout as a whole', () => {
    expect(parseBankFile('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseBankFile(' \r\n\r\n')).toEqual({ ok: false, reason: 'empty' })
    expect(parseBankFile('Datum;Betrag;Text\n2026-09-20;-9,25;Shop')).toEqual({
      ok: false,
      reason: 'unknown-format',
    })
    expect(parseBankFile('{"app":"finance-planner"}')).toEqual({
      ok: false,
      reason: 'unknown-format',
    })
  })

  it('still recognises the layout when the first line is broken', () => {
    const result = parseBankFile('garbage\n20/09/2026,"-9.25","SHOP A","+10.00"')
    expect(result).toMatchObject({ ok: true, errors: [{ line: 1, reason: 'columns' }] })
  })
})

describe('bank formats', () => {
  it('can be extended by another bank (header line, other column order, no balance)', () => {
    const other: BankFormat = {
      id: 'commbank',
      label: 'Other Bank',
      hasHeader: true,
      columns: { date: 2, amount: 0, description: 1, balance: null },
      valueDate: () => null,
    }
    const text = 'Amount,Details,Date\n-4.20,COFFEE,20/09/2026\n+10.00,REFUND,19/09/2026'
    expect(detectBankFormat(parseCsv(text), [other])).toBe(other)
    const result = parseBankFile(text, [other])
    expect(result.ok && result.rows).toMatchObject([
      { line: 2, date: '2026-09-20', amountCents: -420, description: 'COFFEE', balanceCents: null },
      { line: 3, date: '2026-09-19', amountCents: 1_000, description: 'REFUND' },
    ])
    // the header alone is not a file
    expect(detectBankFormat(parseCsv('Amount,Details,Date'), [other])).toBeNull()
  })

  it('knows CommBank', () => {
    expect(BANK_FORMATS.map((format) => format.id)).toEqual(['commbank'])
    const [commbank] = BANK_FORMATS
    expect(commbank!.valueDate('SHOP Card xx1 Value Date: 30/02/2026')).toBeNull()
    expect(commbank!.valueDate('SHOP PERTH AU')).toBeNull()
  })
})
