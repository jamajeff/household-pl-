import { useMemo } from 'react'
import { computeMetrics } from '../utils/calculations'
import type { MonthRecord, MonthMetrics } from '../types'

export function useCalculations(record: MonthRecord | null): MonthMetrics | null {
  return useMemo(() => (record ? computeMetrics(record) : null), [record])
}
