import { useNavigate } from 'react-router-dom'
import { format, addMonths, subMonths, parse } from 'date-fns'
import { useMonthData } from '../../hooks/useMonthData'
import { useComparison } from '../../hooks/useComparison'
import { useSettings } from '../../hooks/useSettings'
import { SectionTable } from './SectionTable'
import { AddLineItemForm } from './AddLineItemForm'
import { MetricsSummaryBar } from './MetricsSummaryBar'
import { ReviewSection } from '../review/ReviewSection'
import { formatCurrency, labelMonth } from '../../utils/formatting'
import { computeMetrics } from '../../utils/calculations'
import type { IncomeLineItem, ExpenseLineItem } from '../../types'

interface Props {
  yearMonth: string
}

export function StatementPage({ yearMonth }: Props) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const {
    record,
    addIncome, updateIncome, deleteIncome,
    addExpense, updateExpense, deleteExpense,
    updateReview,
  } = useMonthData(yearMonth)

  const { delta, priorYM, lineItemDeltas } = useComparison(record)
  const metrics = computeMetrics(record)

  const sym = settings.currencySymbol

  function goMonth(direction: -1 | 1) {
    const date = parse(yearMonth, 'yyyy-MM', new Date())
    const next = direction === 1 ? addMonths(date, 1) : subMonths(date, 1)
    navigate(`/statement/${format(next, 'yyyy-MM')}`)
  }

  const activeIncome = record.income.filter((i) => i.subcategory === 'active')
  const semiActiveIncome = record.income.filter((i) => i.subcategory === 'semi_active')
  const passiveIncome = record.income.filter((i) => i.subcategory === 'passive')
  const fixedExpenses = record.expenses.filter((e) => e.subcategory === 'fixed')
  const variableExpenses = record.expenses.filter((e) => e.subcategory === 'variable')
  const wealthExpenses = record.expenses.filter((e) => e.subcategory === 'wealth')

  return (
    <div className="max-w-3xl mx-auto px-2 md:px-0 py-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-6">
        <button onClick={() => goMonth(-1)} className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">‹ Prev</button>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">{labelMonth(yearMonth)}</h1>
          <p className="text-xs text-gray-400">Monthly P&L Statement</p>
        </div>
        <button onClick={() => goMonth(1)} className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Next ›</button>
      </div>

      {/* Income */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Income</h2>
          <span className="text-sm font-semibold tabular-nums text-emerald-600">{formatCurrency(metrics.totalRevenue, sym)}</span>
        </div>

        <SectionTable
          title="Active Income"
          accentColor="border-blue-400 bg-blue-50/30"
          items={activeIncome}
          showPerson
          settings={settings}
          onUpdate={(id, u) => updateIncome(id, u as Partial<IncomeLineItem>)}
          onDelete={deleteIncome}
        >
          <AddLineItemForm mode="income" subcategory="active" name1={settings.person1Name} name2={settings.person2Name} symbol={sym} onAdd={addIncome} />
        </SectionTable>

        <SectionTable
          title="Semi-Active Income"
          accentColor="border-indigo-400 bg-indigo-50/30"
          items={semiActiveIncome}
          showPerson
          settings={settings}
          onUpdate={(id, u) => updateIncome(id, u as Partial<IncomeLineItem>)}
          onDelete={deleteIncome}
        >
          <AddLineItemForm mode="income" subcategory="semi_active" name1={settings.person1Name} name2={settings.person2Name} symbol={sym} onAdd={addIncome} />
        </SectionTable>

        <SectionTable
          title="Passive Income"
          accentColor="border-teal-400 bg-teal-50/30"
          items={passiveIncome}
          showPerson
          settings={settings}
          onUpdate={(id, u) => updateIncome(id, u as Partial<IncomeLineItem>)}
          onDelete={deleteIncome}
        >
          <AddLineItemForm mode="income" subcategory="passive" name1={settings.person1Name} name2={settings.person2Name} symbol={sym} onAdd={addIncome} />
        </SectionTable>
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Expenses</h2>
          <span className="text-sm font-semibold tabular-nums text-red-500">{formatCurrency(metrics.totalExpenses, sym)}</span>
        </div>

        <SectionTable
          title="Fixed"
          accentColor="border-orange-400 bg-orange-50/30"
          items={fixedExpenses}
          settings={settings}
          onUpdate={(id, u) => updateExpense(id, u as Partial<ExpenseLineItem>)}
          onDelete={deleteExpense}
        >
          <AddLineItemForm mode="expense" subcategory="fixed" symbol={sym} onAdd={addExpense} />
        </SectionTable>

        <SectionTable
          title="Variable"
          accentColor="border-red-400 bg-red-50/30"
          items={variableExpenses}
          settings={settings}
          onUpdate={(id, u) => updateExpense(id, u as Partial<ExpenseLineItem>)}
          onDelete={deleteExpense}
        >
          <AddLineItemForm mode="expense" subcategory="variable" symbol={sym} onAdd={addExpense} />
        </SectionTable>
      </div>

      {/* Wealth Building */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Wealth Building</h2>
          <span className="text-sm font-semibold tabular-nums text-violet-600">{formatCurrency(metrics.wealthBuildingTotal, sym)}</span>
        </div>

        <SectionTable
          title="Investments & Savings"
          accentColor="border-violet-400 bg-violet-50/30"
          items={wealthExpenses}
          settings={settings}
          onUpdate={(id, u) => updateExpense(id, u as Partial<ExpenseLineItem>)}
          onDelete={deleteExpense}
        >
          <AddLineItemForm mode="expense" subcategory="wealth" symbol={sym} onAdd={addExpense} />
        </SectionTable>
      </div>

      {/* Metrics Summary */}
      <MetricsSummaryBar metrics={metrics} delta={delta} settings={settings} />

      {/* Monthly Review */}
      <ReviewSection
        record={record}
        delta={delta}
        lineItemDeltas={lineItemDeltas}
        priorYM={priorYM}
        settings={settings}
        onUpdateReview={updateReview}
      />
    </div>
  )
}
