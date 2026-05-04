import { useState } from 'react'
import clsx from 'clsx'
import { formatCurrency, parseCents } from '../../utils/formatting'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  id: string
  label: string
  value: number // cents
  category: string
  updatedAt: string
  symbol: string
  accentColor: string
  onUpdate: (id: string, updates: { label?: string; value?: number }) => void
  onDelete: (id: string) => void
}

export function NetWorthItem({ id, label, value, category, updatedAt, symbol, accentColor, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(label)
  const [editValue, setEditValue] = useState(String(value / 100))

  function save() {
    const cents = parseCents(editValue)
    onUpdate(id, { label: editLabel.trim() || label, value: cents })
    setEditing(false)
  }

  function cancel() {
    setEditLabel(label)
    setEditValue(String(value / 100))
    setEditing(false)
  }

  const ago = (() => {
    try { return formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) }
    catch { return '' }
  })()

  const categoryLabel = category.replace('_', ' ')

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 bg-blue-50/50 rounded-lg">
        <input
          autoFocus
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{symbol}</span>
          <input
            type="text"
            inputMode="decimal"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            className="w-32 pl-5 border border-blue-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <button onClick={save} className="text-emerald-600 text-xs font-medium px-2 py-1 rounded hover:bg-emerald-50">Save</button>
        <button onClick={cancel} className="text-gray-400 text-xs px-2 py-1 rounded hover:bg-gray-100">Cancel</button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg group hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className={clsx('text-xs px-1.5 py-0.5 rounded capitalize font-medium flex-shrink-0', accentColor)}>
          {categoryLabel}
        </span>
        <span className="text-sm text-gray-700 truncate">{label}</span>
        {ago && <span className="text-xs text-gray-300 hidden sm:block flex-shrink-0">{ago}</span>}
      </div>
      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
        <span className="text-sm font-semibold tabular-nums text-gray-800">
          {formatCurrency(value, symbol)}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-blue-500 text-xs px-1.5 py-1 rounded hover:bg-blue-50 transition-colors">Edit</button>
          <button onClick={() => onDelete(id)} className="text-gray-300 hover:text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-50 transition-colors">✕</button>
        </div>
      </div>
    </div>
  )
}
