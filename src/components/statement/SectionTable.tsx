import { useState } from 'react'
import clsx from 'clsx'
import type { IncomeLineItem, ExpenseLineItem, AppSettings } from '../../types'
import { LineItemRow } from './LineItemRow'
import { formatCurrency } from '../../utils/formatting'

type AnyItem = IncomeLineItem | ExpenseLineItem

interface Props {
  title: string
  accentColor: string
  items: AnyItem[]
  showPerson?: boolean
  settings: AppSettings
  children?: React.ReactNode
  onUpdate: (id: string, updates: Partial<AnyItem>) => void
  onDelete: (id: string) => void
  onPushToNext?: (item: AnyItem) => void
  onPushAllToNext?: () => void
}

export function SectionTable({
  title,
  accentColor,
  items,
  showPerson = false,
  settings,
  children,
  onUpdate,
  onDelete,
  onPushToNext,
  onPushAllToNext,
}: Props) {
  const [pushedAll, setPushedAll] = useState(false)

  function handlePushAll() {
    onPushAllToNext?.()
    setPushedAll(true)
    setTimeout(() => setPushedAll(false), 2000)
  }

  return (
    <div className="mb-1">
      <div className={clsx('flex items-center justify-between px-4 py-2 border-l-4', accentColor)}>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <span className="text-xs font-semibold tabular-nums text-gray-600">
              {formatCurrency(items.reduce((s, i) => s + i.amount, 0), settings.currencySymbol)}
            </span>
          )}
          {onPushAllToNext && items.length > 0 && (
            <button
              onClick={handlePushAll}
              title="Push entire category to next month"
              className={pushedAll
                ? 'text-emerald-500 text-xs px-1.5 py-0.5 rounded bg-emerald-50'
                : 'text-gray-400 hover:text-emerald-500 text-xs px-1.5 py-0.5 rounded hover:bg-emerald-50 transition-colors'}
            >
              {pushedAll ? '✓ all' : '→ all'}
            </button>
          )}
        </div>
      </div>
      <table className="w-full">
        <tbody>
          {items.map((item) => (
            <LineItemRow
              key={item.id}
              item={item}
              showPerson={showPerson}
              name1={settings.person1Name}
              name2={settings.person2Name}
              symbol={settings.currencySymbol}
              onUpdate={onUpdate as (id: string, updates: Partial<AnyItem>) => void}
              onDelete={onDelete}
              onPushToNext={onPushToNext}
            />
          ))}
          {children}
        </tbody>
      </table>
    </div>
  )
}
