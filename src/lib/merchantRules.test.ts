import { describe, expect, it } from 'vitest'
import { makeBankTx, makeCategory, makeExpense, makeRule, NOW } from '@/test/fixtures'
import {
  autoAssignable,
  categoryUsage,
  displayMerchant,
  displayPattern,
  incomeSuggestion,
  isIncomeCredit,
  learnRule,
  matchRule,
  merchantRuleId,
  normalizeMerchant,
  suggestCategories,
} from './merchantRules'

describe('normalizeMerchant', () => {
  // The shapes of a real CommBank export (merchants invented, structure kept).
  it.each([
    ['WOOLWORTHS 1234 PERTH', 'woolworths'],
    ['WOOLWORTHS 4611 KARRATHA WA AUS Card xx1234 Value Date: 28/09/2026', 'woolworths'],
    ['WOOLWORTHS 4610 CARNARVON WA AUS Card xx1234 Value Date: 24/09/2026', 'woolworths'],
    ['COLES 0313 KARRATHA AU', 'coles'],
    ['KMART 1119 KARRATHA AU', 'kmart'],
    ['KMART 1287 GERALDTON WA AUS Card xx1234 Value Date: 22/09/2026', 'kmart'],
    ['6943-REDDY EXPRESS KARR BULGARRA AU', 'reddy express karr'],
    ['SMP*Nicks Place Karratha06 AU', 'nicks place'],
    ['SQ *CORNER CAFE PERTH AU', 'corner cafe perth'],
    ['Subway Nickol 2 Cockatoo StAU', 'subway nickol'],
    ['THE GOOD GROCER KARR NICKOL WA AUS Card xx1234 Value Date: 01/10/2026', 'the good grocer'],
    ['Tambrey Tavern Nickol AU', 'tambrey tavern nickol'],
    ['CIRCUM VENDING MENTONE VI AUS Card xx1234 Value Date: 30/09/2026', 'circum vending mentone'],
    ['APPLE.COM/BILL SYDNEY NS AUS Card xx1234 Value Date: 24/09/2026', 'apple.com/bill sydney'],
    [
      'BOOST PREPAID RECHARGE MELBOURNE AUS Card xx1234 Value Date: 29/09/2026',
      'boost prepaid recharge',
    ],
    ['HOSTEL G PERTH AUS Card xx1234 Value Date: 21/09/2026', 'hostel g perth'],
    ['Direct Debit 342190 FITCLUBPERTH 807100949', 'fitclubperth'],
    ['Direct Debit 342190 CITY GYM PTY LTD 805510490', 'city gym pty'],
    ['Fast Transfer From ACME FARMS PTY LTD CREDIT TO ACCOUNT PAYMENT WAGES', 'acme farms pty'],
    ['Fast Transfer From Alex Example CREDIT TO ACCOUNT', 'alex example'],
    ['Transfer To Savings Account', 'savings account'],
    ['7ELEVEN 1234 PERTH AU', '7eleven'],
    ['  kmart   1119  ', 'kmart'],
    ['AU', 'au'],
    ['', ''],
  ])('%s → %s', (description, pattern) => {
    expect(normalizeMerchant(description)).toBe(pattern)
  })

  it('gives every branch of a chain the same pattern', () => {
    const branches = [
      'WOOLWORTHS 4611 KARRATHA WA AUS Card xx1234 Value Date: 28/09/2026',
      'WOOLWORTHS 4437 BULLSBROOK WA AUS Card xx9999 Value Date: 22/09/2026',
      'woolworths 1 sydney',
    ]
    expect(new Set(branches.map(normalizeMerchant))).toEqual(new Set(['woolworths']))
  })
})

describe('displayMerchant', () => {
  it('writes the merchant the way people do', () => {
    expect(displayMerchant('WOOLWORTHS 1234 PERTH WA AUS Card xx1234 Value Date: 16/09/2026')).toBe(
      'Woolworths',
    )
    expect(displayMerchant('THE GOOD GROCER KARR NICKOL WA AUS')).toBe('The Good Grocer')
    expect(displayMerchant('APPLE.COM/BILL SYDNEY NS AUS')).toBe('Apple.Com/Bill Sydney')
    expect(displayMerchant('   ')).toBe('')
    expect(displayPattern('the good grocer')).toBe('The Good Grocer')
  })
})

