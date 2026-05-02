import clsx from 'clsx'
import type { MonthDelta } from '../../types'
import { deltaDirection } from '../../utils/comparison'
import { formatCurrency, formatPct } from '../../utils/formatting'

interface Props {
  field: keyof MonthDelta
  value: number
  format?: 'currency' | 'pct' | 'pp'
  symbol?: string
}

export function DeltaBadge({ field, value, format = 'currency', symbol = '$' }: Props) {
  const dir = deltaDirection(field, value)
  if (dir === 'neutral') return null

  const label =
    format === 'pct'
      ? `${value > 0 ? '+' : ''}${formatPct(value)}`
      : format === 'pp'
        ? `${value > 0 ? '+' : ''}${formatPct(value)} pp`
        : `${value > 0 ? '+' : ''}${formatCurrency(value, symbol)}`

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
        dir === 'positive'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-red-50 text-red-600',
      )}
    >
      {dir === 'positive' ? '▲' : '▼'} {label}
    </span>
  )
}
