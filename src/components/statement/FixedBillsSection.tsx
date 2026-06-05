import { useState } from 'react'
import { nanoid } from './nanoid'
import { CurrencyInput } from '../shared/CurrencyInput'
import { formatCurrency } from '../../utils/formatting'
import { looksLikeDebt } from '../../utils/debtKeywords'
import type { ExpenseLineItem, FixedBillCategory } from '../../types'

const BILL_CATEGORIES: { value: FixedBillCategory; label: string }[] = [
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'leverage', label: 'Leverage' },
  { value: 'membership', label: 'Membership' },
]

interface Props {
  items: ExpenseLineItem[]
  symbol: string
  onAdd: (item: ExpenseLineItem) => void
  onUpdate: (id: string, updates: Partial<ExpenseLineItem>) => void
  onDelete: (id: string) => void
}

export function FixedBillsSection({ items, symbol, onAdd, onUpdate: _onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState(0)
  const [billCategory, setBillCategory] = useState<FixedBillCategory>('housing')
  const [autopay, setAutopay] = useState(true)
  const [note, setNote] = useState('')

  const subtotal = items.reduce((s, i) => s + i.amount, 0)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || amount <= 0) return
    if (looksLikeDebt(label)) {
      const ok = confirm('This looks like a debt payment. Did you mean to add it to Loan Minimums or Credit Card Minimums? Click OK to add it here anyway, or Cancel to go back.')
      if (!ok) return
    }
    onAdd({
      id: nanoid(),
      label: label.trim(),
      amount,
      person: 'shared',
      subcategory: 'fixed_bill',
      billCategory,
      autopay,
      note: note.trim() || undefined,
    })
    setLabel(''); setAmount(0); setNote(''); setOpen(false)
  }

  return (
    <div className="mb-1">
      <div className="flex items-center justify-between px-4 py-2 border-l-4 border-orange-400 bg-orange-50/30">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tier 2 — Fixed Bills</span>
        <span className="text-xs font-semibold tabular-nums text-gray-600">Tier 2 total: {formatCurrency(subtotal, symbol)}/month</span>
      </div>
      <table className="w-full">
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-50 group hover:bg-gray-50/50">
              <td className="py-2.5 pl-4 pr-2 text-sm text-gray-700">
                {item.label}
                {item.billCategory && <span className="ml-2 text-[11px] text-gray-400 uppercase">{item.billCategory}</span>}
                {item.autopay && <span className="ml-1.5 text-[11px] text-emerald-500">autopay</span>}
                {item.note && <span className="block text-[11px] text-gray-400">{item.note}</span>}
              </td>
              <td className="py-2.5 px-2 text-sm text-right font-medium tabular-nums text-gray-800">{formatCurrency(item.amount, symbol)}</td>
              <td className="py-2.5 pr-4 pl-2">
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                  <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-50">✕</button>
                </div>
              </td>
            </tr>
          ))}
          {open ? (
            <tr className="bg-orange-50/40">
              <td colSpan={3} className="p-3">
                <form onSubmit={submit} className="space-y-2">
                  <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name (e.g. Apartment)"
                    className="w-full border border-orange-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <div className="flex gap-2">
                    <select value={billCategory} onChange={(e) => setBillCategory(e.target.value as FixedBillCategory)} className="border border-orange-200 rounded px-2 py-1.5 text-xs bg-white flex-1">
                      {BILL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <CurrencyInput value={amount} onChange={setAmount} symbol={symbol}
                      className="w-32 border border-orange-200 rounded pl-6 pr-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes (optional)"
                    className="w-full border border-orange-200 rounded px-2 py-1.5 text-sm bg-white" />
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={autopay} onChange={(e) => setAutopay(e.target.checked)} /> Autopay
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-orange-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-orange-700">Add</button>
                    <button type="button" onClick={() => setOpen(false)} className="text-gray-400 text-xs px-3 py-1.5 rounded hover:bg-gray-100">Cancel</button>
                  </div>
                </form>
              </td>
            </tr>
          ) : (
            <tr>
              <td colSpan={3} className="pb-1 pl-4">
                <button onClick={() => setOpen(true)} className="text-xs text-gray-400 hover:text-orange-500 flex items-center gap-1 py-1">
                  <span className="text-base leading-none">+</span> Add fixed bill
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
