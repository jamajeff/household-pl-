import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import type { MonthRecord, MonthDelta, LineItemDelta, ReviewData, AppSettings } from '../../types'
import { DeltaBadge } from '../shared/DeltaBadge'
import { formatCurrency, formatPct, labelMonth } from '../../utils/formatting'
import { generateChangesSummary, deltaDirection } from '../../utils/comparison'

interface Props {
  record: MonthRecord
  delta: MonthDelta | null
  lineItemDeltas: LineItemDelta[]
  priorYM: string | null
  settings: AppSettings
  onUpdateReview: (review: ReviewData) => void
}

const DELTA_FIELDS: { field: keyof MonthDelta; label: string; format: 'currency' | 'pp' }[] = [
  { field: 'totalRevenue', label: 'Revenue', format: 'currency' },
  { field: 'totalExpenses', label: 'Expenses', format: 'currency' },
  { field: 'wealthBuildingTotal', label: 'Wealth Building', format: 'currency' },
  { field: 'netCashFlow', label: 'Net Cash Flow', format: 'currency' },
  { field: 'savingsRate', label: 'Savings Rate', format: 'pp' },
  { field: 'burnRate', label: 'Burn Rate', format: 'pp' },
]

export function ReviewSection({ record, delta, lineItemDeltas, priorYM, settings, onUpdateReview }: Props) {
  const { currencySymbol: sym } = settings
  const { review } = record

  const autoGenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!delta || !priorYM || review.keyChanges) return
    const generated = generateChangesSummary(
      delta,
      lineItemDeltas,
      labelMonth(priorYM),
      (c) => formatCurrency(c, sym),
      formatPct,
    )
    autoGenRef.current = generated
    onUpdateReview({ ...review, keyChanges: generated })
  }, [priorYM]) // only auto-populate once per priorYM

  function setKeyChanges(keyChanges: string) {
    onUpdateReview({ ...review, keyChanges })
  }

  function setAction(index: number, value: string) {
    const next: [string, string, string] = [...review.actionItems] as [string, string, string]
    next[index] = value
    onUpdateReview({ ...review, actionItems: next })
  }


  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 mb-8 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Monthly Review</h2>
      </div>

      <div className="p-5 space-y-6">
        {/* Key changes */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Key Changes {priorYM ? `from ${labelMonth(priorYM)}` : ''}
          </label>
          <textarea
            value={review.keyChanges}
            onChange={(e) => setKeyChanges(e.target.value)}
            rows={4}
            placeholder={priorYM ? 'Auto-populated from comparison — edit as needed' : 'Summarize notable changes this month…'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
          />
        </div>

        {/* Delta highlights */}
        {delta && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Delta Highlights</p>
            <div className="flex flex-wrap gap-2">
              {DELTA_FIELDS.map(({ field, label, format }) => {
                const value = delta[field]
                const dir = deltaDirection(field, value)
                if (dir === 'neutral') return null
                return (
                  <div
                    key={field}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                      dir === 'positive' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100',
                    )}
                  >
                    <span className="text-gray-600 text-xs">{label}</span>
                    <DeltaBadge field={field} value={value} format={format} symbol={sym} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Notable line item changes */}
        {lineItemDeltas.filter((d) => d.status !== 'unchanged').length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Line Item Changes</p>
            <div className="space-y-1">
              {lineItemDeltas
                .filter((d) => d.status !== 'unchanged')
                .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                .slice(0, 8)
                .map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-700">
                      {d.label}
                      {d.status === 'new' && <span className="ml-1.5 text-xs text-emerald-600 font-medium">new</span>}
                      {d.status === 'removed' && <span className="ml-1.5 text-xs text-red-500 font-medium">removed</span>}
                    </span>
                    <span className={clsx('font-medium tabular-nums text-xs', d.delta > 0 ? 'text-red-500' : 'text-emerald-600')}>
                      {d.delta > 0 ? '+' : ''}{formatCurrency(d.delta, sym)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Action items */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Action Items for Next Month
          </label>
          <div className="space-y-2">
            {review.actionItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 h-5 flex-shrink-0 bg-gray-900 text-white rounded-full text-xs flex items-center justify-center font-semibold">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => setAction(i, e.target.value)}
                  placeholder={`Action item ${i + 1}…`}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
