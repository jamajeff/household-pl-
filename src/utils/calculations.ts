import { addMonths, format, parse } from 'date-fns'
import type { MonthRecord, MonthMetrics, LineItem, Debt } from '../types'

function sum(items: LineItem[]): number {
  return items.reduce((acc, i) => acc + i.amount, 0)
}

export function computeMetrics(record: MonthRecord, debts: Debt[] = []): MonthMetrics {
  const activeIncome = sum(record.income.filter((i) => i.subcategory === 'active'))
  const semiActiveIncome = sum(record.income.filter((i) => i.subcategory === 'semi_active'))
  const passiveIncome = sum(record.income.filter((i) => i.subcategory === 'passive'))
  const totalRevenue = activeIncome + semiActiveIncome + passiveIncome

  const tier2Total = sum(record.expenses.filter((e) => e.subcategory === 'fixed_bill'))
  const tier7Total = sum(record.expenses.filter((e) => e.subcategory === 'variable'))

  // Split debt-snapshot minimums by the registry kind.
  const kindOf = new Map(debts.map((d) => [d.id, d.kind]))
  let tier3aTotal = 0
  let tier3bTotal = 0
  for (const snap of record.debtSnapshots) {
    if (kindOf.get(snap.debtId) === 'credit_card') tier3bTotal += snap.minPayment
    else tier3aTotal += snap.minPayment // default unknown -> loan bucket
  }

  const tier4Rolling = record.rolling.paidThisMonth
  const totalExpenses = tier2Total + tier3aTotal + tier3bTotal + tier4Rolling + tier7Total

  const totalCommitted = tier2Total + tier3aTotal + tier3bTotal + record.rolling.amount
  const remainingForLowerTiers = totalRevenue - totalCommitted

  const netCashFlow = totalRevenue - totalExpenses
  const burnRate = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0

  const person1Income = sum(record.income.filter((i) => i.person === 'person1'))
  const person2Income = sum(record.income.filter((i) => i.person === 'person2'))

  return {
    totalRevenue,
    totalExpenses,
    netCashFlow,
    burnRate,
    person1Income,
    person2Income,
    activeIncome,
    semiActiveIncome,
    passiveIncome,
    fixedExpenses: tier2Total,
    variableExpenses: tier7Total,
    tier2Total,
    tier3aTotal,
    tier3bTotal,
    tier4Rolling,
    tier7Total,
    totalCommitted,
    remainingForLowerTiers,
  }
}

export function monthsToClearDebt(balanceCents: number, paidThisMonthCents: number): number | null {
  if (paidThisMonthCents <= 0) return null
  if (balanceCents <= 0) return 0
  return Math.ceil(balanceCents / paidThisMonthCents)
}

export function addMonthsToYearMonth(yearMonth: string, months: number): string {
  const date = parse(yearMonth, 'yyyy-MM', new Date())
  return format(addMonths(date, months), 'yyyy-MM')
}

export function formatHeadline(
  netCashFlowCents: number,
  deltaVsPriorCents: number | null,
  formatCurrency: (cents: number) => string,
): string {
  const head = `Net cash flow was ${formatCurrency(netCashFlowCents)}`
  if (deltaVsPriorCents === null || deltaVsPriorCents === 0) {
    return `${head}.`
  }
  const direction = deltaVsPriorCents > 0 ? 'up' : 'down'
  const magnitude = formatCurrency(Math.abs(deltaVsPriorCents))
  return `${head} (${direction} ${magnitude} vs last month).`
}
