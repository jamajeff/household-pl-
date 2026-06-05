import { formatCurrency } from '../../utils/formatting'
import { buildDebtQueue, utilizationPct } from '../../utils/debt'
import type { Debt, DebtGroup, DebtSnapshot } from '../../types'

interface Props {
  debts: Debt[]
  snapshots: DebtSnapshot[]      // current month — overrides registry balance where present
  grouping: DebtGroup[]
  rollingAmount: number
  symbol: string
}

const GROUP_LABEL: Record<DebtGroup, string> = {
  credit_card: 'CC', cash: 'Cash', student: 'Student', auto: 'Auto', mortgage: 'Mortgage', other: 'Other',
}

export function DebtTrackingSection({ debts, snapshots, grouping, rollingAmount, symbol }: Props) {
  // Effective balances: monthly snapshot wins over the registry's live balance.
  const snapById = new Map(snapshots.map((s) => [s.debtId, s]))
  const effective = debts.map((d) => ({
    ...d,
    balance: snapById.get(d.id)?.balance ?? d.balance,
    minPayment: snapById.get(d.id)?.minPayment ?? d.minPayment,
  }))

  const cards = effective.filter((d) => d.kind === 'credit_card')
  const loans = effective.filter((d) => d.kind === 'loan')
  const totalCardDebt = cards.reduce((s, d) => s + d.balance, 0)
  const totalLoanDebt = loans.reduce((s, d) => s + d.balance, 0)
  const queue = buildDebtQueue(effective, grouping, rollingAmount)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 mb-4 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Debt Tracking</h2>
        <span className="text-sm font-semibold tabular-nums text-red-500">{formatCurrency(totalCardDebt + totalLoanDebt, symbol)} total</span>
      </div>

      {/* Credit Cards */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Credit Cards · {formatCurrency(totalCardDebt, symbol)}</p>
        <Table head={['Card', 'Balance', 'APR', 'Min', 'Util']}>
          {cards.map((d) => {
            const util = utilizationPct(d.balance, d.creditLimit)
            return (
              <tr key={d.id} className="border-b border-gray-50">
                <td className="py-1.5 text-sm text-gray-700">{d.label}</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(d.balance, symbol)}</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{d.apr}%</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(d.minPayment, symbol)}</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{util === null ? '—' : `${util.toFixed(0)}%`}</td>
              </tr>
            )
          })}
        </Table>
        {cards.length === 0 && <p className="text-xs text-gray-300 py-1">No credit cards in the registry.</p>}
      </div>

      {/* Loans */}
      <div className="px-4 py-3 border-t border-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Loans · {formatCurrency(totalLoanDebt, symbol)}</p>
        <Table head={['Loan', 'Balance', 'APR', 'Min', 'Type']}>
          {loans.map((d) => (
            <tr key={d.id} className="border-b border-gray-50">
              <td className="py-1.5 text-sm text-gray-700">{d.label}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(d.balance, symbol)}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{d.apr}%</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(d.minPayment, symbol)}</td>
              <td className="py-1.5 text-sm text-right capitalize">{d.loanType ?? 'other'}</td>
            </tr>
          ))}
        </Table>
        {loans.length === 0 && <p className="text-xs text-gray-300 py-1">No loans in the registry.</p>}
      </div>

      {/* Payoff Queue */}
      <div className="px-4 py-3 border-t border-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Debt Payoff Queue · highest APR first</p>
        <Table head={['#', 'Type', 'Name', 'Balance', 'APR', 'Min', 'Months @ rolling']}>
          {queue.map((q) => (
            <tr key={q.debt.id} className={`border-b border-gray-50 ${q.rank === 1 ? 'bg-emerald-50' : ''}`}>
              <td className="py-1.5 text-sm font-semibold">#{q.rank}</td>
              <td className="py-1.5 text-sm">{GROUP_LABEL[q.group]}</td>
              <td className="py-1.5 text-sm text-gray-700">{q.debt.label}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(q.debt.balance, symbol)}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{q.debt.apr}%</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(q.debt.minPayment, symbol)}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{q.monthsToClear ?? '—'}</td>
            </tr>
          ))}
        </Table>
        {queue.length === 0 && <p className="text-xs text-gray-300 py-2">No debts in the registry yet.</p>}
      </div>
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full">
      <thead>
        <tr>{head.map((h, i) => <th key={h} className={`text-[11px] font-medium text-gray-400 uppercase pb-1 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}
