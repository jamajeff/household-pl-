import { useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import type { AppSettings } from '../../types'

export function SettingsPage() {
  const { settings, save } = useSettings()
  const [form, setForm] = useState<AppSettings>(settings)
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    save(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-400 mb-6">Configure your household P&L preferences.</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Person 1 Name
          </label>
          <input
            value={form.person1Name}
            onChange={(e) => setForm({ ...form, person1Name: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="e.g. Alex"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Person 2 Name
          </label>
          <input
            value={form.person2Name}
            onChange={(e) => setForm({ ...form, person2Name: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="e.g. Jordan"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Currency Symbol
          </label>
          <input
            value={form.currencySymbol}
            onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
            maxLength={3}
            className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="$"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
