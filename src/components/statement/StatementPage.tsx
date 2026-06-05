import { useNavigate } from 'react-router-dom'
import { format, addMonths, subMonths, parse } from 'date-fns'
import { useMonthData } from '../../hooks/useMonthData'
import { useComparison } from '../../hooks/useComparison'
import { useSettings } from '../../hooks/useSettings'
import { useNetWorth } from '../../hooks/useNetWorth'
import { SectionTable } from './SectionTable'
import { AddLineItemForm } from './AddLineItemForm'
import { FixedBillsSection } from './FixedBillsSection'
import { DebtMinimumsSection } from './DebtMinimumsSection'
import { RollingSection } from './RollingSection'
import { VariableSection } from './VariableSection'
import { DebtTrackingSection } from '../debt/DebtTrackingSection'
import { MetricsSummaryBar } from './MetricsSummaryBar'
import { ReviewSection } from '../review/ReviewSection'
import { formatCurrency, labelMonth } from '../../utils/formatting'
import { computeMetrics } from '../../utils/calculations'
import { buildDebtQueue } from '../../utils/debt'
import { getMonth, setMonth } from '../../utils/storage'
import { nanoid } from './nanoid'
import type { IncomeLineItem } from '../../types'

interface Props {
  yearMonth: string
}

export function StatementPage({ yearMonth }: Props) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { debts, updateDebt } = useNetWorth()
  const {
    record,
    addIncome, updateIncome, deleteIncome,
    addExpense, deleteExpense,
    updateReview,
    setDebtSnapshot, updateRolling,
    copyFromRecord,
  } = useMonthData(yearMonth)

  const { delta, priorYM, priorRecord, lineItemDeltas } = useComparison(record, debts)
  const metrics = computeMetrics(record, debts)

  const sym = settings.currencySymbol

  function goMonth(direction: -1 | 1) {
    const date = parse(yearMonth, 'yyyy-MM', new Date())
    const next = direction === 1 ? addMonths(date, 1) : subMonths(date, 1)
    navigate(`/statement/${format(next, 'yyyy-MM')}`)
  }

  function nextMonthRecord() {
    const date = parse(yearMonth, 'yyyy-MM', new Date())
    const nextYM = format(addMonths(date, 1), 'yyyy-MM')
    return {
      nextYM,
      record: getMonth(nextYM) ?? {
        yearMonth: nextYM,
        income: [],
        expenses: [],
        debtSnapshots: [],
        rolling: { amount: settings.rollingAmount, paidThisMonth: 0, targetDebtId: null },
        review: {
          targetDebtSnapshot: null,
          totalDebtSnapshot: null,
          snapshotTakenAt: null,
          oneStepIncomeTier: '',
          oneWin: '',
          oneToWatch: '',
          oneDecisionNext: '',
        },
        updatedAt: new Date().toISOString(),
      },
    }
  }

  function pushIncomeToNextMonth(item: IncomeLineItem) {
    const { nextYM, record: next } = nextMonthRecord()
    const exists = next.income.some((i) => i.label.toLowerCase() === item.label.toLowerCase())
    if (exists) return
    setMonth({ ...next, yearMonth: nextYM, income: [...next.income, { ...item, id: nanoid() }], updatedAt: new Date().toISOString() })
  }

  // Persist the monthly snapshot AND push the balance to the registry so Net Worth stays current.
  function handleSetSnapshot(debtId: string, data: { balance: number; minPayment: number }) {
    setDebtSnapshot(debtId, data)
    updateDebt(debtId, { balance: data.balance })
  }

  const activeIncome = record.income.filter((i) => i.subcategory === 'active')
  const semiActiveIncome = record.income.filter((i) => i.subcategory === 'semi_active')
  const passiveIncome = record.income.filter((i) => i.subcategory === 'passive')
  const fixedBills = record.expenses.filter((e) => e.subcategory === 'fixed_bill')
  const variableItems = record.expenses.filter((e) => e.subcategory === 'variable')
  const queue = buildDebtQueue(debts, settings.queueGrouping, record.rolling.amount)
  const queueTop = queue[0]?.debt ?? null

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

      {/* Copy-from-last-month banner */}
      {priorRecord && record.income.length === 0 && record.expenses.length === 0 && (
        <div className="mx-4 mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-blue-800">Start from last month?</p>
            <p className="text-xs text-blue-500 mt-0.5">Copy all entries from {labelMonth(priorYM!)} as a starting point — then edit what changed.</p>
          </div>
          <button
            onClick={() => copyFromRecord(priorRecord)}
            className="ml-4 flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Copy entries
          </button>
        </div>
      )}

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
          onPushToNext={(item) => pushIncomeToNextMonth(item as IncomeLineItem)}
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
          onPushToNext={(item) => pushIncomeToNextMonth(item as IncomeLineItem)}
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
          onPushToNext={(item) => pushIncomeToNextMonth(item as IncomeLineItem)}
        >
          <AddLineItemForm mode="income" subcategory="passive" name1={settings.person1Name} name2={settings.person2Name} symbol={sym} onAdd={addIncome} />
        </SectionTable>
      </div>

      {/* Expenses — Cash Waterfall tiers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Expenses</h2>
          <span className="text-sm font-semibold tabular-nums text-red-500">{formatCurrency(metrics.totalExpenses, sym)}</span>
        </div>

        <FixedBillsSection
          items={fixedBills}
          symbol={sym}
          onAdd={addExpense}
          onDelete={deleteExpense}
        />

        <DebtMinimumsSection
          kind="loan"
          debts={debts}
          snapshots={record.debtSnapshots}
          symbol={sym}
          onSetSnapshot={handleSetSnapshot}
        />

        <DebtMinimumsSection
          kind="credit_card"
          debts={debts}
          snapshots={record.debtSnapshots}
          symbol={sym}
          onSetSnapshot={handleSetSnapshot}
        />

        <RollingSection
          key={yearMonth}
          rolling={record.rolling}
          queueTop={queueTop}
          symbol={sym}
          onUpdate={updateRolling}
        />

        <VariableSection
          items={variableItems}
          symbol={sym}
          onAdd={addExpense}
          onDelete={deleteExpense}
        />
      </div>

      {/* Debt Tracking — sits below Expenses */}
      <DebtTrackingSection
        debts={debts}
        snapshots={record.debtSnapshots}
        grouping={settings.queueGrouping}
        rollingAmount={record.rolling.amount}
        symbol={sym}
      />

      {/* Metrics Summary */}
      <MetricsSummaryBar metrics={metrics} delta={delta} settings={settings} />

      {/* Monthly Review */}
      <ReviewSection
        record={record}
        metrics={metrics}
        delta={delta}
        lineItemDeltas={lineItemDeltas}
        priorReview={priorRecord?.review ?? null}
        priorRecord={priorRecord}
        settings={settings}
        onUpdateReview={updateReview}
      />
    </div>
  )
}
