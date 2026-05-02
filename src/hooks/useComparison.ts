import { useMemo } from 'react'
import { getMonth } from '../utils/storage'
import { computeMetrics } from '../utils/calculations'
import { priorYearMonth, computeDelta, diffLineItems } from '../utils/comparison'
import type { MonthRecord, MonthMetrics, MonthDelta, LineItemDelta } from '../types'

export function useComparison(record: MonthRecord | null): {
  priorRecord: MonthRecord | null
  priorMetrics: MonthMetrics | null
  currentMetrics: MonthMetrics | null
  delta: MonthDelta | null
  lineItemDeltas: LineItemDelta[]
  priorYM: string | null
} {
  return useMemo(() => {
    if (!record) {
      return { priorRecord: null, priorMetrics: null, currentMetrics: null, delta: null, lineItemDeltas: [], priorYM: null }
    }

    const currentMetrics = computeMetrics(record)
    const priorYM = priorYearMonth(record.yearMonth)
    const priorRecord = getMonth(priorYM)

    if (!priorRecord) {
      return { priorRecord: null, priorMetrics: null, currentMetrics, delta: null, lineItemDeltas: [], priorYM }
    }

    const priorMetrics = computeMetrics(priorRecord)
    const delta = computeDelta(currentMetrics, priorMetrics)

    const allCurrent = [...record.income, ...record.expenses]
    const allPrior = [...priorRecord.income, ...priorRecord.expenses]
    const lineItemDeltas = diffLineItems(allCurrent, allPrior)

    return { priorRecord, priorMetrics, currentMetrics, delta, lineItemDeltas, priorYM }
  }, [record])
}
