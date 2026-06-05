import { CurrencyInput } from '../shared/CurrencyInput'
import { formatCurrency } from '../../utils/formatting'
import type { RollingPayment, Debt } from '../../types'

interface Props {
  rolling: RollingPayment
  queueTop: Debt | null   // Debt Queue #1
  symbol: string
  onUpdate: (updates: Partial<RollingPayment>) => void
}

function status(rolling: RollingPayment): { text: string; color: string } {
  if (rolling.paidThisMonth >= rolling.amount && rolling.amount > 0) return { text: 'On track', color: 'text-emerald-600' }
  if (rolling.paidThisMonth === 0) return { text: 'Missed', color: 'text-red-500' }
  return { text: 'Partial', color: 'text-amber-500' }
}

export function RollingSection({ rolling, queueTop, symbol, onUpdate }: Props) {
  const st = status(rolling)
  const offTarget = !!rolling.targetDebtId && !!queueTop && rolling.targetDebtId !== queueTop.id

  return (
    <div className="mb-1">
      <div className="flex items-center justify-between px-4 py-2 border-l-4 border-blue-500 bg-blue-50/30">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tier 4 — Rolling $8K</span>
        <span className={`text-xs font-semibold ${st.color}`}>{st.text}</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 w-32">Rolling amount</label>
          <CurrencyInput value={rolling.amount} onChange={(v) => onUpdate({ amount: v })} symbol={symbol}
            className="w-32 border border-gray-200 rounded pr-2 py-1 text-sm bg-white" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 w-32">Current target</label>
          <span className="text-sm font-medium text-gray-800">
            {queueTop ? queueTop.label : <span className="text-gray-400">— no debt in queue —</span>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 w-32">Paid this month</label>
          <CurrencyInput value={rolling.paidThisMonth}
            onChange={(v) => onUpdate({ paidThisMonth: v, targetDebtId: rolling.targetDebtId ?? queueTop?.id ?? null })}
            symbol={symbol}
            className="w-32 border border-gray-200 rounded pr-2 py-1 text-sm bg-white" />
        </div>
        {offTarget && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠ This payment did not go to your #1 target ({queueTop?.label}). Confirm the framework override is intentional.
          </p>
        )}
        <p className="text-[11px] text-gray-400">Committed {formatCurrency(rolling.amount, symbol)} / paid {formatCurrency(rolling.paidThisMonth, symbol)}.</p>
      </div>
    </div>
  )
}
