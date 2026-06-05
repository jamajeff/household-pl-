import { describe, it, expect } from 'vitest'
import { monthsToClearDebt, addMonthsToYearMonth, formatHeadline, computeMetrics } from './calculations'
import type { MonthRecord, Debt } from '../types'

describe('monthsToClearDebt', () => {
  it('returns exact months when balance is divisible by paid', () => {
    expect(monthsToClearDebt(1_000_000, 50_000)).toBe(20) // $10,000 / $500
  })

  it('rounds up partial months', () => {
    expect(monthsToClearDebt(1_000_001, 50_000)).toBe(21)
  })

  it('returns null when paid is zero', () => {
    expect(monthsToClearDebt(1_000_000, 0)).toBeNull()
  })

  it('returns null when paid is negative (balance went up)', () => {
    expect(monthsToClearDebt(1_000_000, -1_000)).toBeNull()
  })

  it('returns 0 when balance is already zero', () => {
    expect(monthsToClearDebt(0, 50_000)).toBe(0)
  })
})

describe('addMonthsToYearMonth', () => {
  it('returns same month for offset 0', () => {
    expect(addMonthsToYearMonth('2026-06', 0)).toBe('2026-06')
  })

  it('advances within the same year', () => {
    expect(addMonthsToYearMonth('2026-06', 3)).toBe('2026-09')
  })

  it('crosses year boundary', () => {
    expect(addMonthsToYearMonth('2026-12', 1)).toBe('2027-01')
  })

  it('handles large offsets', () => {
    expect(addMonthsToYearMonth('2026-06', 24)).toBe('2028-06')
  })

  it('handles non-multiple-of-12 large offsets', () => {
    expect(addMonthsToYearMonth('2026-06', 7)).toBe('2027-01')
  })
})

describe('formatHeadline', () => {
  const fmt = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(0)}`

  it('omits delta clause when no prior month', () => {
    expect(formatHeadline(470_000, null, fmt))
      .toBe('Net cash flow was $4700.')
  })

  it('shows "up" when delta is positive', () => {
    expect(formatHeadline(470_000, 150_000, fmt))
      .toBe('Net cash flow was $4700 (up $1500 vs last month).')
  })

  it('shows "down" when delta is negative', () => {
    expect(formatHeadline(320_000, -150_000, fmt))
      .toBe('Net cash flow was $3200 (down $1500 vs last month).')
  })

  it('omits delta clause when delta is exactly zero', () => {
    expect(formatHeadline(470_000, 0, fmt))
      .toBe('Net cash flow was $4700.')
  })

  it('formats negative net cash flow', () => {
    const fmtNeg = (cents: number) => cents < 0 ? `-$${(Math.abs(cents) / 100).toFixed(0)}` : `$${(cents / 100).toFixed(0)}`
    expect(formatHeadline(-200_000, null, fmtNeg))
      .toBe('Net cash flow was -$2000.')
  })
})

function baseRecord(over: Partial<MonthRecord> = {}): MonthRecord {
  return {
    yearMonth: '2026-03',
    income: [
      { id: 'i1', label: 'Salary', amount: 1000000, person: 'person1', subcategory: 'active' },
    ],
    expenses: [
      { id: 'e1', label: 'Rent', amount: 200000, person: 'shared', subcategory: 'fixed_bill' },
      { id: 'e2', label: 'Groceries', amount: 50000, person: 'shared', subcategory: 'variable' },
    ],
    debtSnapshots: [
      { debtId: 'card1', balance: 800000, minPayment: 25000 },
      { debtId: 'loan1', balance: 2500000, minPayment: 66500 },
    ],
    rolling: { amount: 800000, paidThisMonth: 800000, targetDebtId: 'card1' },
    review: { targetDebtSnapshot: null, totalDebtSnapshot: null, snapshotTakenAt: null, oneStepIncomeTier: '', oneWin: '', oneToWatch: '', oneDecisionNext: '' },
    updatedAt: 'x',
    ...over,
  }
}

const DEBTS: Debt[] = [
  { id: 'card1', label: 'Chase', balance: 800000, category: 'credit_card', kind: 'credit_card', apr: 22.99, minPayment: 25000, autopay: true, updatedAt: 'x' },
  { id: 'loan1', label: 'Sofi', balance: 2500000, category: 'student', kind: 'loan', apr: 6.5, minPayment: 66500, autopay: true, loanType: 'student', updatedAt: 'x' },
]

describe('computeMetrics tiers', () => {
  it('splits minimums into 3a (loan) and 3b (card) and totals committed', () => {
    const m = computeMetrics(baseRecord(), DEBTS)
    expect(m.tier2Total).toBe(200000)
    expect(m.tier7Total).toBe(50000)
    expect(m.tier3bTotal).toBe(25000)
    expect(m.tier3aTotal).toBe(66500)
    expect(m.tier4Rolling).toBe(800000)
    expect(m.totalCommitted).toBe(200000 + 66500 + 25000 + 800000)
    expect(m.remainingForLowerTiers).toBe(1000000 - m.totalCommitted)
  })

  it('totalExpenses includes bills, minimums, rolling paid, and variable', () => {
    const m = computeMetrics(baseRecord(), DEBTS)
    expect(m.totalExpenses).toBe(200000 + 66500 + 25000 + 800000 + 50000)
    expect(m.netCashFlow).toBe(1000000 - m.totalExpenses)
  })

  it('uses rolling.amount for commitment but paidThisMonth for actual expense', () => {
    // amount (committed) and paidThisMonth (actual) deliberately differ
    const m = computeMetrics(baseRecord({ rolling: { amount: 900000, paidThisMonth: 800000, targetDebtId: 'card1' } }), DEBTS)
    expect(m.tier4Rolling).toBe(800000)                                   // actual paid
    expect(m.totalCommitted).toBe(200000 + 66500 + 25000 + 900000)        // committed uses amount
    expect(m.totalExpenses).toBe(200000 + 66500 + 25000 + 800000 + 50000) // expense uses paidThisMonth
  })

  it('without a debts registry, all snapshot minimums fall to the loan bucket (3a)', () => {
    const m = computeMetrics(baseRecord()) // default debts = []
    expect(m.tier3bTotal).toBe(0)
    expect(m.tier3aTotal).toBe(66500 + 25000) // both snapshots routed to loan bucket
  })
})
