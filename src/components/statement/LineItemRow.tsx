import { useState } from 'react'
import type { IncomeLineItem, ExpenseLineItem, Person } from '../../types'
import { PersonBadge } from '../shared/PersonBadge'
import { CurrencyInput } from '../shared/CurrencyInput'
import { formatCurrency } from '../../utils/formatting'

type AnyItem = IncomeLineItem | ExpenseLineItem

interface Props {
  item: AnyItem
  showPerson?: boolean
  name1: string
  name2: string
  symbol?: string
  onUpdate: (id: string, updates: Partial<AnyItem>) => void
  onDelete: (id: string) => void
}

export function LineItemRow({ item, showPerson = true, name1, name2, symbol = '$', onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const [amount, setAmount] = useState(item.amount)

  function save() {
    onUpdate(item.id, { label, amount } as Partial<AnyItem>)
    setEditing(false)
  }

  function cancel() {
    setLabel(item.label)
    setAmount(item.amount)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="border-b border-gray-100">
        <td className="py-2 pl-4 pr-2">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </td>
        {showPerson && (
          <td className="py-2 px-2">
            <select
              value={item.person}
              onChange={(e) => onUpdate(item.id, { person: e.target.value as Person })}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="person1">{name1}</option>
              <option value="person2">{name2}</option>
              <option value="shared">Shared</option>
            </select>
          </td>
        )}
        <td className="py-2 px-2">
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            symbol={symbol}
            className="w-28 border border-blue-300 rounded pl-6 pr-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </td>
        <td className="py-2 pr-4 pl-2">
          <div className="flex gap-1">
            <button onClick={save} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium px-2 py-1 rounded hover:bg-emerald-50">Save</button>
            <button onClick={cancel} className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100">Cancel</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-50 group hover:bg-gray-50/50 transition-colors">
      <td className="py-2.5 pl-4 pr-2 text-sm text-gray-700">{item.label}</td>
      {showPerson && (
        <td className="py-2.5 px-2">
          <PersonBadge person={item.person} name1={name1} name2={name2} size="xs" />
        </td>
      )}
      <td className="py-2.5 px-2 text-sm text-right font-medium tabular-nums text-gray-800">
        {formatCurrency(item.amount, symbol)}
      </td>
      <td className="py-2.5 pr-4 pl-2">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-500 text-xs px-1.5 py-1 rounded hover:bg-blue-50 transition-colors">Edit</button>
          <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-50 transition-colors">✕</button>
        </div>
      </td>
    </tr>
  )
}
