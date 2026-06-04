import { describe, it, expect } from 'vitest'
import { monthsToClearDebt, addMonthsToYearMonth, formatHeadline } from './calculations'

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
