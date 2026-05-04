import { useState, useCallback } from 'react'
import { getMonth, setMonth } from '../utils/storage'
import type { MonthRecord, IncomeLineItem, ExpenseLineItem, ReviewData } from '../types'
import { nanoid } from '../components/statement/nanoid'
import { format } from 'date-fns'

function emptyRecord(yearMonth: string): MonthRecord {
  return {
    yearMonth,
    income: [],
    expenses: [],
    review: { keyChanges: '', actionItems: ['', '', ''] },
    updatedAt: new Date().toISOString(),
  }
}

export function useMonthData(yearMonth: string) {
  const [record, setRecord] = useState<MonthRecord>(() => {
    return getMonth(yearMonth) ?? emptyRecord(yearMonth)
  })

  const persist = useCallback((next: MonthRecord) => {
    const updated = { ...next, updatedAt: new Date().toISOString() }
    setMonth(updated)
    setRecord(updated)
  }, [])

  const addIncome = useCallback(
    (item: IncomeLineItem) => persist({ ...record, income: [...record.income, item] }),
    [record, persist],
  )

  const updateIncome = useCallback(
    (id: string, updates: Partial<IncomeLineItem>) =>
      persist({
        ...record,
        income: record.income.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }),
    [record, persist],
  )

  const deleteIncome = useCallback(
    (id: string) => persist({ ...record, income: record.income.filter((i) => i.id !== id) }),
    [record, persist],
  )

  const addExpense = useCallback(
    (item: ExpenseLineItem) => persist({ ...record, expenses: [...record.expenses, item] }),
    [record, persist],
  )

  const updateExpense = useCallback(
    (id: string, updates: Partial<ExpenseLineItem>) =>
      persist({
        ...record,
        expenses: record.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      }),
    [record, persist],
  )

  const deleteExpense = useCallback(
    (id: string) => persist({ ...record, expenses: record.expenses.filter((e) => e.id !== id) }),
    [record, persist],
  )

  const updateReview = useCallback(
    (review: ReviewData) => persist({ ...record, review }),
    [record, persist],
  )

  const copyFromRecord = useCallback(
    (source: MonthRecord) => {
      persist({
        ...record,
        income: source.income.map((i) => ({ ...i, id: nanoid() })),
        expenses: source.expenses.map((e) => ({ ...e, id: nanoid() })),
      })
    },
    [record, persist],
  )

  // Reload when yearMonth prop changes
  const [currentYearMonth, setCurrentYearMonth] = useState(yearMonth)
  if (yearMonth !== currentYearMonth) {
    setCurrentYearMonth(yearMonth)
    setRecord(getMonth(yearMonth) ?? emptyRecord(yearMonth))
  }

  return {
    record,
    addIncome,
    updateIncome,
    deleteIncome,
    addExpense,
    updateExpense,
    deleteExpense,
    updateReview,
    copyFromRecord,
  }
}

export function currentYearMonth(): string {
  return format(new Date(), 'yyyy-MM')
}
