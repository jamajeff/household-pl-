import clsx from 'clsx'
import type {
  MonthRecord,
  MonthDelta,
  LineItemDelta,
  ReviewData,
  AppSettings,
  MonthMetrics,
  Debt,
} from '../../types'
import { DeltaBadge } from '../shared/DeltaBadge'
import { formatCurrency, formatPct, labelMonth } from '../../utils/formatting'
import {
  formatHeadline,
  monthsToClearDebt,
  addMonthsToYearMonth,
} from '../../utils/calculations'
import { deltaDirection } from '../../utils/comparison'
import { useNetWorth } from '../../hooks/useNetWorth'

interface Props {
  record: MonthRecord
  metrics: MonthMetrics
  delta: MonthDelta | null
  lineItemDeltas: LineItemDelta[]
  priorReview: ReviewData | null
  settings: AppSettings
  onUpdateReview: (review: ReviewData) => void
}

const DELTA_FIELDS: { field: keyof MonthDelta; label: string; format: 'currency' | 'pp' }[] = [
  { field: 'totalRevenue', label: 'Revenue', format: 'currency' },
  { field: 'totalExpenses', label: 'Expenses', format: 'currency' },
  { field: 'netCashFlow', label: 'Net Cash Flow', format: 'currency' },
  { field: 'burnRate', label: 'Burn Rate', format: 'pp' },
]

function formatSnapshotDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ReviewSection({
  record,
  metrics,
  delta,
  lineItemDeltas,
  priorReview,
  settings,
  onUpdateReview,
}: Props) {
  const { currencySymbol: sym } = settings
  const { review } = record
  const { debts } = useNetWorth()

  const fmt = (c: number) => formatCurrency(c, sym)
  const headline = formatHeadline(metrics.netCashFlow, delta?.netCashFlow ?? null, fmt)

  // Burn rate target display
  const burnTargetText = settings.targetBurnRatePct === null
    ? '(target: set in Settings)'
    : `(target: <${settings.targetBurnRatePct}%)`

  // Target debt lookup
  const targetDebt: Debt | undefined = settings.targetDebtId
    ? debts.find((d) => d.id === settings.targetDebtId)
    : undefined

  // Total debt — snapshot if set, else live sum
  const liveTotalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const totalDebtDisplay = review.totalDebtSnapshot !== null ? review.totalDebtSnapshot : liveTotalDebt
  const totalDebtIsLive = review.totalDebtSnapshot === null

  // Total debt delta
  const totalDebtDelta = (review.totalDebtSnapshot !== null && priorReview?.totalDebtSnapshot != null)
    ? priorReview.totalDebtSnapshot - review.totalDebtSnapshot
    : null

  // Target debt "balance now" — snapshot if set, else live balance
  const targetBalanceDisplay = review.targetDebtSnapshot !== null
    ? review.targetDebtSnapshot
    : (targetDebt?.balance ?? null)
  const targetBalanceIsLive = review.targetDebtSnapshot === null && targetDebt !== undefined

  // Paid this month
  const paidThisMonth = (review.targetDebtSnapshot !== null && priorReview?.targetDebtSnapshot != null)
    ? priorReview.targetDebtSnapshot - review.targetDebtSnapshot
    : null

  // Clear-by projection
  let clearBy: string | null = null
  if (targetBalanceDisplay !== null && paidThisMonth !== null) {
    const months = monthsToClearDebt(targetBalanceDisplay, paidThisMonth)
    if (months !== null) clearBy = labelMonth(addMonthsToYearMonth(record.yearMonth, months))
  }

  // Income tier %
  const tierPct = (amount: number) => metrics.totalRevenue > 0 ? (amount / metrics.totalRevenue) * 100 : null

  // Snapshot action
  function takeSnapshot() {
    if (review.snapshotTakenAt) {
      const prev = formatSnapshotDate(review.snapshotTakenAt)
      if (!confirm(`Overwrite existing snapshot from ${prev}?`)) return
    }
    if (!targetDebt) {
      alert('Set #1 target debt in Settings before snapshotting.')
      return
    }
    onUpdateReview({
      ...review,
      targetDebtSnapshot: targetDebt.balance,
      totalDebtSnapshot: liveTotalDebt,
      snapshotTakenAt: new Date().toISOString(),
    })
  }

  function setField<K extends keyof ReviewData>(key: K, value: ReviewData[K]) {
    onUpdateReview({ ...review, [key]: value })
  }

  function renderDelta(amount: number | null, suffix = 'vs last month') {
    if (amount === null) return <span className="text-gray-400">—</span>
    if (amount === 0) return <span className="text-gray-500">(flat {suffix})</span>
    const direction = amount > 0 ? 'down' : 'up'  // for debt: positive paid = balance down
    const color = amount > 0 ? 'text-emerald-600' : 'text-red-500'
    return <span className={`${color} font-medium`}>({direction} {fmt(Math.abs(amount))} {suffix})</span>
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 mb-8 overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
          Monthly Review — {labelMonth(record.yearMonth)}
        </h2>
      </div>

      <div className="p-5 space-y-7">

        {/* Headline + burn rate */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Headline</p>
            <p className="text-sm text-gray-800">{headline}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">True consumption burn rate</p>
            <p className="text-sm text-gray-800">
              <span className="font-semibold text-gray-900">{formatPct(metrics.burnRate)}</span>{' '}
              <span className="text-gray-500">{burnTargetText}</span>
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Debt block */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Debt</p>
          <ul className="space-y-2 text-sm text-gray-800 mb-4">
            <li className="flex items-baseline gap-2">
              <span className="text-gray-400">•</span>
              <span>
                Total debt: <span className="font-semibold text-gray-900">{fmt(totalDebtDisplay)}</span>{' '}
                {totalDebtIsLive && <span className="text-xs text-gray-400">(live)</span>}{' '}
                {renderDelta(totalDebtDelta)}
              </span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-gray-400">•</span>
              <span>
                #1 target:{' '}
                {targetDebt ? (
                  <>
                    <span className="font-semibold text-gray-900">{targetDebt.label}</span> —{' '}
                    {paidThisMonth === null ? (
                      <span className="text-gray-400">— this month</span>
                    ) : paidThisMonth < 0 ? (
                      <>
                        <span className="font-semibold text-red-500">balance increased {fmt(Math.abs(paidThisMonth))}</span> this month
                      </>
                    ) : (
                      <>
                        paid <span className="font-semibold text-gray-900">{fmt(paidThisMonth)}</span> this month
                      </>
                    )}, balance now{' '}
                    {targetBalanceDisplay !== null ? (
                      <>
                        <span className="font-semibold text-gray-900">{fmt(targetBalanceDisplay)}</span>
                        {targetBalanceIsLive && <span className="text-xs text-gray-400 ml-1">(live)</span>}
                      </>
                    ) : '—'}
                  </>
                ) : (
                  <span className="text-gray-500">set target debt in Settings</span>
                )}
              </span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-gray-400">•</span>
              <span>
                On track to clear #1 by:{' '}
                {clearBy ? <span className="font-semibold text-gray-900">{clearBy}</span> : <span className="text-gray-400">—</span>}
              </span>
            </li>
          </ul>

          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={takeSnapshot}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
            >
              📸 Snapshot debt balances at month-end
            </button>
            {review.snapshotTakenAt && (
              <span className="text-xs text-gray-400">Last snapshot: {formatSnapshotDate(review.snapshotTakenAt)}</span>
            )}
            {!review.snapshotTakenAt && (
              <span className="text-xs text-gray-400">Snapshot to compute paid-this-month and total-debt delta</span>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              One step toward filling the bottom two this month
            </span>
            <input
              type="text"
              value={review.oneStepIncomeTier}
              onChange={(e) => setField('oneStepIncomeTier', e.target.value)}
              placeholder="action or 'none yet'"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
            />
          </label>
        </div>

        <div className="border-t border-gray-100" />

        {/* Income tiering */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Income tiering{' '}
            <span className="text-gray-400 normal-case tracking-normal font-normal">(the leverage scoreboard)</span>
          </p>
          <ul className="space-y-1.5 text-sm text-gray-800">
            {[
              { label: 'Active', amount: metrics.activeIncome },
              { label: 'Semi-active', amount: metrics.semiActiveIncome },
              { label: 'Passive', amount: metrics.passiveIncome },
            ].map(({ label, amount }) => {
              const pct = tierPct(amount)
              return (
                <li key={label} className="flex items-baseline gap-2">
                  <span className="text-gray-400">•</span>
                  <span className="w-28">{label}:</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{fmt(amount)}</span>
                  <span className="text-gray-500 tabular-nums">
                    {pct === null ? '(—)' : `(${pct.toFixed(1)}%)`}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="border-t border-gray-100" />

        {/* This month */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">This month</p>

          <label className="block">
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">One win</span>
            <input
              type="text"
              value={review.oneWin}
              onChange={(e) => setField('oneWin', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">One thing to watch</span>
            <input
              type="text"
              value={review.oneToWatch}
              onChange={(e) => setField('oneToWatch', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">One decision for next month</span>
            <input
              type="text"
              value={review.oneDecisionNext}
              onChange={(e) => setField('oneDecisionNext', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
        </div>

        <div className="border-t border-gray-100" />

        {/* Delta highlights (unchanged) */}
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

        {/* Notable line item changes (unchanged) */}
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

      </div>
    </div>
  )
}
