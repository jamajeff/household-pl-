import { useState } from 'react'
import { parseCents } from '../../utils/formatting'

interface Props {
  value: number // cents
  onChange: (cents: number) => void
  symbol?: string
  className?: string
  placeholder?: string
}

export function CurrencyInput({ value, onChange, symbol = '$', className, placeholder }: Props) {
  const [display, setDisplay] = useState(value > 0 ? String(value / 100) : '')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplay(e.target.value)
    onChange(parseCents(e.target.value))
  }

  const handleBlur = () => {
    const cents = parseCents(display)
    setDisplay(cents > 0 ? String(cents / 100) : '')
    onChange(cents)
  }

  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">
        {symbol}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder ?? '0'}
        className={`pl-6 ${className ?? 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'}`}
      />
    </div>
  )
}
