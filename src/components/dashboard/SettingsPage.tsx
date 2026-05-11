import { useRef, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { exportAllData, importAllData } from '../../utils/storage'
import type { AppSettings } from '../../types'

export function SettingsPage() {
  const { settings, save } = useSettings()
  const [form, setForm] = useState<AppSettings>(settings)
  const [saved, setSaved] = useState(false)
  const [importError, setImportError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const data = exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `household-pl-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        const ok = importAllData(data)
        if (ok) {
          window.location.reload()
        } else {
          setImportError(true)
          setTimeout(() => setImportError(false), 3000)
        }
      } catch {
        setImportError(true)
        setTimeout(() => setImportError(false), 3000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

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

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Data</h2>
        <p className="text-sm text-gray-400 mb-4">
          Export your data as a backup file, or import a previously exported file to restore it.
        </p>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="w-full bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Export Data
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border border-gray-200 text-gray-700 text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            {importError ? '✗ Invalid file — try again' : 'Import Data'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          <p className="text-xs text-gray-400 text-center">
            Import will overwrite all current data and reload the page.
          </p>
        </div>
      </div>
    </div>
  )
}
