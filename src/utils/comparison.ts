import type { MonthMetrics, MonthDelta, LineItem, LineItemDelta } from '../types'
import { format, subMonths, parse } from 'date-fns'

export function priorYearMonth(yearMonth: string): string {
  const date = parse(yearMonth, 'yyyy-MM', new Date())
  return format(subMonths(date, 1), 'yyyy-MM')
}

export function computeDelta(current: MonthMetrics, prior: MonthMetrics): MonthDelta {
  return {
    totalRevenue: current.totalRevenue - prior.totalRevenue,
    totalExpenses: current.totalExpenses - prior.totalExpenses,
    wealthBuildingTotal: current.wealthBuildingTotal - prior.wealthBuildingTotal,
    netCashFlow: current.netCashFlow - prior.netCashFlow,
    savingsRate: current.savingsRate - prior.savingsRate,
    burnRate: current.burnRate - prior.burnRate,
  }
}

// Higher = better for these fields; lower = better for the rest
const HIGHER_IS_BETTER: Array<keyof MonthDelta> = [
  'totalRevenue',
  'netCashFlow',
  'savingsRate',
  'wealthBuildingTotal',
]

export function deltaDirection(
  field: keyof MonthDelta,
  value: number,
): 'positive' | 'negative' | 'neutral' {
  if (value === 0) return 'neutral'
  const higherIsBetter = HIGHER_IS_BETTER.includes(field)
  return (higherIsBetter ? value > 0 : value < 0) ? 'positive' : 'negative'
}

export function diffLineItems(current: LineItem[], prior: LineItem[]): LineItemDelta[] {
  const priorMap = new Map(prior.map((i) => [i.label.toLowerCase(), i.amount]))
  const currentMap = new Map(current.map((i) => [i.label.toLowerCase(), i.amount]))

  const results: LineItemDelta[] = []

  for (const item of current) {
    const key = item.label.toLowerCase()
    const priorAmount = priorMap.get(key) ?? null
    const delta = priorAmount !== null ? item.amount - priorAmount : item.amount
    results.push({
      label: item.label,
      currentAmount: item.amount,
      priorAmount,
      delta,
      status: priorAmount === null ? 'new' : delta !== 0 ? 'changed' : 'unchanged',
    })
  }

  for (const item of prior) {
    if (!currentMap.has(item.label.toLowerCase())) {
      results.push({
        label: item.label,
        currentAmount: null,
        priorAmount: item.amount,
        delta: -item.amount,
        status: 'removed',
      })
    }
  }

  return results
}

export function generateChangesSummary(
  delta: MonthDelta,
  lineDeltas: LineItemDelta[],
  priorLabel: string,
  formatCurrency: (cents: number) => string,
  formatPct: (n: number) => string,
): string {
  const lines: string[] = []

  const rev = delta.totalRevenue
  if (rev !== 0) {
    const sign = rev > 0 ? 'increased' : 'decreased'
    lines.push(`Revenue ${sign} by ${formatCurrency(Math.abs(rev))}.`)
  }

  const exp = delta.totalExpenses
  if (exp !== 0) {
    const sign = exp > 0 ? 'increased' : 'decreased'
    lines.push(`Expenses ${sign} by ${formatCurrency(Math.abs(exp))}.`)
  }

  const savings = delta.savingsRate
  if (Math.abs(savings) >= 0.5) {
    const sign = savings > 0 ? 'up' : 'down'
    lines.push(`Savings rate ${sign} ${formatPct(Math.abs(savings))} vs ${priorLabel}.`)
  }

  const notable = lineDeltas
    .filter((d) => d.status === 'changed' && Math.abs(d.delta) > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)

  for (const d of notable) {
    const sign = d.delta > 0 ? '+' : '-'
    lines.push(`${d.label}: ${sign}${formatCurrency(Math.abs(d.delta))}.`)
  }

  const newItems = lineDeltas.filter((d) => d.status === 'new')
  if (newItems.length > 0) {
    lines.push(`New items: ${newItems.map((d) => d.label).join(', ')}.`)
  }

  const removed = lineDeltas.filter((d) => d.status === 'removed')
  if (removed.length > 0) {
    lines.push(`Removed: ${removed.map((d) => d.label).join(', ')}.`)
  }

  return lines.join(' ') || `No changes from ${priorLabel}.`
}
