import clsx from 'clsx'
import type { MonthMetrics, MonthDelta, AppSettings } from '../../types'
import { formatCurrency, formatPct } from '../../utils/formatting'
import { DeltaBadge } from '../shared/DeltaBadge'

interface Props {
  metrics: MonthMetrics
  delta: MonthDelta | null
  settings: AppSettings
}

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function MetricsSummaryBar({ metrics, delta, settings: { currencySymbol } }: Props) {
  const isNegativeCashFlow = metrics.netCashFlow < 0

  return (
    <div className="bg-gray-900 text-white rounded-xl mx-4 my-6 p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Revenue</p>
          <p className="text-xl font-semibold tabular-nums">{formatCurrency(metrics.totalRevenue, currencySymbol)}</p>
          {delta && <div className="mt-1"><DeltaBadge field="totalRevenue" value={delta.totalRevenue} symbol={currencySymbol} /></div>}
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Expenses</p>
          <p className="text-xl font-semibold tabular-nums">{formatCurrency(metrics.totalExpenses, currencySymbol)}</p>
          {delta && <div className="mt-1"><DeltaBadge field="totalExpenses" value={delta.totalExpenses} symbol={currencySymbol} /></div>}
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Wealth Building</p>
          <p className="text-xl font-semibold tabular-nums">{formatCurrency(metrics.wealthBuildingTotal, currencySymbol)}</p>
          {delta && <div className="mt-1"><DeltaBadge field="wealthBuildingTotal" value={delta.wealthBuildingTotal} symbol={currencySymbol} /></div>}
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Net Cash Flow</p>
          <p className={clsx('text-xl font-semibold tabular-nums', isNegativeCashFlow ? 'text-red-400' : 'text-emerald-400')}>
            {formatCurrency(metrics.netCashFlow, currencySymbol)}
          </p>
          {delta && <div className="mt-1"><DeltaBadge field="netCashFlow" value={delta.netCashFlow} symbol={currencySymbol} /></div>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Savings Rate</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-emerald-400">{formatPct(metrics.savingsRate)}</span>
              {delta && <DeltaBadge field="savingsRate" value={delta.savingsRate} format="pp" />}
            </div>
          </div>
          <ProgressBar value={metrics.savingsRate} color="bg-emerald-500" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Burn Rate</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-amber-400">{formatPct(metrics.burnRate)}</span>
              {delta && <DeltaBadge field="burnRate" value={delta.burnRate} format="pp" />}
            </div>
          </div>
          <ProgressBar value={metrics.burnRate} color="bg-amber-500" />
        </div>
      </div>
    </div>
  )
}
