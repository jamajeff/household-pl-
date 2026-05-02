import { useState } from 'react'
import { nanoid } from './nanoid'
import { CurrencyInput } from '../shared/CurrencyInput'
import type { IncomeLineItem, ExpenseLineItem, IncomeSubcategory, ExpenseSubcategory, Person } from '../../types'

interface IncomeProps {
  mode: 'income'
  subcategory: IncomeSubcategory
  name1: string
  name2: string
  symbol?: string
  onAdd: (item: IncomeLineItem) => void
}

interface ExpenseProps {
  mode: 'expense'
  subcategory: ExpenseSubcategory
  symbol?: string
  onAdd: (item: ExpenseLineItem) => void
}

type Props = IncomeProps | ExpenseProps

export function AddLineItemForm(props: Props) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState(0)
  const [person, setPerson] = useState<Person>('person1')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || amount <= 0) return

    if (props.mode === 'income') {
      props.onAdd({
        id: nanoid(),
        label: label.trim(),
        amount,
        person,
        subcategory: props.subcategory,
      } as IncomeLineItem)
    } else {
      props.onAdd({
        id: nanoid(),
        label: label.trim(),
        amount,
        person: 'shared',
        subcategory: props.subcategory,
      } as ExpenseLineItem)
    }

    setLabel('')
    setAmount(0)
    setOpen(false)
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={4} className="pb-1 pl-4">
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1 py-1"
          >
            <span className="text-base leading-none">+</span> Add item
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-blue-100 bg-blue-50/30">
      <td className="py-2 pl-4 pr-2">
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
          placeholder="Label"
          className="w-full border border-blue-200 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </td>
      {props.mode === 'income' && (
        <td className="py-2 px-2">
          <select
            value={person}
            onChange={(e) => setPerson(e.target.value as Person)}
            className="border border-blue-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="person1">{props.name1}</option>
            <option value="person2">{props.name2}</option>
            <option value="shared">Shared</option>
          </select>
        </td>
      )}
      {props.mode === 'expense' && <td />}
      <td className="py-2 px-2">
        <CurrencyInput
          value={amount}
          onChange={setAmount}
          symbol={props.symbol}
          className="w-28 border border-blue-200 rounded pl-6 pr-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </td>
      <td className="py-2 pr-4 pl-2">
        <div className="flex gap-1">
          <button onClick={submit} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium px-2 py-1 rounded hover:bg-emerald-50 bg-white border border-emerald-200">Add</button>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100">✕</button>
        </div>
      </td>
    </tr>
  )
}