describe('matchRule', () => {
  const rules = [
    makeRule('woolworths'),
    makeRule('woolworths metro', { categoryId: 'cat:dining' }),
    makeRule('the good', { categoryId: 'cat:dining' }),
    makeRule('kmart', { deletedAt: NOW }),
  ]

  it('finds the exact pattern first, then the longest opening words', () => {
    expect(matchRule('WOOLWORTHS 1234 PERTH AU', rules)?.pattern).toBe('woolworths')
    expect(matchRule('Woolworths Metro 12 Sydney AU', rules)?.pattern).toBe('woolworths metro')
    expect(matchRule('Woolworths Metro Express Sydney AU', rules)?.pattern).toBe('woolworths metro')
    expect(matchRule('THE GOOD GROCER KARR NICKOL WA AUS', rules)?.pattern).toBe('the good')
  })

  it('matches whole words only and ignores deleted rules', () => {
    expect(matchRule('WOOLWORTHSX 1234 PERTH AU', rules)).toBeNull()
    expect(matchRule('KMART 1119 KARRATHA AU', rules)).toBeNull()
    expect(matchRule('', rules)).toBeNull()
  })
})

describe('learnRule', () => {
  const groceries = { action: 'categorize', categoryId: 'cat:groceries' } as const

  it('creates a rule on the first assignment', () => {
    expect(learnRule(undefined, 'woolworths', groceries, 5)).toEqual({
      id: 'rule:woolworths',
      pattern: 'woolworths',
      action: 'categorize',
      categoryId: 'cat:groceries',
      confirmations: 1,
      lastUsedAt: 5,
      createdAt: 5,
      updatedAt: 5,
      deletedAt: null,
    })
    expect(merchantRuleId('woolworths')).toBe('rule:woolworths')
  })

  it('counts the same target as a confirmation', () => {
    const first = learnRule(undefined, 'woolworths', groceries, 5)
    expect(learnRule(first, 'woolworths', groceries, 9)).toMatchObject({
      confirmations: 2,
      lastUsedAt: 9,
      createdAt: 5,
      updatedAt: 9,
    })
  })

  it('starts over when the target changes or the rule had been deleted', () => {
    const confirmed = makeRule('woolworths', { confirmations: 4 })
    expect(
      learnRule(confirmed, 'woolworths', { action: 'categorize', categoryId: 'cat:dining' }, 9),
    ).toMatchObject({ categoryId: 'cat:dining', confirmations: 1 })
    expect(
      learnRule(confirmed, 'woolworths', { action: 'ignore', categoryId: null }, 9),
    ).toMatchObject({ action: 'ignore', categoryId: null, confirmations: 1 })
    expect(learnRule({ ...confirmed, deletedAt: NOW }, 'woolworths', groceries, 9)).toMatchObject({
      confirmations: 1,
      deletedAt: null,
    })
  })

  it('never keeps a category on a rule that does not categorize', () => {
    expect(
      learnRule(undefined, 'acme', { action: 'income', categoryId: 'cat:groceries' }, 1).categoryId,
    ).toBeNull()
  })
})

describe('categoryUsage', () => {
  it('orders categories by use, ties by id, tombstones aside', () => {
    const expenses = [
      makeExpense('2026-09-15', 1, { categoryId: 'cat:b' }),
      makeExpense('2026-09-15', 1, { categoryId: 'cat:a' }),
      makeExpense('2026-09-15', 1, { categoryId: 'cat:c' }),
      makeExpense('2026-09-15', 1, { categoryId: 'cat:c' }),
      makeExpense('2026-09-15', 1, { categoryId: 'cat:z', deletedAt: NOW }),
    ]
    expect(categoryUsage(expenses)).toEqual(['cat:c', 'cat:a', 'cat:b'])
  })
})

describe('suggestCategories', () => {
  const categories = ['cat:rent', 'cat:groceries', 'cat:dining', 'cat:transport'].map((id) =>
    makeCategory(id),
  )
  const ids = (description: string, rules = [makeRule('woolworths')], usage = ['cat:dining']) =>
    suggestCategories({ description, rules, usage, categories }).map((category) => category.id)

  it('puts the merchant’s category first, then the most used, then the rest', () => {
    expect(ids('WOOLWORTHS 1234 PERTH AU')).toEqual([
      'cat:groceries',
      'cat:dining',
      'cat:rent',
      'cat:transport',
    ])
  })

  it('falls back to usage and display order for unknown merchants', () => {
    expect(ids('Seaside Tavern Fremantle AU')).toEqual([
      'cat:dining',
      'cat:rent',
      'cat:groceries',
      'cat:transport',
    ])
    expect(ids('Seaside Tavern Fremantle AU', [], [])).toEqual([
      'cat:rent',
      'cat:groceries',
      'cat:dining',
      'cat:transport',
    ])
  })

  it('skips categories that cannot be chosen and rules that do not categorize', () => {
    expect(
      ids(
        'WOOLWORTHS 1 PERTH',
        [makeRule('woolworths', { categoryId: 'cat:archived' })],
        ['cat:gone'],
      ),
    ).toEqual(['cat:rent', 'cat:groceries', 'cat:dining', 'cat:transport'])
    expect(
      ids(
        'WOOLWORTHS 1 PERTH',
        [makeRule('woolworths', { action: 'ignore', categoryId: null })],
        [],
      ),
    ).toEqual(['cat:rent', 'cat:groceries', 'cat:dining', 'cat:transport'])
  })
})

