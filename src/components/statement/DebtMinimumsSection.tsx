import { useState } from 'react'
import { CurrencyInput } from '../shared/CurrencyInput'
import { formatCurrency } from '../../utils/formatting'
import { utilizationPct } from '../../utils/debt'
import type { Debt, DebtKind, DebtSnapshot } from '../../types'

interface Props {
  kind: DebtKind
  debts: Debt[]                    // full registry
  snapshots: DebtSnapshot[]        // current month's snapshots
  symbol: string
  onSetSnapshot: (debtId: string, data: { balance: number; minPayment: number }) => void
}

function utilizationColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400'
  if (pct > 30) return 'text-red-500'
  if (pct < 10) return 'text-emerald-600'
  return 'text-amber-500'
}

export function DebtMinimumsSection({ kind, debts, snapshots, symbol, onSetSnapshot }: Props) {
  const relevant = debts.filter((d) => d.kind === kind)
  const snapById = new Map(snapshots.map((s) => [s.debtId, s]))

  const totalMin = relevant.reduce((s, d) => s + (snapById.get(d.id)?.minPayment ?? d.minPayment), 0)
  const totalBalance = relevant.reduce((s, d) => s + (snapById.get(d.id)?.balance ?? d.balance), 0)

  const title = kind === 'loan' ? 'Tier 3a — Loan Minimums' : 'Tier 3b — Credit Card Minimums'
  const accent = kind === 'loan' ? 'border-purple-400 bg-purple-50/30' : 'border-pink-400 bg-pink-50/30'
  const tierLabel = kind === 'loan' ? 'Tier 3a' : 'Tier 3b'

  return (
    <div className="mb-1">
      <div className={`flex items-center justify-between px-4 py-2 border-l-4 ${accent}`}>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        <span className="text-xs font-semibold tabular-nums text-gray-600">
          {tierLabel} total: {formatCurrency(totalMin, symbol)}/mo · {formatCurrency(totalBalance, symbol)} balance
        </span>
      </div>
      {relevant.length === 0 ? (
        <p className="text-xs text-gray-300 px-4 py-3">
          No {kind === 'loan' ? 'loans' : 'credit cards'} in the registry. Add them on the Net Worth page.
        </p>
      ) : (
        <table className="w-full">
          <tbody>
            {relevant.map((d) => {
              const snap = snapById.get(d.id)
              const balance = snap?.balance ?? d.balance
              const minPayment = snap?.minPayment ?? d.minPayment
              const util = kind === 'credit_card' ? utilizationPct(balance, d.creditLimit) : null
              return (
                <tr key={d.id} className="border-b border-gray-50">
                  <td className="py-2 pl-4 pr-2 text-sm text-gray-700">
                    {d.label}
                    <span className="ml-2 text-[11px] text-gray-400">{d.apr ? `${d.apr}%` : 'no APR'}</span>
                    {util !== null && <span className={`ml-2 text-[11px] ${utilizationColor(util)}`}>{util.toFixed(0)}% util</span>}
                  </td>
                  <td className="py-2 px-1">
                    <DebtCell label="min" value={minPayment} symbol={symbol}
                      onCommit={(v) => onSetSnapshot(d.id, { balance, minPayment: v })} />
                  </td>
                  <td className="py-2 px-1 pr-4">
                    <DebtCell label="balance" value={balance} symbol={symbol}
                      onCommit={(v) => onSetSnapshot(d.id, { balance: v, minPayment })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function DebtCell({ label, value, symbol, onCommit }: { label: string; value: number; symbol: string; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(value)
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] uppercase text-gray-400">{label}</span>
      <CurrencyInput
        value={draft}
        onChange={setDraft}
        symbol={symbol}
        className="w-28 border border-gray-200 rounded pr-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      {draft !== value && (
        <button onClick={() => onCommit(draft)} className="mt-0.5 text-[11px] text-emerald-600 hover:text-emerald-700">save</button>
      )}
    </div>
  )
}
