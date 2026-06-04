# Monthly Review Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the freeform Monthly Review section with a structured, mostly-auto-filled template (headline, burn rate vs target, debt block, income tiering, three "this month" prompts) so the section takes ~3 minutes per month instead of producing blank-page tax.

**Architecture:** Pure utility functions (`monthsToClearDebt`, `addMonthsToYearMonth`, `formatHeadline`) in `src/utils/calculations.ts`. Data shape changes on `ReviewData` (per-month debt snapshots + 4 freeform strings) and `AppSettings` (`targetBurnRatePct`, `targetDebtId`). `ReviewSection.tsx` rebuilt to render live-computed lines + freeform inputs; existing Delta Highlights and Line Item Changes blocks at the bottom are kept unchanged. `SettingsPage.tsx` gains a "Targets" section.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind 4, date-fns, react-router-dom 7. Adding `vitest` as a devDep for TDD on the pure utility functions; existing localStorage-backed storage layer is reused.

**Reference spec:** `docs/superpowers/specs/2026-06-04-monthly-review-template-design.md`
**Reference mockup:** `mockups/monthly-review-mockup.html`

---

## File Structure

**Modify:**
- `package.json` — add `vitest` devDep + `test` script
- `vite.config.ts` — add vitest config block
- `src/types/index.ts` — replace `ReviewData`, extend `AppSettings`
- `src/utils/storage.ts` — extend `DEFAULT_SETTINGS`
- `src/utils/calculations.ts` — add 3 pure helpers
- `src/hooks/useMonthData.ts` — update `emptyRecord` default review shape
- `src/components/dashboard/SettingsPage.tsx` — add Targets section
- `src/components/review/ReviewSection.tsx` — full rebuild

**Create:**
- `src/utils/calculations.test.ts` — tests for the 3 new helpers

---

## Task 1: Vitest setup

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/utils/calculations.test.ts`

- [ ] **Step 1: Install vitest**

Run from `~/household-pl`:
```bash
npm install --save-dev vitest@^2.0.0
```
Expected: `package.json` and `package-lock.json` updated; no errors.

- [ ] **Step 2: Add `test` script to package.json**

Edit `package.json` `scripts` block to add:
```json
"test": "vitest run",
"test:watch": "vitest"
```
Final scripts section should read:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
},
```

- [ ] **Step 3: Add vitest config to vite.config.ts**

Replace `vite.config.ts` contents with:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Write a smoke test**

Create `src/utils/calculations.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run tests, confirm smoke test passes**

Run: `npm test`
Expected: One test file, one passing test, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/utils/calculations.test.ts
git commit -m "Add vitest for utility function tests"
```

---

## Task 2: TDD `monthsToClearDebt`

**Files:**
- Modify: `src/utils/calculations.ts`
- Modify: `src/utils/calculations.test.ts`

