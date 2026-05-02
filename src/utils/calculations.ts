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
  const wealthBuildingTotal = sum(record.expenses.filter((e) => e.subcategory === 'wealth'))

  const totalExpenses = fixedExpenses + variableExpenses
  const netCashFlow = totalRevenue - totalExpenses - wealthBuildingTotal

  const savingsRate = totalRevenue > 0 ? (wealthBuildingTotal / totalRevenue) * 100 : 0
  const burnRate = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0

  const person1Income = sum(record.income.filter((i) => i.person === 'person1'))
  const person2Income = sum(record.income.filter((i) => i.person === 'person2'))

  return {
    totalRevenue,
    totalExpenses,
    wealthBuildingTotal,
    netCashFlow,
    savingsRate,
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
