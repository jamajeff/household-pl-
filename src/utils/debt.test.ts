import { describe, it, expect } from 'vitest'
import { debtGroup, buildDebtQueue, utilizationPct } from './debt'
import type { Debt, DebtGroup } from '../types'

function card(id: string, apr: number, balance: number, creditLimit?: number): Debt {
  return { id, label: id, balance, category: 'credit_card', kind: 'credit_card', apr, minPayment: 0, autopay: true, creditLimit, updatedAt: 'x' }
}
function loan(id: string, apr: number, balance: number, loanType: Debt['loanType']): Debt {
  return { id, label: id, balance, category: 'other', kind: 'loan', apr, minPayment: 0, autopay: true, loanType, updatedAt: 'x' }
}

const GROUPING: DebtGroup[] = ['credit_card', 'cash', 'student', 'auto', 'mortgage', 'other']

describe('debtGroup', () => {
  it('cards are credit_card; loans use loanType', () => {
    expect(debtGroup(card('a', 20, 1000))).toBe('credit_card')
    expect(debtGroup(loan('b', 7, 1000, 'cash'))).toBe('cash')
    expect(debtGroup(loan('c', 7, 1000, undefined))).toBe('other')
  })
})

describe('buildDebtQueue', () => {
  it('orders by group then APR desc; ranks from 1', () => {
    const amex = card('Amex', 24.99, 4800000)
    const chase = card('Chase', 22.99, 800000)
    const sofiCash = loan('SofiCash', 7.2, 5800000, 'cash')
    const studentHighApr = loan('Student', 26.0, 1000000, 'student')
    const queue = buildDebtQueue([studentHighApr, chase, sofiCash, amex], GROUPING, 800000)
    expect(queue.map((q) => q.debt.label)).toEqual(['Amex', 'Chase', 'SofiCash', 'Student'])
    expect(queue[0].rank).toBe(1)
    expect(queue[0].group).toBe('credit_card')
  })

  it('computes months to clear at rolling amount (ceil)', () => {
    const amex = card('Amex', 24.99, 4800000)
    const [entry] = buildDebtQueue([amex], GROUPING, 800000)
    expect(entry.monthsToClear).toBe(6)
  })
})

describe('utilizationPct', () => {
  it('returns balance/limit percent, or null without a limit', () => {
    expect(utilizationPct(800000, 2500000)).toBeCloseTo(32, 1)
    expect(utilizationPct(800000, undefined)).toBeNull()
    expect(utilizationPct(800000, 0)).toBeNull()
  })
})
