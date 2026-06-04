import { describe, it, expect } from 'vitest'
import { monthsToClearDebt } from './calculations'

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
