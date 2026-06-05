import { useState } from 'react'
import { nanoid } from './nanoid'
import { CurrencyInput } from '../shared/CurrencyInput'
import { formatCurrency } from '../../utils/formatting'
import type { ExpenseLineItem, VariableCategory } from '../../types'

const VAR_CATEGORIES: { value: VariableCategory; label: string }[] = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'dining', label: 'Dining' },
  { value: 'gas', label: 'Gas' },
  { value: 'household', label: 'Household' },
  { value: 'gifts', label: 'Gifts' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
]

interface Props {
  items: ExpenseLineItem[]
  symbol: string
  onAdd: (item: ExpenseLineItem) => void
  onUpdate: (id: string, updates: Partial<ExpenseLineItem>) => void
  onDelete: (id: string) => void
}

export function VariableSection({ items, symbol, onAdd, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState(0)
  const [variableCategory, setVariableCategory] = useState<VariableCategory>('groceries')

  const subtotal = items.reduce((s, i) => s + i.amount, 0)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || amount <= 0) return
    onAdd({ id: nanoid(), label: label.trim(), amount, person: 'shared', subcategory: 'variable', variableCategory })
    setLabel(''); setAmount(0); setOpen(false)
  }

  return (
    <div className="mb-1">
      <div className="flex items-center justify-between px-4 py-2 border-l-4 border-red-400 bg-red-50/30">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tier 7 — Variable / Discretionary</span>
        <span className="text-xs font-semibold tabular-nums text-gray-600">{formatCurrency(subtotal, symbol)}</span>
      </div>
      <table className="w-full">
        <tbody>
          {items.map((item) => (
            <VariableRow key={item.id} item={item} symbol={symbol} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
          {open ? (
            <tr className="bg-red-50/40">
              <td colSpan={3} className="p-3">
                <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
                  <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label"
                    className="flex-1 min-w-40 border border-red-200 rounded px-2 py-1.5 text-sm bg-white" />
                  <select value={variableCategory} onChange={(e) => setVariableCategory(e.target.value as VariableCategory)} className="border border-red-200 rounded px-2 py-1.5 text-xs bg-white">
                    {VAR_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <CurrencyInput value={amount} onChange={setAmount} symbol={symbol}
                    className="w-28 border border-red-200 rounded pr-2 py-1.5 text-sm bg-white" />
                  <button type="submit" className="bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-red-600">Add</button>
                  <button type="button" onClick={() => setOpen(false)} className="text-gray-400 text-xs px-2 py-1.5 rounded hover:bg-gray-100">✕</button>
                </form>
              </td>
            </tr>
          ) : (
            <tr>
              <td colSpan={3} className="pb-1 pl-4">
                <button onClick={() => setOpen(true)} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 py-1">
                  <span className="text-base leading-none">+</span> Add variable expense
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function VariableRow({
  item, symbol, onUpdate, onDelete,
}: {
  item: ExpenseLineItem
  symbol: string
  onUpdate: (id: string, updates: Partial<ExpenseLineItem>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const [amount, setAmount] = useState(item.amount)
  const [variableCategory, setVariableCategory] = useState<VariableCategory>(item.variableCategory ?? 'other')

  function save() {
    if (!label.trim() || amount <= 0) return
    onUpdate(item.id, { label: label.trim(), amount, variableCategory })
    setEditing(false)
  }

  function cancel() {
    setLabel(item.label)
    setAmount(item.amount)
    setVariableCategory(item.variableCategory ?? 'other')
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-red-50/40">
        <td colSpan={3} className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
              className="flex-1 min-w-40 border border-red-200 rounded px-2 py-1.5 text-sm bg-white" />
            <select value={variableCategory} onChange={(e) => setVariableCategory(e.target.value as VariableCategory)} className="border border-red-200 rounded px-2 py-1.5 text-xs bg-white">
              {VAR_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <CurrencyInput value={amount} onChange={setAmount} symbol={symbol}
              className="w-28 border border-red-200 rounded pr-2 py-1.5 text-sm bg-white" />
            <button onClick={save} className="bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-red-600">Save</button>
            <button onClick={cancel} className="text-gray-400 text-xs px-2 py-1.5 rounded hover:bg-gray-100">Cancel</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-50 group hover:bg-gray-50/50">
      <td className="py-2.5 pl-4 pr-2 text-sm text-gray-700">
        {item.label}
        {item.variableCategory && <span className="ml-2 text-[11px] text-gray-400 uppercase">{item.variableCategory}</span>}
      </td>
      <td className="py-2.5 px-2 text-sm text-right font-medium tabular-nums text-gray-800">{formatCurrency(item.amount, symbol)}</td>
      <td className="py-2.5 pr-4 pl-2">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-500 text-xs px-1.5 py-1 rounded hover:bg-blue-50">Edit</button>
          <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-50">✕</button>
        </div>
      </td>
    </tr>
  )
}
