// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { getMonth, setMonth, getDebts, getSettings } from './storage'

beforeEach(() => {
  localStorage.clear()
})

describe('getMonth backfill', () => {
  it('backfills debtSnapshots and rolling on legacy records', () => {
    localStorage.setItem('pl:2026-01', JSON.stringify({
      yearMonth: '2026-01',
      income: [],
      expenses: [{ id: 'a', label: 'Rent', amount: 200000, person: 'shared', subcategory: 'fixed' }],
      updatedAt: '2026-01-31T00:00:00.000Z',
    }))
    const rec = getMonth('2026-01')!
    expect(rec.debtSnapshots).toEqual([])
    expect(rec.rolling).toEqual({ amount: 800000, paidThisMonth: 0, targetDebtId: null })
    expect(rec.expenses[0].subcategory).toBe('fixed')
  })

  it('round-trips a full new-shape record', () => {
    setMonth({
      yearMonth: '2026-02',
      income: [],
      expenses: [],
      debtSnapshots: [{ debtId: 'd1', balance: 100000, minPayment: 5000 }],
      rolling: { amount: 800000, paidThisMonth: 800000, targetDebtId: 'd1' },
      review: {
        targetDebtSnapshot: null, totalDebtSnapshot: null, snapshotTakenAt: null,
        oneStepIncomeTier: '', oneWin: '', oneToWatch: '', oneDecisionNext: '',
      },
      updatedAt: '2026-02-28T00:00:00.000Z',
    })
    const rec = getMonth('2026-02')!
    expect(rec.debtSnapshots[0]).toEqual({ debtId: 'd1', balance: 100000, minPayment: 5000 })
    expect(rec.rolling.targetDebtId).toBe('d1')
  })
})

describe('getDebts backfill', () => {
  it('backfills kind/apr/minPayment/autopay on legacy debts', () => {
    localStorage.setItem('pl:debts', JSON.stringify([
      { id: 'd1', label: 'Amex', balance: 4800000, category: 'credit_card', updatedAt: 'x' },
      { id: 'd2', label: 'Sofi 30k', balance: 2500000, category: 'student', updatedAt: 'x' },
    ]))
    const debts = getDebts()
    expect(debts[0]).toMatchObject({ kind: 'credit_card', apr: 0, minPayment: 0, autopay: false })
    expect(debts[1]).toMatchObject({ kind: 'loan', apr: 0, minPayment: 0, autopay: false, loanType: 'student' })
  })
})

describe('getSettings backfill', () => {
  it('provides new defaults', () => {
    const s = getSettings()
    expect(s.rollingAmount).toBe(800000)
    expect(s.burnRateOverrideMonths).toBe(2)
    expect(s.payoffMode).toBe('apr')
    expect(s.queueGrouping).toEqual(['credit_card', 'cash', 'student', 'auto', 'mortgage', 'other'])
  })
})