describe('autoAssignable', () => {
  const categories = [makeCategory('cat:groceries')]
  const woolworths = makeBankTx('2026-09-18', -3_764)

  it('offers lines of merchants that were confirmed at least twice', () => {
    const once = makeRule('woolworths', { confirmations: 1 })
    const twice = makeRule('woolworths', { confirmations: 2 })
    expect(autoAssignable([woolworths], [once], categories)).toEqual([])
    expect(autoAssignable([woolworths], [twice], categories)).toEqual([
      { tx: woolworths, rule: twice },
    ])
  })

  it('also sorts out known non-expenses, but never touches income rules', () => {
    const transfer = makeBankTx('2026-09-18', -50_000, {
      description: 'Transfer To Savings Account',
    })
    const ignore = makeRule('savings account', {
      action: 'ignore',
      categoryId: null,
      confirmations: 2,
    })
    const income = makeRule('woolworths', { action: 'income', categoryId: null, confirmations: 5 })
    expect(autoAssignable([transfer, woolworths], [ignore, income], categories)).toEqual([
      { tx: transfer, rule: ignore },
    ])
  })

  it('leaves out what is not in the inbox and rules whose category is gone', () => {
    const rule = makeRule('woolworths', { confirmations: 3 })
    const done = makeBankTx('2026-09-18', -3_764, { status: 'ignored' })
    const credit = makeBankTx('2026-09-18', 3_764)
    expect(autoAssignable([done, credit], [rule], categories)).toEqual([])
    expect(autoAssignable([woolworths], [rule], [])).toEqual([])
    expect(autoAssignable([woolworths], [{ ...rule, categoryId: null }], categories)).toEqual([])
  })
})

describe('incomeSuggestion', () => {
  const wage = 'Fast Transfer From ACME FARMS PTY LTD CREDIT TO ACCOUNT PAYMENT WAGES'
  const own = 'Fast Transfer From Alex Example CREDIT TO ACCOUNT'
  const rules = [makeRule('acme farms pty', { action: 'income', categoryId: null })]

  it('knows the credits of a marked employer', () => {
    expect(isIncomeCredit(makeBankTx('2026-09-17', 143_260, { description: wage }), rules)).toBe(
      true,
    )
    expect(isIncomeCredit(makeBankTx('2026-09-17', 143_260, { description: own }), rules)).toBe(
      false,
    )
    expect(isIncomeCredit(makeBankTx('2026-09-17', -143_260, { description: wage }), rules)).toBe(
      false,
    )
    expect(isIncomeCredit(makeBankTx('2026-09-17', 143_260, { description: wage }), [])).toBe(false)
    expect(
      isIncomeCredit(makeBankTx('2026-09-17', 1, { description: wage, deletedAt: NOW }), rules),
    ).toBe(false)
  })

  it('suggests what was paid from Monday to Sunday of the week', () => {
    const inWeek = makeBankTx('2026-09-17', 143_260, { id: 'b', description: wage })
    const lines = [
      inWeek,
      makeBankTx('2026-09-13', 100_000, { description: wage }), // Sunday before
      makeBankTx('2026-09-21', 100_000, { description: wage }), // Monday after
      makeBankTx('2026-09-16', 50_000, { description: own }),
      makeBankTx('2026-09-18', -3_764),
    ]
    expect(incomeSuggestion(lines, rules, '2026-09-14')).toEqual({
      totalCents: 143_260,
      credits: [inWeek],
    })
  })

  it('adds up several payments, newest first', () => {
    const monday = makeBankTx('2026-09-14', 60_000, { id: 'm', description: wage })
    const sunday = makeBankTx('2026-09-20', 80_000, { id: 's', description: wage })
    expect(incomeSuggestion([monday, sunday], rules, '2026-09-14')).toEqual({
      totalCents: 140_000,
      credits: [sunday, monday],
    })
  })

  it('has nothing to say without a marked employer or without a payment in the week', () => {
    const line = makeBankTx('2026-09-17', 143_260, { description: wage })
    expect(incomeSuggestion([line], [], '2026-09-14')).toBeNull()
    expect(incomeSuggestion([line], rules, '2026-09-21')).toBeNull()
    expect(incomeSuggestion([], rules, '2026-09-14')).toBeNull()
  })
})
