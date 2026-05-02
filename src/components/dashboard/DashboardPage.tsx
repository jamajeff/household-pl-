import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getIndex, getMonth } from '../../utils/storage'
import { computeMetrics } from '../../utils/calculations'
import { computeDelta } from '../../utils/comparison'
import { useSettings } from '../../hooks/useSettings'
import { MetricCard } from './MetricCard'
import { formatCurrency, formatPct, labelMonth, shortMonth } from '../../utils/formatting'
import { currentYearMonth } from '../../hooks/useMonthData'

export function DashboardPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const sym = settings.currencySymbol

  const { months, latest, delta } = useMemo(() => {
    const index = getIndex()
    const last6 = index.slice(-6)

    const months = last6.map((ym) => {
      const record = getMonth(ym)
      if (!record) return null
      const m = computeMetrics(record)
      return {
        ym,
        label: shortMonth(ym),
        revenue: m.totalRevenue / 100,
        expenses: m.totalExpenses / 100,
        netCashFlow: m.netCashFlow / 100,
        savingsRate: m.savingsRate,
        wealthBuilding: m.wealthBuildingTotal / 100,
      }
    }).filter(Boolean) as NonNullable<ReturnType<typeof getMonth> extends null ? never : {
      ym: string; label: string; revenue: number; expenses: number; netCashFlow: number; savingsRate: number; wealthBuilding: number
    }>[]

    const latestYM = index[index.length - 1]
    const priorYM = index[index.length - 2]

    const latestRecord = latestYM ? getMonth(latestYM) : null
    const priorRecord = priorYM ? getMonth(priorYM) : null

    const latest = latestRecord ? computeMetrics(latestRecord) : null
    const priorMetrics = priorRecord ? computeMetrics(priorRecord) : null
    const delta = latest && priorMetrics ? computeDelta(latest, priorMetrics) : null

    return { months, latest, delta }
  }, [])

  const ym = currentYearMonth()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Household financial overview</p>
        </div>
        <button
          onClick={() => navigate(`/statement/${ym}`)}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Open {labelMonth(ym)}
        </button>
      </div>

      {months.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-400 mb-4">No data yet. Start by entering your first month.</p>
          <button
            onClick={() => navigate(`/statement/${ym}`)}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Start with {labelMonth(ym)}
          </button>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Total Revenue"
              value={latest ? formatCurrency(latest.totalRevenue, sym) : '—'}
              deltaField="totalRevenue"
              deltaValue={delta?.totalRevenue}
              symbol={sym}
              accent="border-l-4 border-l-emerald-400"
            />
            <MetricCard
              label="Total Expenses"
              value={latest ? formatCurrency(latest.totalExpenses, sym) : '—'}
              deltaField="totalExpenses"
              deltaValue={delta?.totalExpenses}
              symbol={sym}
              accent="border-l-4 border-l-red-400"
            />
            <MetricCard
              label="Net Cash Flow"
              value={latest ? formatCurrency(latest.netCashFlow, sym) : '—'}
              deltaField="netCashFlow"
              deltaValue={delta?.netCashFlow}
              symbol={sym}
              valueColor={latest && latest.netCashFlow < 0 ? 'text-red-500' : 'text-emerald-600'}
              accent="border-l-4 border-l-blue-400"
            />
            <MetricCard
              label="Savings Rate"
              value={latest ? formatPct(latest.savingsRate) : '—'}
              deltaField="savingsRate"
              deltaValue={delta?.savingsRate}
              deltaFormat="pp"
              accent="border-l-4 border-l-violet-400"
            />
          </div>

          {/* Trend chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">6-Month Trend</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={months} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tickFormatter={(v) => `${sym}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip formatter={(v) => typeof v === 'number' ? formatCurrency(Math.round(v * 100), sym) : v} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="netCashFlow" stroke="#3b82f6" strokeWidth={2} name="Net Cash Flow" dot={{ r: 3 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue vs. Expenses vs. Wealth Building</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={months} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tickFormatter={(v) => `${sym}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip formatter={(v) => typeof v === 'number' ? formatCurrency(Math.round(v * 100), sym) : v} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" fill="#f87171" name="Expenses" radius={[3, 3, 0, 0]} />
                <Bar dataKey="wealthBuilding" fill="#8b5cf6" name="Wealth Building" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