Pure function: given a balance (cents) and amount paid this month (cents), return months remaining to clear, or `null` if paid ≤ 0 (can't extrapolate).

- [ ] **Step 1: Write failing tests**

Add to `src/utils/calculations.test.ts` (replace the smoke `describe` block):
```ts
import { describe, it, expect } from 'vitest'
import { monthsToClearDebt } from './calculations'

describe('monthsToClearDebt', () => {
  it('returns exact months when balance is divisible by paid', () => {
    expect(monthsToClearDebt(1_000_000, 50_000)).toBe(20) // $10,000 / $500
  })

  it('rounds up partial months', () => {
    expect(monthsToClearDebt(1_000_001, 50_000)).toBe(21)
  })

  it('returns null when paid is zero', () => {
    expect(monthsToClearDebt(1_000_000, 0)).toBeNull()
  })

  it('returns null when paid is negative (balance went up)', () => {
    expect(monthsToClearDebt(1_000_000, -1_000)).toBeNull()
  })

  it('returns 0 when balance is already zero', () => {
    expect(monthsToClearDebt(0, 50_000)).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npm test`
Expected: All 5 `monthsToClearDebt` tests fail with `monthsToClearDebt is not a function` (or import error).

- [ ] **Step 3: Implement `monthsToClearDebt`**

Append to `src/utils/calculations.ts`:
```ts
export function monthsToClearDebt(balanceCents: number, paidThisMonthCents: number): number | null {
  if (paidThisMonthCents <= 0) return null
  if (balanceCents <= 0) return 0
  return Math.ceil(balanceCents / paidThisMonthCents)
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npm test`
Expected: All 5 `monthsToClearDebt` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calculations.ts src/utils/calculations.test.ts
git commit -m "Add monthsToClearDebt utility"
```

---

## Task 3: TDD `addMonthsToYearMonth`

**Files:**
- Modify: `src/utils/calculations.ts`
- Modify: `src/utils/calculations.test.ts`

Pure function: given a `"YYYY-MM"` string and an integer month offset, return the resulting `"YYYY-MM"`. Used to project the "clear by" month. Reuses `date-fns` (already a dependency).

- [ ] **Step 1: Write failing tests**

Add to `src/utils/calculations.test.ts`:
```ts
import { addMonthsToYearMonth } from './calculations'

describe('addMonthsToYearMonth', () => {
  it('returns same month for offset 0', () => {
    expect(addMonthsToYearMonth('2026-06', 0)).toBe('2026-06')
  })

  it('advances within the same year', () => {
    expect(addMonthsToYearMonth('2026-06', 3)).toBe('2026-09')
  })

  it('crosses year boundary', () => {
    expect(addMonthsToYearMonth('2026-12', 1)).toBe('2027-01')
  })

  it('handles large offsets', () => {
    expect(addMonthsToYearMonth('2026-06', 24)).toBe('2028-06')
  })

  it('handles non-multiple-of-12 large offsets', () => {
    expect(addMonthsToYearMonth('2026-06', 7)).toBe('2027-01')
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npm test`
Expected: All 5 `addMonthsToYearMonth` tests fail with import error.

- [ ] **Step 3: Implement `addMonthsToYearMonth`**

Add to the top of `src/utils/calculations.ts`:
```ts
import { addMonths, format, parse } from 'date-fns'
```

Append the function (keep `monthsToClearDebt` from Task 2):
```ts
export function addMonthsToYearMonth(yearMonth: string, months: number): string {
  const date = parse(yearMonth, 'yyyy-MM', new Date())
  return format(addMonths(date, months), 'yyyy-MM')
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npm test`
Expected: All `monthsToClearDebt` and `addMonthsToYearMonth` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calculations.ts src/utils/calculations.test.ts
git commit -m "Add addMonthsToYearMonth utility"
```

---

## Task 4: TDD `formatHeadline`

**Files:**
- Modify: `src/utils/calculations.ts`
- Modify: `src/utils/calculations.test.ts`

Pure function: produces the headline string used at the top of the review template. Takes the net cash flow (cents), the delta vs prior month (cents, or `null` if no prior month), and a `formatCurrency` callback (injected to avoid coupling to the symbol).

- [ ] **Step 1: Write failing tests**

Add to `src/utils/calculations.test.ts`:
```ts
import { formatHeadline } from './calculations'

describe('formatHeadline', () => {
  const fmt = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(0)}`

  it('omits delta clause when no prior month', () => {
    expect(formatHeadline(470_000, null, fmt))
      .toBe('Net cash flow was $4700.')
  })

  it('shows "up" when delta is positive', () => {
    expect(formatHeadline(470_000, 150_000, fmt))
      .toBe('Net cash flow was $4700 (up $1500 vs last month).')
  })

  it('shows "down" when delta is negative', () => {
    expect(formatHeadline(320_000, -150_000, fmt))
      .toBe('Net cash flow was $3200 (down $1500 vs last month).')
  })

  it('omits delta clause when delta is exactly zero', () => {
    expect(formatHeadline(470_000, 0, fmt))
      .toBe('Net cash flow was $4700.')
  })

  it('formats negative net cash flow', () => {
    const fmtNeg = (cents: number) => cents < 0 ? `-$${(Math.abs(cents) / 100).toFixed(0)}` : `$${(cents / 100).toFixed(0)}`
    expect(formatHeadline(-200_000, null, fmtNeg))
      .toBe('Net cash flow was -$2000.')
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npm test`
Expected: 5 new `formatHeadline` tests fail with import error.

- [ ] **Step 3: Implement `formatHeadline`**

Append to `src/utils/calculations.ts`:
```ts
export function formatHeadline(
  netCashFlowCents: number,
  deltaVsPriorCents: number | null,
  formatCurrency: (cents: number) => string,
): string {
  const head = `Net cash flow was ${formatCurrency(netCashFlowCents)}`
  if (deltaVsPriorCents === null || deltaVsPriorCents === 0) {
    return `${head}.`
  }
  const direction = deltaVsPriorCents > 0 ? 'up' : 'down'
  const magnitude = formatCurrency(Math.abs(deltaVsPriorCents))
  return `${head} (${direction} ${magnitude} vs last month).`
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npm test`
Expected: All tests across `monthsToClearDebt`, `addMonthsToYearMonth`, `formatHeadline` pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calculations.ts src/utils/calculations.test.ts
git commit -m "Add formatHeadline utility"
```

---

## Task 5: Update types and defaults

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/utils/storage.ts`
- Modify: `src/hooks/useMonthData.ts`
- Modify: `src/components/statement/StatementPage.tsx` (one literal only — full ReviewSection wiring is Task 7)

Replace `ReviewData` with the new shape, extend `AppSettings` with two target fields, update the storage default settings, the `emptyRecord` default in `useMonthData`, sanitize `getMonth()` reads so pre-existing records don't leave new fields as `undefined`, and fix the one inline review literal in `StatementPage.nextMonthRecord()`. Keep these tightly coupled in one commit because partial changes won't typecheck.

- [ ] **Step 1: Update `ReviewData` and `AppSettings` in `src/types/index.ts`**

Locate `export interface ReviewData` (around line 42) and replace it with:
```ts
export interface ReviewData {
  targetDebtSnapshot: number | null   // target debt balance at month-end, in cents
  totalDebtSnapshot: number | null    // sum of all debt balances at month-end, in cents
  snapshotTakenAt: string | null      // ISO timestamp of last snapshot
  oneStepIncomeTier: string           // freeform — bottom-two leverage action
  oneWin: string
  oneToWatch: string
  oneDecisionNext: string
}
```

Locate `export interface AppSettings` (around line 55) and replace with:
```ts
export interface AppSettings {
  person1Name: string
  person2Name: string
  currencySymbol: string
  targetBurnRatePct: number | null    // e.g., 70 means target <70%
  targetDebtId: string | null         // id of a Debt record from net worth
}
```

- [ ] **Step 2: Update `DEFAULT_SETTINGS` in `src/utils/storage.ts`**

Locate the `DEFAULT_SETTINGS` const (around line 19) and replace with:
```ts
const DEFAULT_SETTINGS: AppSettings = {
  person1Name: 'Person 1',
  person2Name: 'Person 2',
  currencySymbol: '$',
  targetBurnRatePct: null,
  targetDebtId: null,
}
```

- [ ] **Step 3: Update `emptyRecord` in `src/hooks/useMonthData.ts`**

Locate the `emptyRecord` function (line 7) and replace the `review:` line. The full function should read:
```ts
function emptyRecord(yearMonth: string): MonthRecord {
  return {
    yearMonth,
    income: [],
    expenses: [],
    review: {
      targetDebtSnapshot: null,
      totalDebtSnapshot: null,
      snapshotTakenAt: null,
      oneStepIncomeTier: '',
      oneWin: '',
      oneToWatch: '',
      oneDecisionNext: '',
    },
    updatedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: Sanitize `getMonth()` so pre-existing records get new defaults**

In `src/utils/storage.ts`, update the imports at the top to include `ReviewData`:
```ts
import type { AppSettings, MonthRecord, Asset, Debt, ReviewData } from '../types'
```

Add a default review constant after `DEFAULT_SETTINGS`:
```ts
const DEFAULT_REVIEW: ReviewData = {
  targetDebtSnapshot: null,
  totalDebtSnapshot: null,
  snapshotTakenAt: null,
  oneStepIncomeTier: '',
  oneWin: '',
  oneToWatch: '',
  oneDecisionNext: '',
}
```

Replace the existing `getMonth()` function with:
```ts
export function getMonth(yearMonth: string): MonthRecord | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${yearMonth}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MonthRecord & { review?: Partial<ReviewData> }
    const r = parsed.review ?? {}
    return {
      ...parsed,
      review: {
        targetDebtSnapshot: r.targetDebtSnapshot ?? null,
        totalDebtSnapshot: r.totalDebtSnapshot ?? null,
        snapshotTakenAt: r.snapshotTakenAt ?? null,
        oneStepIncomeTier: r.oneStepIncomeTier ?? '',
        oneWin: r.oneWin ?? '',
        oneToWatch: r.oneToWatch ?? '',
        oneDecisionNext: r.oneDecisionNext ?? '',
      },
    }
  } catch {
    return null
  }
}
```

This is the "passive migration" described in the spec: old `keyChanges`/`actionItems` keys are dropped from the returned record; new fields default appropriately. The next save writes the clean shape.

- [ ] **Step 5: Fix the inline review literal in `StatementPage.nextMonthRecord()`**

In `src/components/statement/StatementPage.tsx`, locate `nextMonthRecord()` (around line 42). The inline fallback record on line 51 uses the old shape:
```ts
review: { keyChanges: '', actionItems: ['', '', ''] as [string, string, string] },
```

Replace that line with:
```ts
review: {
  targetDebtSnapshot: null,
  totalDebtSnapshot: null,
  snapshotTakenAt: null,
  oneStepIncomeTier: '',
  oneWin: '',
  oneToWatch: '',
  oneDecisionNext: '',
},
```

- [ ] **Step 6: Verify typecheck passes**

Run: `npx tsc -b`
Expected: Exit code 0. Remaining type errors should ONLY be in `src/components/review/ReviewSection.tsx` (still references the old shape; rebuilt in Task 7). If errors appear elsewhere, fix them before continuing.

- [ ] **Step 7: Run unit tests to confirm utility tests still pass**

Run: `npm test`
Expected: All utility tests pass (utilities don't depend on the new types).

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/utils/storage.ts src/hooks/useMonthData.ts src/components/statement/StatementPage.tsx
git commit -m "Update ReviewData and AppSettings shapes for review template

ReviewData replaces keyChanges + actionItems with per-month debt snapshots
and four freeform fields. AppSettings gains targetBurnRatePct and
targetDebtId. Defaults updated in storage, useMonthData, and the
StatementPage next-month fallback. getMonth() now sanitizes review on read
so pre-existing records get new field defaults instead of undefined.
ReviewSection rebuild follows in Task 7."
```

---

## Task 6: Add Targets section to SettingsPage

**Files:**
- Modify: `src/components/dashboard/SettingsPage.tsx`

Add a "Targets" section between the existing settings form and the "Data" section, with a numeric input for target burn rate and a dropdown for the #1 target debt. The dropdown reads from the net worth store via `useNetWorth`.

- [ ] **Step 1: Update imports in `src/components/dashboard/SettingsPage.tsx`**

Replace the top imports (lines 1-4) with:
```ts
import { useRef, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useNetWorth } from '../../hooks/useNetWorth'
import { exportAllData, importAllData } from '../../utils/storage'
import type { AppSettings } from '../../types'
```

- [ ] **Step 2: Read debts inside the component**

After `const { settings, save } = useSettings()` (around line 7), add:
```ts
const { debts } = useNetWorth()
```

- [ ] **Step 3: Insert the Targets section in JSX**

Locate the closing `</form>` tag (around line 103). Immediately AFTER it (before the `<div className="mt-8">` for "Data"), insert:
```tsx
<div className="mt-8">
  <h2 className="text-lg font-semibold text-gray-900 mb-1">Targets</h2>
  <p className="text-sm text-gray-400 mb-4">
    Used to populate the Monthly Review template.
  </p>
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        Target burn rate (%)
      </label>
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={form.targetBurnRatePct ?? ''}
        onChange={(e) => {
          const raw = e.target.value
          setForm({
            ...form,
            targetBurnRatePct: raw === '' ? null : Number(raw),
          })
        }}
        className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="70"
      />
      <p className="text-xs text-gray-400 mt-1.5">Review shows "(target: &lt;NN%)"; leave blank to hide.</p>
    </div>

    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        #1 target debt
      </label>
      <select
        value={form.targetDebtId ?? ''}
        onChange={(e) => setForm({
          ...form,
          targetDebtId: e.target.value === '' ? null : e.target.value,
        })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      >
        <option value="">— None —</option>
        {debts.map((d) => (
          <option key={d.id} value={d.id}>{d.label}</option>
        ))}
      </select>
      <p className="text-xs text-gray-400 mt-1.5">
        Pick the debt you're attacking first. Manage debts on the Net Worth page.
      </p>
    </div>

    <button
      type="button"
      onClick={() => {
        save(form)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }}
      className="w-full bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
    >
      {saved ? '✓ Saved' : 'Save Targets'}
    </button>
  </div>
</div>
```

Note: this reuses the existing `form`, `setForm`, `saved`, `setSaved`, and `save()` from the surrounding component. The targets share the same form state as person names — one save commits all changes. The dedicated "Save Targets" button is a UX convenience; clicking either save button persists everything.

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc -b`
Expected: No errors in `SettingsPage.tsx`. Errors in `ReviewSection.tsx` are still expected and addressed in Task 7.

- [ ] **Step 5: Browser verification**

Run the dev server:
```bash
npm run dev
```
Open the printed local URL, navigate to Settings (`/settings`).

Verify:
1. A new "Targets" card appears between the main settings form and the "Data" card.
2. The burn rate input accepts numbers 0–100; entering "70" and clicking "Save Targets" shows ✓ Saved briefly.
3. The target debt dropdown shows "— None —" plus all debts currently in the net worth page (if none exist, dropdown shows only "— None —").
4. After saving, reload the page — both fields retain their values (persisted to localStorage).
5. No console errors.

Stop the dev server with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/SettingsPage.tsx
git commit -m "Add Targets section to Settings page

Burn rate % and #1 target debt selection. Used by the rebuilt
Monthly Review template (next commit)."
```

---

## Task 7: Rebuild ReviewSection

**Files:**
- Modify: `src/components/review/ReviewSection.tsx`

Full rebuild of the Monthly Review section per the spec. Keeps the existing card chrome, Delta Highlights, and Line Item Changes blocks. Adds: Headline, Burn rate, Debt block (with snapshot button), Income tiering, "This month" inputs.

Reference for visual design: `mockups/monthly-review-mockup.html`.

- [ ] **Step 1: Replace `src/components/review/ReviewSection.tsx` entirely**

Replace the entire file with:
```tsx
import clsx from 'clsx'
import type {
  MonthRecord,
  MonthDelta,
  LineItemDelta,
  ReviewData,
  AppSettings,
  MonthMetrics,
  Debt,
} from '../../types'
import { DeltaBadge } from '../shared/DeltaBadge'
import { formatCurrency, formatPct, labelMonth } from '../../utils/formatting'
import {
  deltaDirection,
  formatHeadline,
  monthsToClearDebt,
  addMonthsToYearMonth,
} from '../../utils/calculations'
import { useNetWorth } from '../../hooks/useNetWorth'

interface Props {
  record: MonthRecord
  metrics: MonthMetrics
  delta: MonthDelta | null
  lineItemDeltas: LineItemDelta[]
  priorYM: string | null
  priorReview: ReviewData | null
  settings: AppSettings
  onUpdateReview: (review: ReviewData) => void
}

const DELTA_FIELDS: { field: keyof MonthDelta; label: string; format: 'currency' | 'pp' }[] = [
  { field: 'totalRevenue', label: 'Revenue', format: 'currency' },
  { field: 'totalExpenses', label: 'Expenses', format: 'currency' },
  { field: 'netCashFlow', label: 'Net Cash Flow', format: 'currency' },
  { field: 'burnRate', label: 'Burn Rate', format: 'pp' },
]

function formatSnapshotDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ReviewSection({
  record,
  metrics,
  delta,
  lineItemDeltas,
  priorYM,
  priorReview,
  settings,
  onUpdateReview,
}: Props) {
  const { currencySymbol: sym } = settings
  const { review } = record
  const { debts } = useNetWorth()

  const fmt = (c: number) => formatCurrency(c, sym)
  const headline = formatHeadline(metrics.netCashFlow, delta?.netCashFlow ?? null, fmt)

  // Burn rate target display
  const burnTargetText = settings.targetBurnRatePct === null
    ? '(target: set in Settings)'
    : `(target: <${settings.targetBurnRatePct}%)`

  // Target debt lookup
  const targetDebt: Debt | undefined = settings.targetDebtId
    ? debts.find((d) => d.id === settings.targetDebtId)
    : undefined

  // Total debt — snapshot if set, else live sum
  const liveTotalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const totalDebtDisplay = review.totalDebtSnapshot !== null ? review.totalDebtSnapshot : liveTotalDebt
  const totalDebtIsLive = review.totalDebtSnapshot === null

  // Total debt delta
  const totalDebtDelta = (review.totalDebtSnapshot !== null && priorReview?.totalDebtSnapshot != null)
    ? priorReview.totalDebtSnapshot - review.totalDebtSnapshot
    : null

  // Target debt "balance now" — snapshot if set, else live balance
  const targetBalanceDisplay = review.targetDebtSnapshot !== null
    ? review.targetDebtSnapshot
    : (targetDebt?.balance ?? null)
  const targetBalanceIsLive = review.targetDebtSnapshot === null && targetDebt !== undefined

  // Paid this month
  const paidThisMonth = (review.targetDebtSnapshot !== null && priorReview?.targetDebtSnapshot != null)
    ? priorReview.targetDebtSnapshot - review.targetDebtSnapshot
    : null

  // Clear-by projection
  let clearBy: string | null = null
  if (targetBalanceDisplay !== null && paidThisMonth !== null) {
    const months = monthsToClearDebt(targetBalanceDisplay, paidThisMonth)
    if (months !== null) clearBy = labelMonth(addMonthsToYearMonth(record.yearMonth, months))
  }

  // Income tier %
  const totalRevenue = metrics.totalRevenue
  const tierPct = (amount: number) => totalRevenue > 0 ? (amount / totalRevenue) * 100 : null

  // Snapshot action
  function takeSnapshot() {
    if (review.snapshotTakenAt) {
      const prev = formatSnapshotDate(review.snapshotTakenAt)
      if (!confirm(`Overwrite existing snapshot from ${prev}?`)) return
    }
    if (!targetDebt) {
      alert('Set #1 target debt in Settings before snapshotting.')
      return
    }
    onUpdateReview({
      ...review,
      targetDebtSnapshot: targetDebt.balance,
      totalDebtSnapshot: liveTotalDebt,
      snapshotTakenAt: new Date().toISOString(),
    })
  }

  function setField<K extends keyof ReviewData>(key: K, value: ReviewData[K]) {
    onUpdateReview({ ...review, [key]: value })
  }

  function renderDelta(amount: number | null, suffix = 'vs last month') {
    if (amount === null) return <span className="text-gray-400">—</span>
    if (amount === 0) return <span className="text-gray-500">(flat {suffix})</span>
    const direction = amount > 0 ? 'down' : 'up'  // for debt: positive paid = balance down
    const color = amount > 0 ? 'text-emerald-600' : 'text-red-500'
    return <span className={`${color} font-medium`}>({direction} {fmt(Math.abs(amount))} {suffix})</span>
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 mb-8 overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
          Monthly Review — {labelMonth(record.yearMonth)}
        </h2>
      </div>

      <div className="p-5 space-y-7">

        {/* Headline + burn rate */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Headline</p>
            <p className="text-sm text-gray-800">{headline}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">True consumption burn rate</p>
            <p className="text-sm text-gray-800">
              <span className="font-semibold text-gray-900">{formatPct(metrics.burnRate)}</span>{' '}
              <span className="text-gray-500">{burnTargetText}</span>
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Debt block */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Debt</p>
          <ul className="space-y-2 text-sm text-gray-800 mb-4">
            <li className="flex items-baseline gap-2">
              <span className="text-gray-400">•</span>
              <span>
                Total debt: <span className="font-semibold text-gray-900">{fmt(totalDebtDisplay)}</span>{' '}
                {totalDebtIsLive && <span className="text-xs text-gray-400">(live)</span>}{' '}
                {renderDelta(totalDebtDelta)}
              </span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-gray-400">•</span>
              <span>
                #1 target:{' '}
                {targetDebt ? (
                  <>
                    <span className="font-semibold text-gray-900">{targetDebt.label}</span> —{' '}
                    paid {paidThisMonth !== null ? <span className="font-semibold text-gray-900">{fmt(Math.max(0, paidThisMonth))}</span> : <span className="text-gray-400">—</span>}{' '}
                    this month, balance now{' '}
                    {targetBalanceDisplay !== null ? (
                      <>
                        <span className="font-semibold text-gray-900">{fmt(targetBalanceDisplay)}</span>
                        {targetBalanceIsLive && <span className="text-xs text-gray-400 ml-1">(live)</span>}
                      </>
                    ) : '—'}
                  </>
                ) : (
                  <span className="text-gray-500">set target debt in Settings</span>
                )}
              </span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-gray-400">•</span>
              <span>
                On track to clear #1 by:{' '}
                {clearBy ? <span className="font-semibold text-gray-900">{clearBy}</span> : <span className="text-gray-400">—</span>}
              </span>
            </li>
          </ul>

          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={takeSnapshot}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
            >
              📸 Snapshot debt balances at month-end
            </button>
            {review.snapshotTakenAt && (
              <span className="text-xs text-gray-400">Last snapshot: {formatSnapshotDate(review.snapshotTakenAt)}</span>
            )}
            {!review.snapshotTakenAt && (
              <span className="text-xs text-gray-400">Snapshot to compute paid-this-month and total-debt delta</span>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              One step toward filling the bottom two this month
            </span>
            <input
              type="text"
              value={review.oneStepIncomeTier}
              onChange={(e) => setField('oneStepIncomeTier', e.target.value)}
              placeholder="action or 'none yet'"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
            />
          </label>
        </div>

        <div className="border-t border-gray-100" />

        {/* Income tiering */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Income tiering{' '}
            <span className="text-gray-400 normal-case tracking-normal font-normal">(the leverage scoreboard)</span>
          </p>
          <ul className="space-y-1.5 text-sm text-gray-800">
            {[
              { label: 'Active', amount: metrics.activeIncome },
              { label: 'Semi-active', amount: metrics.semiActiveIncome },
              { label: 'Passive', amount: metrics.passiveIncome },
            ].map(({ label, amount }) => {
              const pct = tierPct(amount)
              return (
                <li key={label} className="flex items-baseline gap-2">
                  <span className="text-gray-400">•</span>
                  <span className="w-28">{label}:</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{fmt(amount)}</span>
                  <span className="text-gray-500 tabular-nums">
                    {pct === null ? '(—)' : `(${pct.toFixed(1)}%)`}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="border-t border-gray-100" />

        {/* This month */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">This month</p>

          <label className="block">
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">One win</span>
            <input
              type="text"
              value={review.oneWin}
              onChange={(e) => setField('oneWin', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">One thing to watch</span>
            <input
              type="text"
              value={review.oneToWatch}
              onChange={(e) => setField('oneToWatch', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">One decision for next month</span>
            <input
              type="text"
              value={review.oneDecisionNext}
              onChange={(e) => setField('oneDecisionNext', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
        </div>

        <div className="border-t-2 border-gray-100 pt-2" />

        {/* Delta highlights (unchanged) */}
        {delta && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Delta Highlights</p>
            <div className="flex flex-wrap gap-2">
              {DELTA_FIELDS.map(({ field, label, format }) => {
                const value = delta[field]
                const dir = deltaDirection(field, value)
                if (dir === 'neutral') return null
                return (
                  <div
                    key={field}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                      dir === 'positive' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100',
                    )}
                  >
                    <span className="text-gray-600 text-xs">{label}</span>
                    <DeltaBadge field={field} value={value} format={format} symbol={sym} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Notable line item changes (unchanged) */}
        {lineItemDeltas.filter((d) => d.status !== 'unchanged').length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Line Item Changes</p>
            <div className="space-y-1">
              {lineItemDeltas
                .filter((d) => d.status !== 'unchanged')
                .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                .slice(0, 8)
                .map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-700">
                      {d.label}
                      {d.status === 'new' && <span className="ml-1.5 text-xs text-emerald-600 font-medium">new</span>}
                      {d.status === 'removed' && <span className="ml-1.5 text-xs text-red-500 font-medium">removed</span>}
                    </span>
                    <span className={clsx('font-medium tabular-nums text-xs', d.delta > 0 ? 'text-red-500' : 'text-emerald-600')}>
                      {d.delta > 0 ? '+' : ''}{formatCurrency(d.delta, sym)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `<ReviewSection ... />` callsite in StatementPage**

In `src/components/statement/StatementPage.tsx`, `metrics` (line 32) and `priorRecord` (line 31, from `useComparison`) are already in scope. Update the JSX block at the end of the file (around lines 200-207). Replace:
```tsx
<ReviewSection
  record={record}
  delta={delta}
  lineItemDeltas={lineItemDeltas}
  priorYM={priorYM}
  settings={settings}
  onUpdateReview={updateReview}
/>
```
with:
```tsx
<ReviewSection
  record={record}
  metrics={metrics}
  delta={delta}
  lineItemDeltas={lineItemDeltas}
  priorYM={priorYM}
  priorReview={priorRecord?.review ?? null}
  settings={settings}
  onUpdateReview={updateReview}
/>
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc -b`
Expected: Exit code 0. No type errors anywhere.

If errors mention old `keyChanges` / `actionItems` references elsewhere in the codebase, remove them.

- [ ] **Step 4: Run unit tests**

Run: `npm test`
Expected: All utility tests still pass.

- [ ] **Step 5: Browser verification — fresh month**

Run: `npm run dev`. Navigate to `/` (Dashboard), then click into the current month's statement.

Verify on a month with no prior month data:
1. "Monthly Review — {Month YYYY}" header shows correct month.
2. Headline reads "Net cash flow was $0." (no "vs last month" clause).
3. Burn rate shows "0.0%" with "(target: set in Settings)" when target unset, or "(target: <NN%)" when set.
4. Debt block shows: "Total debt: $X (live)" with "—" for the delta; "#1 target: ..." with target debt name + live balance; "On track to clear #1 by: —".
5. Income tiering shows "$0 (—)" for all three rows when no income.
6. Four freeform inputs render empty; typing into them persists (refresh page, values remain).
7. Delta Highlights and Line Item Changes blocks do NOT render (no prior month → no delta).
8. No console errors.

- [ ] **Step 6: Browser verification — populated month with snapshot**

Still in the dev server, set up data:
1. Go to Settings, enter Target burn rate = `70` and pick a target debt from the dropdown. Save.
2. Go to Net Worth, ensure at least one debt exists with the selected ID.
3. Go to the statement, enter some income (e.g., $5000 active, $500 passive) and expenses (e.g., $3000 fixed).
4. Confirm headline now reads "Net cash flow was $2500." (no delta yet because no prior month).
5. Click "📸 Snapshot debt balances at month-end". Verify:
   - "(live)" tags disappear from Total debt and #1 target balance.
   - "Last snapshot: {date}" text appears.
6. Navigate to the prior month (use sidebar or URL like `/statement/2026-05`). Enter some data + take a snapshot here too with a higher debt balance.
7. Navigate back to the original month. Verify:
   - Debt block now shows "Total debt: $X (down $Y vs last month)" with correct math.
   - "#1 target: ... paid $Y this month" shows the difference.
   - "On track to clear #1 by: {Month YYYY}" computes (balance ÷ paid, rounded up).

- [ ] **Step 7: Stop dev server, commit**

Stop with Ctrl-C, then:
```bash
git add src/components/review/ReviewSection.tsx src/components/statement/StatementPage.tsx
git commit -m "Rebuild Monthly Review section with structured template

Replaces freeform keyChanges + 3 generic action items with a structured
template: headline, burn rate vs target, debt block with snapshot,
income tiering, three This month prompts. Existing Delta Highlights
and Line Item Changes blocks retained below.

Snapshot button captures target-debt + total-debt balances into
ReviewData per month, enabling paid-this-month and clear-by projection."
```

---

## Task 8: End-to-end manual QA

**Files:** None — verification only.

- [ ] **Step 1: Type check + tests + build**

```bash
npx tsc -b
npm test
npm run build
```
All three must exit 0.

- [ ] **Step 2: Run dev server**

```bash
npm run dev
```

- [ ] **Step 3: QA checklist**

Walk through each scenario:

- [ ] Open Settings — Targets card renders below the main settings form. Burn rate accepts numbers, dropdown shows debts.
- [ ] Open a current month with no prior data — Headline shows "Net cash flow was $X." with no "vs last month" clause.
- [ ] Same month — burn rate shows "(target: set in Settings)" if unset; switch on, refresh, shows "(target: <NN%)".
- [ ] Same month — Debt block shows "(live)" tags on Total debt and target balance before snapshot. After snapshot, tags disappear.
- [ ] Same month — clicking snapshot twice triggers confirm dialog the second time.
- [ ] Two consecutive months both with snapshots — second month's Debt block shows correct "down $Y" delta and "paid $X this month" derived from the snapshot difference. "On track to clear" shows a future month.
- [ ] Delete the target debt from Net Worth — review surface gracefully shows "set target debt in Settings" without crashing.
- [ ] Open an old month (created before this feature) — old keyChanges/actionItems do not surface; new template renders with whatever can be computed; freeform inputs are empty.
- [ ] Edit a freeform input on an old month, navigate away, navigate back — value persisted.
- [ ] Export data, examine the JSON — `MonthRecord.review` for any month edited after this change uses the new shape.
- [ ] Income tier with $0 total income — shows "—" for all percentages, no NaN%.
- [ ] Snapshot with paidThisMonth ≤ 0 (balance went up or stayed flat) — "On track to clear" shows "—".

- [ ] **Step 4: Fix any failures**

If any QA item fails, fix in place and commit:
```bash
git add <files>
git commit -m "Fix: <what was broken>"
```

- [ ] **Step 5: Stop dev server**

Stop with Ctrl-C. Implementation complete.

---

## Out of Scope (per spec)

- Year-end roll-up / annual review screen
- Cross-month trend charts of paid-debt or burn rate
- Multiple target debts at once
- Re-tagging expenses with consumption vs wealth-building axis
- Active migration of old `keyChanges` text into new freeform fields
