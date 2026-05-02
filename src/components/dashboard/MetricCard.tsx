import clsx from 'clsx'
import type { MonthDelta } from '../../types'
import { DeltaBadge } from '../shared/DeltaBadge'

interface Props {
  label: string
  value: string
  deltaField?: keyof MonthDelta
  deltaValue?: number
  deltaFormat?: 'currency' | 'pp'
  symbol?: string
  accent?: string
  valueColor?: string
}

export function MetricCard({ label, value, deltaField, deltaValue, deltaFormat = 'currency', symbol, accent = 'border-gray-200', valueColor }: Props) {
  return (
    <div className={clsx('bg-white rounded-xl border shadow-sm p-5', accent)}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={clsx('text-2xl font-semibold tabular-nums', valueColor ?? 'text-gray-900')}>{value}</p>
      {deltaField !== undefined && deltaValue !== undefined && (
        <div className="mt-2">
          <DeltaBadge field={deltaField} value={deltaValue} format={deltaFormat} symbol={symbol} />
        </div>
      )}
    </div>
  )
}
