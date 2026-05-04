import clsx from 'clsx'
import type { IncomeLineItem, ExpenseLineItem, AppSettings } from '../../types'
import { LineItemRow } from './LineItemRow'

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
}: Props) {
  return (
    <div className="mb-1">
      <div className={clsx('flex items-center gap-2 px-4 py-2 border-l-4', accentColor)}>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
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
