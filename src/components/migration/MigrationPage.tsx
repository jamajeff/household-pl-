import { useMemo, useState } from 'react'
import { getIndex, getMonth, setMonth, getDebts } from '../../utils/storage'
import { useNetWorth } from '../../hooks/useNetWorth'
import { classifyDebtKind, looksLikeDebt } from '../../utils/debtKeywords'
import { parseCents } from '../../utils/formatting'
import { nanoid } from '../statement/nanoid'
import type { ExpenseLineItem, Debt, DebtKind } from '../../types'

interface Candidate {
  label: string
  amount: number        // most-recent observed amount (used as min suggestion)
  kind: DebtKind
}

// Legacy records may carry subcategory 'fixed'/'variable'; treat them as untyped strings.
function legacyExpenses(): ExpenseLineItem[] {
  const all: ExpenseLineItem[] = []
  for (const ym of getIndex()) {
    const rec = getMonth(ym)
    if (rec) all.push(...rec.expenses)
  }
  return all
}

export function MigrationPage() {
  const { debts, addDebt } = useNetWorth()
  const [done, setDone] = useState(false)
  const existingLabels = useMemo(() => new Set(getDebts().map((d) => d.label.toLowerCase())), [])

  // Unique debt-like labels across all months that aren't already in the registry.
  const candidates = useMemo<Candidate[]>(() => {
    const map = new Map<string, Candidate>()
    for (const e of legacyExpenses()) {
      if (!looksLikeDebt(e.label)) continue
      if (existingLabels.has(e.label.toLowerCase())) continue
      const kind = classifyDebtKind(e.label) ?? 'loan'
      map.set(e.label.toLowerCase(), { label: e.label, amount: e.amount, kind })
    }
    return [...map.values()]
  }, [existingLabels])

  // Editable form state per candidate.
  const [forms, setForms] = useState<Record<string, { balance: string; apr: string; min: string; include: boolean }>>(
    () => Object.fromEntries(candidates.map((c) => [c.label, { balance: '', apr: '', min: String(c.amount / 100), include: true }])),
  )

  function update(label: string, patch: Partial<{ balance: string; apr: string; min: string; include: boolean }>) {
    setForms((f) => ({ ...f, [label]: { ...f[label], ...patch } }))
  }

  function importDebts() {
    for (const c of candidates) {
      const form = forms[c.label]
      if (!form?.include) continue
      const debt: Debt = {
        id: nanoid(),
        label: c.label,
        balance: parseCents(form.balance),
        apr: parseFloat(form.apr) || 0,
        minPayment: parseCents(form.min),
        kind: c.kind,
        autopay: true,
        category: c.kind === 'credit_card' ? 'credit_card' : 'student',
        ...(c.kind === 'loan' ? { loanType: 'student' } : {}),
        updatedAt: new Date().toISOString(),
      }
      addDebt(debt)
    }
    reclassifyExpenses()
    setDone(true)
  }

  // Rewrite every month's expenses: drop debt-like items (now in registry),
  // map legacy 'fixed' -> 'fixed_bill', leave 'variable' as-is.
  function reclassifyExpenses() {
    for (const ym of getIndex()) {
      const rec = getMonth(ym)
      if (!rec) continue
      const importedLabels = new Set(candidates.filter((c) => forms[c.label]?.include).map((c) => c.label.toLowerCase()))
      const expenses = rec.expenses
        .filter((e) => !importedLabels.has(e.label.toLowerCase()))
        .map((e) => {
          const sub = (e.subcategory as string) === 'variable' ? 'variable' : 'fixed_bill'
          return { ...e, subcategory: sub } as ExpenseLineItem
        })
      setMonth({ ...rec, expenses })
    }
  }

  if (done) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <p className="text-lg font-semibold text-emerald-800 mb-2">✓ Migration complete</p>
          <p className="text-sm text-emerald-700">Debts imported to the registry and expenses reclassified into tiers. Reload any open month to see the changes.</p>
          <button onClick={() => window.location.assign('/')} className="mt-4 bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-800">Go to dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Migrate data</h1>
      <p className="text-sm text-gray-400 mb-6">
        We scanned your months for debt-like expense items. Confirm balance, APR, and minimum for each, then import.
        Importing moves them into the debt registry and reclassifies the rest of your expenses into the new tiers.
      </p>

      {candidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm text-gray-500">No un-imported debt-like items found. You can still reclassify legacy expenses into tiers.</p>
          <button onClick={() => { reclassifyExpenses(); setDone(true) }} className="mt-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700">Reclassify expenses</button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {candidates.map((c) => {
              const f = forms[c.label]
              return (
                <div key={c.label} className={`bg-white rounded-xl border shadow-sm p-4 ${f?.include ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{c.label}</span>
                      <span className="ml-2 text-[11px] uppercase text-gray-400">{c.kind === 'credit_card' ? 'Credit Card' : 'Loan'}</span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <input type="checkbox" checked={f?.include ?? false} onChange={(e) => update(c.label, { include: e.target.checked })} /> Import
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Balance $" value={f?.balance ?? ''} onChange={(v) => update(c.label, { balance: v })} />
                    <Field label="APR %" value={f?.apr ?? ''} onChange={(v) => update(c.label, { apr: v })} />
                    <Field label="Min $" value={f?.min ?? ''} onChange={(v) => update(c.label, { min: v })} />
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={importDebts} className="mt-6 w-full bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-gray-700 font-medium">
            Import {Object.values(forms).filter((f) => f.include).length} debt(s) & reclassify expenses
          </button>
          <p className="text-xs text-gray-400 mt-2 text-center">Already have {debts.length} debt(s) in the registry — these are skipped automatically.</p>
        </>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase text-gray-400">{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
    </label>
  )
}
