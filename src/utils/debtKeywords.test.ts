import { describe, it, expect } from 'vitest'
import { looksLikeDebt, classifyDebtKind } from './debtKeywords'

describe('looksLikeDebt', () => {
  it('flags debt-like labels', () => {
    for (const l of ['Sofi 30k Loan', 'Chase Sapphire', 'Amex', 'Discover it', 'Sallie Mae', 'Dept of ED', 'Visa']) {
      expect(looksLikeDebt(l)).toBe(true)
    }
  })
  it('passes non-debt labels', () => {
    for (const l of ['Apartment', 'ChatGPT', 'Car Insurance', 'Groceries', 'VA Disability']) {
      expect(looksLikeDebt(l)).toBe(false)
    }
  })
})

describe('classifyDebtKind', () => {
  it('routes cards vs loans', () => {
    expect(classifyDebtKind('Chase Sapphire')).toBe('credit_card')
    expect(classifyDebtKind('Amex')).toBe('credit_card')
    expect(classifyDebtKind('Sofi 30k Loan')).toBe('loan')
    expect(classifyDebtKind('Dept of ED')).toBe('loan')
    expect(classifyDebtKind('Apartment')).toBeNull()
  })
})
