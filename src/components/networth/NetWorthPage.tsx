import { useState } from 'react'
import clsx from 'clsx'
import { useNetWorth } from '../../hooks/useNetWorth'
import { useSettings } from '../../hooks/useSettings'
import { NetWorthItem } from './NetWorthItem'
import { formatCurrency, parseCents } from '../../utils/formatting'
import { nanoid } from '../statement/nanoid'
import type { AssetCategory, DebtCategory } from '../../types'

const ASSET_CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: 'investment', label: 'Investment' },
  { value: 'savings', label: 'Savings' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'other', label: 'Other' },
]

const DEBT_CATEGORIES: { value: DebtCategory; label: string }[] = [
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'auto', label: 'Auto Loan' },
  { value: 'student', label: 'Student Loan' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'other', label: 'Other' },
]

const ASSET_COLORS: Record<AssetCategory, string> = {
  investment: 'bg-blue-100 text-blue-700',
  savings: 'bg-emerald-100 text-emerald-700',
  real_estate: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-600',
}

const DEBT_COLORS: Record<DebtCategory, string> = {
  mortgage: 'bg-orange-100 text-orange-700',
  auto: 'bg-red-100 text-red-700',
  student: 'bg-purple-100 text-purple-700',
  credit_card: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
}

function AddItemForm({ type, onAdd }: { type: 'asset' | 'debt'; onAdd: (label: string, value: number, category: string) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [category, setCategory] = useState(type === 'asset' ? 'investment' : 'mortgage')
  const categories = type === 'asset' ? ASSET_CATEGORIES : DEBT_CATEGORIES

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = parseCents(value)
    if (!label.trim() || cents <= 0) return
    onAdd(label.trim(), cents, category)
    setLabel('')
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1 px-3 py-2"
      >
        <span className="text-base leading-none">+</span>
        Add {type === 'asset' ? 'asset' : 'debt'}
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="px-3 py-3 bg-blue-50/40 rounded-lg mx-1 mb-1 space-y-2">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={type === 'asset' ? 'e.g. 401k, Brokerage, HYSA' : 'e.g. Mortgage, Car Loan'}
        className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-blue-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none flex-1"
        >
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="w-full pl-5 border border-blue-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="flex-1 bg-blue-600 text-white text-xs font-medium py-1.5 rounded hover:bg-blue-700 transition-colors">Add</button>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 text-xs px-3 py-1.5 rounded hover:bg-gray-100">Cancel</button>
      </div>
    </form>
  )
}

export function NetWorthPage() {
  const { settings } = useSettings()
  const sym = settings.currencySymbol
  const { assets, debts, totalAssets, totalDebts, netWorth, addAsset, updateAsset, deleteAsset, addDebt, updateDebt, deleteDebt } = useNetWorth()

  const isPositive = netWorth >= 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Net Worth Hero */}
      <div className="bg-gray-900 text-white rounded-2xl p-8 mb-6 text-center">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Net Worth</p>
        <p className={clsx('text-5xl font-bold tabular-nums mb-2', isPositive ? 'text-emerald-400' : 'text-red-400')}>
          {isPositive ? '' : '-'}{formatCurrency(Math.abs(netWorth), sym)}
        </p>
        <p className="text-xs text-gray-500">Total Assets − Total Debts</p>
        <div className="flex justify-center gap-8 mt-6 pt-6 border-t border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Total Assets</p>
            <p className="text-xl font-semibold text-emerald-400 tabular-nums">{formatCurrency(totalAssets, sym)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Total Debts</p>
            <p className="text-xl font-semibold text-red-400 tabular-nums">{formatCurrency(totalDebts, sym)}</p>
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assets */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Assets</h2>
            <span className="text-sm font-semibold tabular-nums text-emerald-600">{formatCurrency(totalAssets, sym)}</span>
          </div>
          <div className="py-1">
            {assets.length === 0 && (
              <p className="text-xs text-gray-300 px-3 py-3">No assets yet — add your first one below.</p>
            )}
            {assets.map((a) => (
              <NetWorthItem
                key={a.id}
                id={a.id}
                label={a.label}
                value={a.value}
                category={a.category}
                updatedAt={a.updatedAt}
                symbol={sym}
                accentColor={ASSET_COLORS[a.category]}
                onUpdate={updateAsset}
                onDelete={deleteAsset}
              />
            ))}
            <AddItemForm
              type="asset"
              onAdd={(label, value, category) =>
                addAsset({ id: nanoid(), label, value, category: category as AssetCategory, updatedAt: new Date().toISOString() })
              }
            />
          </div>
        </div>

        {/* Debts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Debts</h2>
            <span className="text-sm font-semibold tabular-nums text-red-500">{formatCurrency(totalDebts, sym)}</span>
          </div>
          <div className="py-1">
            {debts.length === 0 && (
              <p className="text-xs text-gray-300 px-3 py-3">No debts — add balances you're tracking.</p>
            )}
            {debts.map((d) => (
              <NetWorthItem
                key={d.id}
                id={d.id}
                label={d.label}
                value={d.balance}
                category={d.category}
                updatedAt={d.updatedAt}
                symbol={sym}
                accentColor={DEBT_COLORS[d.category]}
                onUpdate={(id, updates) => updateDebt(id, updates.value !== undefined ? { balance: updates.value } : updates)}
                onDelete={deleteDebt}
              />
            ))}
            <AddItemForm
              type="debt"
              onAdd={(label, value, category) =>
                addDebt({ id: nanoid(), label, balance: value, category: category as DebtCategory, updatedAt: new Date().toISOString() })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
