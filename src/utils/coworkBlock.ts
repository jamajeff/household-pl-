import { formatCurrency } from './formatting'

export interface CoworkMover {
  label: string
  delta: number // cents, current - prior
}

export interface CoworkBlockInput {
  symbol: string
  monthLabel: string
  revenue: number
  revenueDelta: number | null
  expenses: number
  expensesDelta: number | null
  netCashFlow: number
  netCashFlowDelta: number | null
  burnRate: number               // percent, e.g. 103.8
  burnRateDeltaPp: number | null // percentage points
  totalDebt: number
  totalDebtDelta: number | null  // cents, current - prior
  target: { name: string; balance: number; paid: number } | null
  activeIncome: number
  semiActiveIncome: number
  passiveIncome: number
  totalRevenue: number
  expenseMovers: CoworkMover[]   // current-month expense lines with their delta vs prior
}

const MOVER_THRESHOLD = 5000 // |Δ| < $50 is filtered out

/**
 * Build the clipboard text block for the "Copy data block for Cowork" button.
 * Pure formatter — all values are passed in; no fetching, no fixed example data.
 */
export function buildCoworkDataBlock(i: CoworkBlockInput): string {
  const money = (c: number) => formatCurrency(c, i.symbol)

  const moneyDelta = (d: number | null): string => {
    if (d == null || d === 0) return 'flat'
    return (d > 0 ? '+' : '-') + money(Math.abs(d))
  }

  const ppDelta = (d: number | null): string => {
    if (d == null || d === 0) return 'flat'
    return (d > 0 ? '+' : '-') + Math.abs(d).toFixed(1) + ' pp'
  }

  const pct = (amount: number): string =>
    i.totalRevenue > 0 ? ((amount / i.totalRevenue) * 100).toFixed(1) : '0.0'

  const movers = i.expenseMovers
    .filter((m) => Math.abs(m.delta) >= MOVER_THRESHOLD)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map((m) => `${m.label} ${m.delta > 0 ? '+' : '-'}${money(Math.abs(m.delta))}`)
  const moversText = movers.length > 0 ? movers.join(', ') : '(none significant)'

  const targetLine = i.target
    ? `#1 target: ${i.target.name}; balance ${money(i.target.balance)}; paid ${money(i.target.paid)}`
    : '#1 target: none set'

  return [
    "Generate this month's Monthly Review from the dashboard data below.",
    'Follow monthly-review-autodraft.md (standard format, standard rules).',
    '',
    `Month: ${i.monthLabel}`,
    `Revenue: ${money(i.revenue)} (Δ ${moneyDelta(i.revenueDelta)})`,
    `Expenses: ${money(i.expenses)} (Δ ${moneyDelta(i.expensesDelta)})`,
    `Net cash flow: ${money(i.netCashFlow)} (Δ ${moneyDelta(i.netCashFlowDelta)})`,
    `True burn rate: ${i.burnRate.toFixed(1)}% (Δ ${ppDelta(i.burnRateDeltaPp)})`,
    `Total debt: ${money(i.totalDebt)} (Δ ${moneyDelta(i.totalDebtDelta)})`,
    targetLine,
    `Active income: ${money(i.activeIncome)} (${pct(i.activeIncome)}%)`,
    `Semi-active: ${money(i.semiActiveIncome)} (${pct(i.semiActiveIncome)}%)`,
    `Passive: ${money(i.passiveIncome)} (${pct(i.passiveIncome)}%)`,
    `Largest movers: ${moversText}`,
  ].join('\n')
}
