import { describe, it, expect } from 'vitest'
import { buildCoworkDataBlock, type CoworkBlockInput } from './coworkBlock'

// Example values live in the test only — the production code hardcodes none.
const base: CoworkBlockInput = {
  symbol: '$',
  monthLabel: 'June 2026',
  revenue: 2172300,
  revenueDelta: -252300,
  expenses: 2255400,
  expensesDelta: 378000,
  netCashFlow: -83100,
  netCashFlowDelta: -630400,
  burnRate: 103.8,
  burnRateDeltaPp: 26.4,
  totalDebt: 68190300,
  totalDebtDelta: null,
  target: { name: 'Saphire', balance: 800000, paid: 0 },
  activeIncome: 2172300,
  semiActiveIncome: 0,
  passiveIncome: 0,
  totalRevenue: 2172300,
  expenseMovers: [
    { label: 'Groceries', delta: 20000 },
    { label: 'Dining', delta: -8000 },
    { label: 'Gas', delta: 6000 },
    { label: 'Coffee', delta: 1000 }, // below $50 threshold — filtered
  ],
}

describe('buildCoworkDataBlock', () => {
  it('produces the exact template with substituted values', () => {
    const expected = [
      "Generate this month's Monthly Review from the dashboard data below.",
      'Follow monthly-review-autodraft.md (standard format, standard rules).',
      '',
      'Month: June 2026',
      'Revenue: $21,723 (Δ -$2,523)',
      'Expenses: $22,554 (Δ +$3,780)',
      'Net cash flow: -$831 (Δ -$6,304)',
      'True burn rate: 103.8% (Δ +26.4 pp)',
      'Total debt: $681,903 (Δ flat)',
      '#1 target: Saphire; balance $8,000; paid $0',
      'Active income: $21,723 (100.0%)',
      'Semi-active: $0 (0.0%)',
      'Passive: $0 (0.0%)',
      'Largest movers: Groceries +$200, Dining -$80, Gas +$60',
    ].join('\n')
    expect(buildCoworkDataBlock(base)).toBe(expected)
  })

  it('caps movers at three, sorted by absolute delta', () => {
    const out = buildCoworkDataBlock({
      ...base,
      expenseMovers: [
        { label: 'Small', delta: 6000 },
        { label: 'Biggest', delta: -90000 },
        { label: 'Mid', delta: 30000 },
        { label: 'Big', delta: 50000 },
      ],
    })
    expect(out).toContain('Largest movers: Biggest -$900, Big +$500, Mid +$300')
  })

  it('shows "(none significant)" when every mover is under $50', () => {
    const out = buildCoworkDataBlock({
      ...base,
      expenseMovers: [
        { label: 'A', delta: 4999 },
        { label: 'B', delta: -100 },
      ],
    })
    expect(out).toContain('Largest movers: (none significant)')
  })

  it('formats deltas: positive +, negative -, zero/null flat; burn rate in pp', () => {
    const out = buildCoworkDataBlock({
      ...base,
      revenueDelta: 5000,
      expensesDelta: 0,
      netCashFlowDelta: null,
      burnRateDeltaPp: -3.2,
    })
    expect(out).toContain('Revenue: $21,723 (Δ +$50)')
    expect(out).toContain('Expenses: $22,554 (Δ flat)')
    expect(out).toContain('Net cash flow: -$831 (Δ flat)')
    expect(out).toContain('True burn rate: 103.8% (Δ -3.2 pp)')
  })

  it('handles no target and zero revenue percentages', () => {
    const out = buildCoworkDataBlock({
      ...base,
      target: null,
      revenue: 0,
      totalRevenue: 0,
      activeIncome: 0,
    })
    expect(out).toContain('#1 target: none set')
    expect(out).toContain('Active income: $0 (0.0%)')
  })
})
