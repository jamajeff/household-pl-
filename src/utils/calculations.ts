import { addMonths, format, parse } from 'date-fns'
import type { MonthRecord, MonthMetrics, LineItem } from '../types'

function sum(items: LineItem[]): number {
  return items.reduce((acc, i) => acc + i.amount, 0)
}

export function computeMetrics(record: MonthRecord): MonthMetrics {
  const activeIncome = sum(record.income.filter((i) => i.subcategory === 'active'))
  const semiActiveIncome = sum(record.income.filter((i) => i.subcategory === 'semi_active'))
  const passiveIncome = sum(record.income.filter((i) => i.subcategory === 'passive'))
  const totalRevenue = activeIncome + semiActiveIncome + passiveIncome

  const fixedExpenses = sum(record.expenses.filter((e) => e.subcategory === 'fixed'))
  const variableExpenses = sum(record.expenses.filter((e) => e.subcategory === 'variable'))
  const totalExpenses = fixedExpenses + variableExpenses

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
    fixedExpenses,
    variableExpenses,
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
