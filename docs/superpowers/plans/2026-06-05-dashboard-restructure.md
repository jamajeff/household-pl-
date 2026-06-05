# Household P&L Dashboard Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the dashboard to enforce the Cash Waterfall by splitting expenses into Tiers (Fixed Bills, Loan Minimums, CC Minimums, Rolling $8K, Variable), and add a Debt Tracking section with balances, APRs, and an auto-sorted payoff queue.

**Architecture:** Hybrid debt model. Canonical debt facts (name, APR, kind, credit limit, standard minimum) live once in the **global debt registry** (extended `Debt`, managed on the Net Worth page). Each `MonthRecord` stores a per-month **balance + minimum snapshot** per debt plus a single **rolling payment** record. Tier 3a/3b sections and the Debt Tracking tables are *derived* by joining the registry with the current month's snapshots. This keeps Net Worth and Debt Tracking in sync and makes month-over-month deltas natural.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest, Tailwind v4, react-router-dom v7, date-fns. Money is stored as integer cents throughout. Persistence is `localStorage` via `src/utils/storage.ts`.

**Conventions to follow (from the existing codebase):**
- All money in integer **cents**; format with `formatCurrency(cents, symbol)`.
- IDs via `nanoid()` from `src/components/statement/nanoid.ts`.
- Pure logic in `src/utils/*`, React state in `src/hooks/*`, presentational components in `src/components/*`.
- Run tests with `npm test` (vitest run). Run a single file with `npx vitest run src/utils/foo.test.ts`.
- Type-check/build with `npm run build` (runs `tsc -b` first).

---

## File Structure

**New files:**
- `src/utils/debtKeywords.ts` — keyword detection: `looksLikeDebt`, `classifyDebtKind` (shared by Tier 2 validation + migration).
- `src/utils/debtKeywords.test.ts`
- `src/utils/debt.ts` — pure debt logic: `debtGroup`, `buildDebtQueue`, `utilizationPct`, `computeDebtDelta`.
- `src/utils/debt.test.ts`
- `src/components/statement/FixedBillsSection.tsx` — Tier 2.
- `src/components/statement/DebtMinimumsSection.tsx` — Tier 3a & 3b (parameterized by kind).
- `src/components/statement/RollingSection.tsx` — Tier 4.
- `src/components/statement/VariableSection.tsx` — Tier 7.
- `src/components/debt/DebtTrackingSection.tsx` — cards table, loans table, payoff queue.
- `src/components/migration/MigrationPage.tsx` — one-time migration tool.

**Modified files:**
- `src/types/index.ts` — extend `Debt`, `ExpenseLineItem`, `AppSettings`, `MonthRecord`, `MonthMetrics`; add `DebtSnapshot`, `RollingPayment`, `DebtDelta`, enums.
- `src/utils/storage.ts` — backfill new fields on read; bump export version.
- `src/utils/calculations.ts` — extend `computeMetrics` to take `debts` and produce tier totals.
- `src/utils/comparison.ts` — no change (debt delta lives in `debt.ts`).
- `src/hooks/useMonthData.ts` — `debtSnapshots` + `rolling` state and CRUD; copy/empty updates.
- `src/components/statement/StatementPage.tsx` — replace Fixed/Variable with the five tier sections + Debt Tracking section; thread `debts` into metrics.
- `src/components/networth/NetWorthPage.tsx` + `NetWorthItem.tsx` — debt form gains kind/APR/min/limit fields.
- `src/components/dashboard/SettingsPage.tsx` — rolling amount, burn override, queue grouping, payoff mode.
- `src/components/dashboard/DashboardPage.tsx` — prominent "Current Rolling $8K target" card.
- `src/components/review/ReviewSection.tsx` — waterfall commitments + debt delta block.
- `src/components/layout/Sidebar.tsx` — nav entry for the migration tool.
- `src/App.tsx` — route `/migrate`.

---

## Task 1: Extend type definitions

**Files:**
- Modify: `src/types/index.ts`

This is a types-only task; verification is `npm run build` (no runtime test). Later tasks depend on every name defined here.

- [ ] **Step 1: Add debt registry enums and extend `Debt`**

In `src/types/index.ts`, replace the existing `ExpenseSubcategory` line and the `Debt` interface, and add the new enums. Final state of the relevant region:

```typescript
export type Person = 'person1' | 'person2' | 'shared'

export type IncomeSubcategory = 'active' | 'semi_active' | 'passive'

// Tier 2 = fixed_bill, Tier 7 = variable
export type ExpenseSubcategory = 'fixed_bill' | 'variable'

export type FixedBillCategory =
  | 'housing' | 'utilities' | 'insurance' | 'subscription' | 'leverage' | 'membership'

export type VariableCategory =
  | 'groceries' | 'dining' | 'gas' | 'household' | 'gifts' | 'travel' | 'other'

export type AssetCategory = 'investment' | 'savings' | 'real_estate' | 'other'
export type DebtCategory = 'mortgage' | 'auto' | 'student' | 'credit_card' | 'other'

// Hybrid debt model
export type DebtKind = 'credit_card' | 'loan'
export type LoanType = 'student' | 'cash' | 'auto' | 'mortgage' | 'other'
export type CardIssuer = 'chase' | 'amex' | 'discover' | 'citi' | 'capital_one' | 'other'
// Payoff-queue grouping buckets (Rule #1: CC -> Cash -> Student -> ...)
export type DebtGroup = 'credit_card' | 'cash' | 'student' | 'auto' | 'mortgage' | 'other'
```

- [ ] **Step 2: Replace the `LineItem` / `ExpenseLineItem` / `Debt` interfaces**

```typescript
export interface LineItem {
  id: string
  label: string
  amount: number // stored as integer cents
  person: Person
  note?: string
}

export interface IncomeLineItem extends LineItem {
  subcategory: IncomeSubcategory
}

export interface ExpenseLineItem extends LineItem {
  subcategory: ExpenseSubcategory
  billCategory?: FixedBillCategory   // Tier 2 only
  autopay?: boolean                  // Tier 2 only
  variableCategory?: VariableCategory // Tier 7 only
}

export interface Asset {
  id: string
  label: string
  value: number // integer cents
  category: AssetCategory
  updatedAt: string
}

export interface Debt {
  id: string
  label: string                 // canonical name (Naming Conventions: one name per debt)
  aliases?: string[]            // alternate display names
  balance: number               // current/live balance, integer cents
  category: DebtCategory        // kept for Net Worth back-compat
  kind: DebtKind                // drives Tier 3a (loan) vs 3b (credit_card)
  apr: number                   // percent, e.g. 22.99
  minPayment: number            // standard monthly minimum, integer cents
  autopay: boolean
  loanType?: LoanType           // when kind === 'loan'
  issuer?: CardIssuer           // when kind === 'credit_card'
  creditLimit?: number          // when kind === 'credit_card', integer cents
  lender?: string
  updatedAt: string
}
```

- [ ] **Step 3: Add `DebtSnapshot`, `RollingPayment`, `DebtDelta`; extend `MonthRecord`**

```typescript
// Per-month, per-debt snapshot (Tier 3a/3b monthly data)
export interface DebtSnapshot {
  debtId: string       // FK -> Debt.id in the global registry
  balance: number      // balance this month, integer cents
  minPayment: number   // minimum due this month, integer cents
}

// Tier 4 — Rolling $8K
export interface RollingPayment {
  amount: number              // target rolling amount this month, integer cents
  paidThisMonth: number       // actually paid, integer cents
  targetDebtId: string | null // debt the rolling payment was applied to
}

export interface DebtDelta {
  creditCardDelta: number // prior balance - current balance for cards (positive = paid down)
  loanDelta: number
  totalDelta: number
}
```

Replace the `MonthRecord` interface:

```typescript
export interface MonthRecord {
  yearMonth: string // "YYYY-MM"
  income: IncomeLineItem[]
  expenses: ExpenseLineItem[]   // now Tier 2 (fixed_bill) + Tier 7 (variable) only
  debtSnapshots: DebtSnapshot[] // Tier 3a/3b monthly data
  rolling: RollingPayment       // Tier 4
  review: ReviewData
  updatedAt: string
}
```

- [ ] **Step 4: Extend `AppSettings` and `MonthMetrics`**

Replace `AppSettings`:

```typescript
export interface AppSettings {
  person1Name: string
  person2Name: string
  currencySymbol: string
  targetBurnRatePct: number | null
  targetDebtId: string | null
  rollingAmount: number           // cents, default 800000 ($8,000)
  burnRateOverrideMonths: number  // consecutive months >100% that pause Tier 5, default 2
  queueGrouping: DebtGroup[]      // default ['credit_card','cash','student','auto','mortgage','other']
  payoffMode: 'apr' | 'snowball'  // default 'apr'
}
```

Replace `MonthMetrics` (keep existing fields, add tier fields):

```typescript
export interface MonthMetrics {
  totalRevenue: number
  totalExpenses: number
  netCashFlow: number
  burnRate: number
  person1Income: number
  person2Income: number
  activeIncome: number
  semiActiveIncome: number
  passiveIncome: number
  fixedExpenses: number    // = tier2Total (kept for back-compat callers)
  variableExpenses: number // = tier7Total
  // Waterfall tiers
  tier2Total: number       // fixed bills
  tier3aTotal: number      // loan minimums (from snapshots joined to loan debts)
  tier3bTotal: number      // CC minimums (from snapshots joined to card debts)
  tier4Rolling: number     // rolling.paidThisMonth (actual cash out)
  tier7Total: number       // variable / discretionary
  totalCommitted: number   // tier2 + tier3a + tier3b + rolling.amount (commitment, not actual)
  remainingForLowerTiers: number // totalRevenue - totalCommitted
}
```

Leave `MonthDelta`, `LineItemDelta`, `ReviewData` unchanged.

- [ ] **Step 5: Verify it compiles**

Run: `npm run build`
Expected: FAIL — `tsc` reports errors in `storage.ts`, `calculations.ts`, `useMonthData.ts`, `StatementPage.tsx`, etc. (they construct `MonthRecord`/`AppSettings`/`MonthMetrics` without the new required fields). This is expected; the next tasks fix each call site. Confirm the **only** errors are "missing property" errors referencing the new fields — no syntax errors inside `types/index.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add hybrid debt model, expense tiers, rolling payment"
```

---

## Task 2: Storage backfill & versioning

Old `localStorage` records lack the new fields. `getMonth`, `getDebts`, and `getSettings` must backfill defaults so existing data loads without crashing.

**Files:**
- Modify: `src/utils/storage.ts`
- Test: `src/utils/storage.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/utils/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { getMonth, setMonth, getDebts, setDebts, getSettings } from './storage'

beforeEach(() => {
  localStorage.clear()
})

describe('getMonth backfill', () => {
  it('backfills debtSnapshots and rolling on legacy records', () => {
    // Simulate a legacy record written before the restructure.
    localStorage.setItem('pl:2026-01', JSON.stringify({
      yearMonth: '2026-01',
      income: [],
      expenses: [{ id: 'a', label: 'Rent', amount: 200000, person: 'shared', subcategory: 'fixed' }],
      updatedAt: '2026-01-31T00:00:00.000Z',
    }))
    const rec = getMonth('2026-01')!
    expect(rec.debtSnapshots).toEqual([])
    expect(rec.rolling).toEqual({ amount: 800000, paidThisMonth: 0, targetDebtId: null })
    // legacy 'fixed' subcategory is preserved verbatim (migration tool, not storage, reclassifies)
    expect(rec.expenses[0].subcategory).toBe('fixed')
  })

  it('round-trips a full new-shape record', () => {
    setMonth({
      yearMonth: '2026-02',
      income: [],
      expenses: [],
      debtSnapshots: [{ debtId: 'd1', balance: 100000, minPayment: 5000 }],
      rolling: { amount: 800000, paidThisMonth: 800000, targetDebtId: 'd1' },
      review: {
        targetDebtSnapshot: null, totalDebtSnapshot: null, snapshotTakenAt: null,
        oneStepIncomeTier: '', oneWin: '', oneToWatch: '', oneDecisionNext: '',
      },
      updatedAt: '2026-02-28T00:00:00.000Z',
    })
    const rec = getMonth('2026-02')!
    expect(rec.debtSnapshots[0]).toEqual({ debtId: 'd1', balance: 100000, minPayment: 5000 })
    expect(rec.rolling.targetDebtId).toBe('d1')
  })
})

describe('getDebts backfill', () => {
  it('backfills kind/apr/minPayment/autopay on legacy debts', () => {
    localStorage.setItem('pl:debts', JSON.stringify([
      { id: 'd1', label: 'Amex', balance: 4800000, category: 'credit_card', updatedAt: 'x' },
      { id: 'd2', label: 'Sofi 30k', balance: 2500000, category: 'student', updatedAt: 'x' },
    ]))
    const debts = getDebts()
    expect(debts[0]).toMatchObject({ kind: 'credit_card', apr: 0, minPayment: 0, autopay: false })
    expect(debts[1]).toMatchObject({ kind: 'loan', apr: 0, minPayment: 0, autopay: false, loanType: 'student' })
  })
})

describe('getSettings backfill', () => {
  it('provides new defaults', () => {
    const s = getSettings()
    expect(s.rollingAmount).toBe(800000)
    expect(s.burnRateOverrideMonths).toBe(2)
    expect(s.payoffMode).toBe('apr')
    expect(s.queueGrouping).toEqual(['credit_card', 'cash', 'student', 'auto', 'mortgage', 'other'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/storage.test.ts`
Expected: FAIL — `debtSnapshots`/`rolling` undefined; `kind` undefined; `rollingAmount` undefined.

- [ ] **Step 3: Update `DEFAULT_SETTINGS` and add a rolling default constant**

In `src/utils/storage.ts`, replace `DEFAULT_SETTINGS`:

```typescript
export const DEFAULT_ROLLING_CENTS = 800000 // $8,000

const DEFAULT_SETTINGS: AppSettings = {
  person1Name: 'Person 1',
  person2Name: 'Person 2',
  currencySymbol: '$',
  targetBurnRatePct: null,
  targetDebtId: null,
  rollingAmount: DEFAULT_ROLLING_CENTS,
  burnRateOverrideMonths: 2,
  queueGrouping: ['credit_card', 'cash', 'student', 'auto', 'mortgage', 'other'],
  payoffMode: 'apr',
}
```

`getSettings` already spreads `{ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }`, so new keys backfill automatically.

- [ ] **Step 4: Backfill in `getMonth`**

In `getMonth`, replace the `return { ...parsed, review: {...} }` block so it also fills `debtSnapshots` and `rolling`. Update the parsed type and return:

```typescript
const parsed = JSON.parse(raw) as MonthRecord & {
  review?: Partial<ReviewData>
  debtSnapshots?: DebtSnapshot[]
  rolling?: Partial<RollingPayment>
}
const r = parsed.review ?? {}
const roll = parsed.rolling ?? {}
return {
  ...parsed,
  debtSnapshots: Array.isArray(parsed.debtSnapshots) ? parsed.debtSnapshots : [],
  rolling: {
    amount: roll.amount ?? DEFAULT_ROLLING_CENTS,
    paidThisMonth: roll.paidThisMonth ?? 0,
    targetDebtId: roll.targetDebtId ?? null,
  },
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
```

Add `DebtSnapshot, RollingPayment` to the type import at the top of the file:

```typescript
import type { AppSettings, MonthRecord, Asset, Debt, ReviewData, DebtSnapshot, RollingPayment, DebtKind, LoanType } from '../types'
```

- [ ] **Step 5: Backfill in `getDebts`**

Replace `getDebts`:

```typescript
function inferKind(category: Debt['category']): DebtKind {
  return category === 'credit_card' ? 'credit_card' : 'loan'
}

function inferLoanType(category: Debt['category']): LoanType | undefined {
  switch (category) {
    case 'student': return 'student'
    case 'auto': return 'auto'
    case 'mortgage': return 'mortgage'
    case 'other': return 'other'
    default: return undefined // credit_card -> no loanType
  }
}

export function getDebts(): Debt[] {
  try {
    const raw = localStorage.getItem(DEBTS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as Array<Partial<Debt> & { id: string; label: string; balance: number; category: Debt['category']; updatedAt: string }>
    return arr.map((d) => ({
      ...d,
      kind: d.kind ?? inferKind(d.category),
      apr: d.apr ?? 0,
      minPayment: d.minPayment ?? 0,
      autopay: d.autopay ?? false,
      loanType: d.loanType ?? (d.kind === 'credit_card' || d.category === 'credit_card' ? undefined : inferLoanType(d.category)),
    })) as Debt[]
  } catch {
    return []
  }
}
```

- [ ] **Step 6: Bump export version**

In `exportAllData`, change `version: 1` to `version: 2`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/utils/storage.test.ts`
Expected: PASS (3 describe blocks, all green).

- [ ] **Step 8: Commit**

```bash
git add src/utils/storage.ts src/utils/storage.test.ts
git commit -m "feat(storage): backfill debt snapshots, rolling, debt fields; v2 export"
```

---

## Task 3: Debt queue, grouping, utilization

Pure functions for the payoff queue and utilization. No React.

**Files:**
- Create: `src/utils/debt.ts`
- Test: `src/utils/debt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/debt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { debtGroup, buildDebtQueue, utilizationPct } from './debt'
import type { Debt, DebtGroup } from '../types'

function card(id: string, apr: number, balance: number, creditLimit?: number): Debt {
  return { id, label: id, balance, category: 'credit_card', kind: 'credit_card', apr, minPayment: 0, autopay: true, creditLimit, updatedAt: 'x' }
}
function loan(id: string, apr: number, balance: number, loanType: Debt['loanType']): Debt {
  return { id, label: id, balance, category: 'other', kind: 'loan', apr, minPayment: 0, autopay: true, loanType, updatedAt: 'x' }
}

const GROUPING: DebtGroup[] = ['credit_card', 'cash', 'student', 'auto', 'mortgage', 'other']

describe('debtGroup', () => {
  it('cards are credit_card; loans use loanType', () => {
    expect(debtGroup(card('a', 20, 1000))).toBe('credit_card')
    expect(debtGroup(loan('b', 7, 1000, 'cash'))).toBe('cash')
    expect(debtGroup(loan('c', 7, 1000, undefined))).toBe('other')
  })
})

describe('buildDebtQueue', () => {
  it('orders by group then APR desc; ranks from 1', () => {
    const amex = card('Amex', 24.99, 4800000)
    const chase = card('Chase', 22.99, 800000)
    const sofiCash = loan('SofiCash', 7.2, 5800000, 'cash')
    const studentHighApr = loan('Student', 26.0, 1000000, 'student') // higher APR than cards but lower group
    const queue = buildDebtQueue([studentHighApr, chase, sofiCash, amex], GROUPING, 800000)
    expect(queue.map((q) => q.debt.label)).toEqual(['Amex', 'Chase', 'SofiCash', 'Student'])
    expect(queue[0].rank).toBe(1)
    expect(queue[0].group).toBe('credit_card')
  })

  it('computes months to clear at rolling amount (ceil)', () => {
    const amex = card('Amex', 24.99, 4800000)
    const [entry] = buildDebtQueue([amex], GROUPING, 800000)
    expect(entry.monthsToClear).toBe(6) // 48000 / 8000
  })
})

describe('utilizationPct', () => {
  it('returns balance/limit percent, or null without a limit', () => {
    expect(utilizationPct(800000, 2500000)).toBeCloseTo(32, 1)
    expect(utilizationPct(800000, undefined)).toBeNull()
    expect(utilizationPct(800000, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/debt.test.ts`
Expected: FAIL — `Cannot find module './debt'`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/debt.ts`:

```typescript
import type { Debt, DebtGroup, DebtSnapshot, DebtDelta } from '../types'
import { monthsToClearDebt } from './calculations'

export interface QueueEntry {
  rank: number
  debt: Debt
  group: DebtGroup
  monthsToClear: number | null
}

export function debtGroup(debt: Debt): DebtGroup {
  if (debt.kind === 'credit_card') return 'credit_card'
  return (debt.loanType ?? 'other') as DebtGroup
}

/**
 * Sort debts per Rule #1: by group order (CC -> Cash -> Student -> ...),
 * then by APR descending within each group. Ranks start at 1.
 */
export function buildDebtQueue(debts: Debt[], grouping: DebtGroup[], rollingAmount: number): QueueEntry[] {
  const order = new Map(grouping.map((g, i) => [g, i]))
  const sorted = [...debts].sort((a, b) => {
    const ga = order.get(debtGroup(a)) ?? 999
    const gb = order.get(debtGroup(b)) ?? 999
    if (ga !== gb) return ga - gb
    return b.apr - a.apr
  })
  return sorted.map((debt, i) => ({
    rank: i + 1,
    debt,
    group: debtGroup(debt),
    monthsToClear: monthsToClearDebt(debt.balance, rollingAmount),
  }))
}

export function utilizationPct(balance: number, creditLimit?: number): number | null {
  if (!creditLimit || creditLimit <= 0) return null
  return (balance / creditLimit) * 100
}

/**
 * Debt delta from prior month, joining snapshots to the registry by debtId.
 * Positive delta = balance went DOWN (paid off).
 */
export function computeDebtDelta(
  current: DebtSnapshot[],
  prior: DebtSnapshot[],
  debts: Debt[],
): DebtDelta {
  const kindOf = new Map(debts.map((d) => [d.id, d.kind]))
  const priorById = new Map(prior.map((s) => [s.debtId, s.balance]))
  let creditCardDelta = 0
  let loanDelta = 0
  for (const snap of current) {
    const priorBalance = priorById.get(snap.debtId)
    if (priorBalance === undefined) continue
    const paid = priorBalance - snap.balance
    if (kindOf.get(snap.debtId) === 'credit_card') creditCardDelta += paid
    else loanDelta += paid
  }
  return { creditCardDelta, loanDelta, totalDelta: creditCardDelta + loanDelta }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/debt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/debt.ts src/utils/debt.test.ts
git commit -m "feat(debt): payoff queue, grouping, utilization, debt delta"
```

---

## Task 4: Waterfall tier metrics

Extend `computeMetrics` to take the debt registry and produce tier totals. Signature changes from `computeMetrics(record)` to `computeMetrics(record, debts)`.

**Files:**
- Modify: `src/utils/calculations.ts`
- Test: `src/utils/calculations.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/utils/calculations.test.ts`:

```typescript
import { computeMetrics } from './calculations'
import type { MonthRecord, Debt } from '../types'

function baseRecord(over: Partial<MonthRecord> = {}): MonthRecord {
  return {
    yearMonth: '2026-03',
    income: [
      { id: 'i1', label: 'Salary', amount: 1000000, person: 'person1', subcategory: 'active' },
    ],
    expenses: [
      { id: 'e1', label: 'Rent', amount: 200000, person: 'shared', subcategory: 'fixed_bill' },
      { id: 'e2', label: 'Groceries', amount: 50000, person: 'shared', subcategory: 'variable' },
    ],
    debtSnapshots: [
      { debtId: 'card1', balance: 800000, minPayment: 25000 },
      { debtId: 'loan1', balance: 2500000, minPayment: 66500 },
    ],
    rolling: { amount: 800000, paidThisMonth: 800000, targetDebtId: 'card1' },
    review: { targetDebtSnapshot: null, totalDebtSnapshot: null, snapshotTakenAt: null, oneStepIncomeTier: '', oneWin: '', oneToWatch: '', oneDecisionNext: '' },
    updatedAt: 'x',
    ...over,
  }
}

const DEBTS: Debt[] = [
  { id: 'card1', label: 'Chase', balance: 800000, category: 'credit_card', kind: 'credit_card', apr: 22.99, minPayment: 25000, autopay: true, updatedAt: 'x' },
  { id: 'loan1', label: 'Sofi', balance: 2500000, category: 'student', kind: 'loan', apr: 6.5, minPayment: 66500, autopay: true, loanType: 'student', updatedAt: 'x' },
]

describe('computeMetrics tiers', () => {
  it('splits minimums into 3a (loan) and 3b (card) and totals committed', () => {
    const m = computeMetrics(baseRecord(), DEBTS)
    expect(m.tier2Total).toBe(200000)
    expect(m.tier7Total).toBe(50000)
    expect(m.tier3bTotal).toBe(25000) // card min
    expect(m.tier3aTotal).toBe(66500) // loan min
    expect(m.tier4Rolling).toBe(800000) // paidThisMonth
    // committed = tier2 + 3a + 3b + rolling.amount
    expect(m.totalCommitted).toBe(200000 + 66500 + 25000 + 800000)
    expect(m.remainingForLowerTiers).toBe(1000000 - m.totalCommitted)
  })

  it('totalExpenses includes bills, minimums, rolling paid, and variable', () => {
    const m = computeMetrics(baseRecord(), DEBTS)
    expect(m.totalExpenses).toBe(200000 + 66500 + 25000 + 800000 + 50000)
    expect(m.netCashFlow).toBe(1000000 - m.totalExpenses)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/calculations.test.ts`
Expected: FAIL — `computeMetrics` takes 1 arg / `tier2Total` undefined.

- [ ] **Step 3: Rewrite `computeMetrics`**

In `src/utils/calculations.ts`, update the import and replace `computeMetrics`:

```typescript
import { addMonths, format, parse } from 'date-fns'
import type { MonthRecord, MonthMetrics, LineItem, Debt } from '../types'

function sum(items: LineItem[]): number {
  return items.reduce((acc, i) => acc + i.amount, 0)
}

export function computeMetrics(record: MonthRecord, debts: Debt[] = []): MonthMetrics {
  const activeIncome = sum(record.income.filter((i) => i.subcategory === 'active'))
  const semiActiveIncome = sum(record.income.filter((i) => i.subcategory === 'semi_active'))
  const passiveIncome = sum(record.income.filter((i) => i.subcategory === 'passive'))
  const totalRevenue = activeIncome + semiActiveIncome + passiveIncome

  const tier2Total = sum(record.expenses.filter((e) => e.subcategory === 'fixed_bill'))
  const tier7Total = sum(record.expenses.filter((e) => e.subcategory === 'variable'))

  // Split debt-snapshot minimums by the registry kind.
  const kindOf = new Map(debts.map((d) => [d.id, d.kind]))
  let tier3aTotal = 0
  let tier3bTotal = 0
  for (const snap of record.debtSnapshots) {
    if (kindOf.get(snap.debtId) === 'credit_card') tier3bTotal += snap.minPayment
    else tier3aTotal += snap.minPayment // default unknown -> loan bucket
  }

  const tier4Rolling = record.rolling.paidThisMonth
  const totalExpenses = tier2Total + tier3aTotal + tier3bTotal + tier4Rolling + tier7Total

  const totalCommitted = tier2Total + tier3aTotal + tier3bTotal + record.rolling.amount
  const remainingForLowerTiers = totalRevenue - totalCommitted

  const netCashFlow = totalRevenue - totalExpenses
  const burnRate = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0

  const person1Income = sum(record.income.filter((i) => i.person === 'person1'))
  const person2Income = sum(record.income.filter((i) => i.person === 'person2'))

  return {
    totalRevenue,
    totalExpenses,
    netCashFlow,
    burnRate,
    person1Income,
    person2Income,
    activeIncome,
    semiActiveIncome,
    passiveIncome,
    fixedExpenses: tier2Total,
    variableExpenses: tier7Total,
    tier2Total,
    tier3aTotal,
    tier3bTotal,
    tier4Rolling,
    tier7Total,
    totalCommitted,
    remainingForLowerTiers,
  }
}
```

Leave `monthsToClearDebt`, `addMonthsToYearMonth`, `formatHeadline` unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/calculations.test.ts`
Expected: PASS. (Note: any pre-existing `computeMetrics(record)` test in this file still passes — `debts` defaults to `[]`, so tier3a/3b are 0.)

- [ ] **Step 5: Commit**

```bash
git add src/utils/calculations.ts src/utils/calculations.test.ts
git commit -m "feat(calc): waterfall tier metrics from snapshots + registry"
```

---

## Task 5: `useMonthData` — snapshots & rolling CRUD

**Files:**
- Modify: `src/hooks/useMonthData.ts`

- [ ] **Step 1: Update `emptyRecord` and imports**

Replace the top of `src/hooks/useMonthData.ts`:

```typescript
import { useState, useCallback } from 'react'
import { getMonth, setMonth, getSettings } from '../utils/storage'
import type { MonthRecord, IncomeLineItem, ExpenseLineItem, ReviewData, DebtSnapshot, RollingPayment } from '../types'
import { nanoid } from '../components/statement/nanoid'
import { format } from 'date-fns'

function emptyRecord(yearMonth: string): MonthRecord {
  return {
    yearMonth,
    income: [],
    expenses: [],
    debtSnapshots: [],
    rolling: { amount: getSettings().rollingAmount, paidThisMonth: 0, targetDebtId: null },
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

- [ ] **Step 2: Add snapshot & rolling actions**

After the existing `updateReview` callback and before `copyFromRecord`, add:

```typescript
const setDebtSnapshot = useCallback(
  (debtId: string, data: { balance: number; minPayment: number }) =>
    persist({
      ...record,
      debtSnapshots: record.debtSnapshots.some((s) => s.debtId === debtId)
        ? record.debtSnapshots.map((s) => (s.debtId === debtId ? { ...s, ...data } : s))
        : [...record.debtSnapshots, { debtId, ...data }],
    }),
  [record, persist],
)

const removeDebtSnapshot = useCallback(
  (debtId: string) =>
    persist({ ...record, debtSnapshots: record.debtSnapshots.filter((s) => s.debtId !== debtId) }),
  [record, persist],
)

const updateRolling = useCallback(
  (updates: Partial<RollingPayment>) =>
    persist({ ...record, rolling: { ...record.rolling, ...updates } }),
  [record, persist],
)
```

- [ ] **Step 3: Update `copyFromRecord` to carry tiers forward**

Replace `copyFromRecord`:

```typescript
const copyFromRecord = useCallback(
  (source: MonthRecord) => {
    persist({
      ...record,
      income: source.income.map((i) => ({ ...i, id: nanoid() })),
      expenses: source.expenses.map((e) => ({ ...e, id: nanoid() })),
      // Carry minimums forward but reset paid-this-month (new month, not yet paid).
      debtSnapshots: source.debtSnapshots.map((s) => ({ ...s })),
      rolling: { ...source.rolling, paidThisMonth: 0 },
    })
  },
  [record, persist],
)
```

- [ ] **Step 4: Export the new actions**

In the returned object, add `setDebtSnapshot, removeDebtSnapshot, updateRolling`:

```typescript
return {
  record,
  addIncome, updateIncome, deleteIncome,
  addExpense, updateExpense, deleteExpense,
  updateReview,
  setDebtSnapshot, removeDebtSnapshot, updateRolling,
  copyFromRecord,
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npm run build`
Expected: still FAIL, but now the errors are confined to UI files (`StatementPage.tsx`, `ReviewSection.tsx`, `SettingsPage.tsx`, etc.) and the `computeMetrics(record)` call in `useComparison.ts`. `useMonthData.ts` and `types`/`utils` should be clean. (Spot-check: `npx tsc -b 2>&1 | grep useMonthData` returns nothing.)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMonthData.ts
git commit -m "feat(useMonthData): debt snapshot + rolling actions, carry-forward"
```

---

## Task 6: Thread `debts` into metric callers

`computeMetrics` now needs `debts`. Fix `useComparison` and `StatementPage`.

**Files:**
- Modify: `src/hooks/useComparison.ts`
- Modify: `src/components/statement/StatementPage.tsx` (metrics call only; full section rewrite is Task 12)

- [ ] **Step 1: Update `useComparison` to accept debts**

Replace the signature and the two `computeMetrics` calls in `src/hooks/useComparison.ts`:

```typescript
import type { MonthRecord, MonthMetrics, MonthDelta, LineItemDelta, Debt } from '../types'

export function useComparison(record: MonthRecord | null, debts: Debt[] = []): {
  priorRecord: MonthRecord | null
  priorMetrics: MonthMetrics | null
  currentMetrics: MonthMetrics | null
  delta: MonthDelta | null
  lineItemDeltas: LineItemDelta[]
  priorYM: string | null
} {
  return useMemo(() => {
    if (!record) {
      return { priorRecord: null, priorMetrics: null, currentMetrics: null, delta: null, lineItemDeltas: [], priorYM: null }
    }

    const currentMetrics = computeMetrics(record, debts)
    const priorYM = priorYearMonth(record.yearMonth)
    const priorRecord = getMonth(priorYM)

    if (!priorRecord) {
      return { priorRecord: null, priorMetrics: null, currentMetrics, delta: null, lineItemDeltas: [], priorYM }
    }

    const priorMetrics = computeMetrics(priorRecord, debts)
    const delta = computeDelta(currentMetrics, priorMetrics)

    const allCurrent = [...record.income, ...record.expenses]
    const allPrior = [...priorRecord.income, ...priorRecord.expenses]
    const lineItemDeltas = diffLineItems(allCurrent, allPrior)

    return { priorRecord, priorMetrics, currentMetrics, delta, lineItemDeltas, priorYM }
  }, [record, debts])
}
```

- [ ] **Step 2: Update the `computeMetrics` + `useComparison` calls in `StatementPage`**

In `src/components/statement/StatementPage.tsx`, add the net-worth hook and pass debts. Near the top of the component body, after `const { settings } = useSettings()`:

```typescript
import { useNetWorth } from '../../hooks/useNetWorth'
// ...
const { debts, updateDebt } = useNetWorth()
```

Replace:
```typescript
const { delta, priorYM, priorRecord, lineItemDeltas } = useComparison(record)
const metrics = computeMetrics(record)
```
with:
```typescript
const { delta, priorYM, priorRecord, lineItemDeltas } = useComparison(record, debts)
const metrics = computeMetrics(record, debts)
```

- [ ] **Step 3: Verify it compiles further**

Run: `npm run build`
Expected: still FAIL, but errors now only in `StatementPage.tsx` (the old `<SectionTable title="Fixed"...>` blocks reference `record.expenses.filter(e => e.subcategory === 'fixed')` — `'fixed'` is no longer a valid `ExpenseSubcategory`), `ReviewSection.tsx`, and `SettingsPage.tsx`. Confirm `useComparison.ts` is clean.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useComparison.ts src/components/statement/StatementPage.tsx
git commit -m "refactor: thread debt registry into metric computation"
```

---

## Task 7: Debt keyword detection

Shared helper used by Tier 2 validation (Task 9) and the migration tool (Task 13).

**Files:**
- Create: `src/utils/debtKeywords.ts`
- Test: `src/utils/debtKeywords.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/debtKeywords.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { looksLikeDebt, classifyDebtKind } from './debtKeywords'

describe('looksLikeDebt', () => {
  it('flags debt-like labels', () => {
    for (const l of ['Sofi 30k Loan', 'Chase Sapphire', 'Amex', 'Discover it', 'Sallie Mae', 'Dept of ED', 'Visa']) {
      expect(looksLikeDebt(l)).toBe(true)
    }
  })
  it('passes non-debt labels', () => {
    for (const l of ['Apartment', 'ChatGPT', 'Car Insurance', 'Groceries', 'VA Disability']) {
      expect(looksLikeDebt(l)).toBe(false)
    }
  })
})

describe('classifyDebtKind', () => {
  it('routes cards vs loans', () => {
    expect(classifyDebtKind('Chase Sapphire')).toBe('credit_card')
    expect(classifyDebtKind('Amex')).toBe('credit_card')
    expect(classifyDebtKind('Sofi 30k Loan')).toBe('loan')
    expect(classifyDebtKind('Dept of ED')).toBe('loan')
    expect(classifyDebtKind('Apartment')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/debtKeywords.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/utils/debtKeywords.ts`:

```typescript
import type { DebtKind } from '../types'

const CARD_KEYWORDS = ['card', 'credit', 'amex', 'discover', 'visa', 'mastercard', 'chase', 'sapphire', 'saphire', 'citi', 'capital one']
const LOAN_KEYWORDS = ['loan', 'sofi', 'sallie', 'dept of ed', 'mortgage', 'student']

export function looksLikeDebt(label: string): boolean {
  const l = label.toLowerCase()
  return [...CARD_KEYWORDS, ...LOAN_KEYWORDS].some((k) => l.includes(k))
}

export function classifyDebtKind(label: string): DebtKind | null {
  const l = label.toLowerCase()
  if (CARD_KEYWORDS.some((k) => l.includes(k))) return 'credit_card'
  if (LOAN_KEYWORDS.some((k) => l.includes(k))) return 'loan'
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/debtKeywords.test.ts`
Expected: PASS. (`'VA Disability'` contains "visa"? No — "visa" is not a substring of "va disability". `'Car Insurance'` contains "car" but not "card". Confirmed both pass.)

- [ ] **Step 5: Commit**

```bash
git add src/utils/debtKeywords.ts src/utils/debtKeywords.test.ts
git commit -m "feat(debt): keyword detection for tier validation + migration"
```

---

## Task 8: Net Worth debt form — capture APR/min/kind/limit

The registry is the source of truth for debt facts, so the Net Worth debt form must capture them. Extend the debt `AddItemForm` and inline editing on the debt side.

**Files:**
- Modify: `src/components/networth/NetWorthPage.tsx`

- [ ] **Step 1: Add a richer debt add-form**

In `src/components/networth/NetWorthPage.tsx`, the shared `AddItemForm` is used for both assets and debts. Rather than overload it, add a dedicated `AddDebtForm` component above `NetWorthPage` and use it for the debts column. Insert this component after the existing `AddItemForm`:

```typescript
import type { AssetCategory, DebtCategory, DebtKind, LoanType, CardIssuer, Debt } from '../../types'

const LOAN_TYPES: { value: LoanType; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'cash', label: 'Cash' },
  { value: 'auto', label: 'Auto' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'other', label: 'Other' },
]

const CARD_ISSUERS: { value: CardIssuer; label: string }[] = [
  { value: 'chase', label: 'Chase' },
  { value: 'amex', label: 'Amex' },
  { value: 'discover', label: 'Discover' },
  { value: 'citi', label: 'Citi' },
  { value: 'capital_one', label: 'Capital One' },
  { value: 'other', label: 'Other' },
]

function loanTypeToCategory(t: LoanType): DebtCategory {
  if (t === 'student' || t === 'auto' || t === 'mortgage') return t
  return 'other' // 'cash' has no net-worth category bucket
}

function AddDebtForm({ onAdd }: { onAdd: (debt: Debt) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<DebtKind>('credit_card')
  const [balance, setBalance] = useState('')
  const [apr, setApr] = useState('')
  const [minPayment, setMinPayment] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [issuer, setIssuer] = useState<CardIssuer>('chase')
  const [loanType, setLoanType] = useState<LoanType>('student')
  const [autopay, setAutopay] = useState(true)

  function reset() {
    setLabel(''); setBalance(''); setApr(''); setMinPayment(''); setCreditLimit(''); setOpen(false)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const bal = parseCents(balance)
    if (!label.trim() || bal <= 0) return
    onAdd({
      id: nanoid(),
      label: label.trim(),
      balance: bal,
      kind,
      apr: parseFloat(apr) || 0,
      minPayment: parseCents(minPayment),
      autopay,
      category: kind === 'credit_card' ? 'credit_card' : loanTypeToCategory(loanType),
      ...(kind === 'credit_card'
        ? { issuer, creditLimit: creditLimit ? parseCents(creditLimit) : undefined }
        : { loanType }),
      updatedAt: new Date().toISOString(),
    })
    reset()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-left text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1 px-3 py-2">
        <span className="text-base leading-none">+</span> Add debt
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="px-3 py-3 bg-blue-50/40 rounded-lg mx-1 mb-1 space-y-2">
      <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Canonical name (e.g. Chase Sapphire)"
        className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <div className="flex gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as DebtKind)} className="border border-blue-200 rounded px-2 py-1.5 text-xs bg-white flex-1">
          <option value="credit_card">Credit Card</option>
          <option value="loan">Loan</option>
        </select>
        {kind === 'credit_card' ? (
          <select value={issuer} onChange={(e) => setIssuer(e.target.value as CardIssuer)} className="border border-blue-200 rounded px-2 py-1.5 text-xs bg-white flex-1">
            {CARD_ISSUERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        ) : (
          <select value={loanType} onChange={(e) => setLoanType(e.target.value as LoanType)} className="border border-blue-200 rounded px-2 py-1.5 text-xs bg-white flex-1">
            {LOAN_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Balance $"
          className="flex-1 border border-blue-200 rounded px-2 py-1.5 text-sm bg-white" />
        <input inputMode="decimal" value={apr} onChange={(e) => setApr(e.target.value)} placeholder="APR %"
          className="w-20 border border-blue-200 rounded px-2 py-1.5 text-sm bg-white" />
      </div>
      <div className="flex gap-2">
        <input inputMode="decimal" value={minPayment} onChange={(e) => setMinPayment(e.target.value)} placeholder="Min payment $"
          className="flex-1 border border-blue-200 rounded px-2 py-1.5 text-sm bg-white" />
        {kind === 'credit_card' && (
          <input inputMode="decimal" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="Credit limit $"
            className="flex-1 border border-blue-200 rounded px-2 py-1.5 text-sm bg-white" />
        )}
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={autopay} onChange={(e) => setAutopay(e.target.checked)} /> Autopay
      </label>
      <div className="flex gap-2">
        <button type="submit" className="flex-1 bg-blue-600 text-white text-xs font-medium py-1.5 rounded hover:bg-blue-700">Add</button>
        <button type="button" onClick={reset} className="text-gray-400 text-xs px-3 py-1.5 rounded hover:bg-gray-100">Cancel</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Use `AddDebtForm` in the debts column**

In `NetWorthPage`, replace the debt-column `<AddItemForm type="debt" .../>` block with:

```tsx
<AddDebtForm onAdd={addDebt} />
```

`addDebt` already accepts a full `Debt` (its type is `(debt: Debt) => void`). Remove the now-unused `type="debt"` branch usages if any remain. Leave the asset `AddItemForm` untouched.

- [ ] **Step 3: Show APR + min under each debt row (optional inline display)**

In the debt `.map`, wrap `NetWorthItem` to append a small caption. Replace the debt `NetWorthItem` block with:

```tsx
{debts.map((d) => (
  <div key={d.id}>
    <NetWorthItem
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
    <p className="text-[11px] text-gray-400 px-3 -mt-1 pb-1">
      {d.apr ? `${d.apr}% APR` : 'no APR'} · min {formatCurrency(d.minPayment, sym)}{d.autopay ? ' · autopay' : ''}
    </p>
  </div>
))}
```

- [ ] **Step 4: Verify build + run app**

Run: `npm run build`
Expected: `NetWorthPage.tsx` errors resolved. (Remaining errors only in `StatementPage.tsx`, `ReviewSection.tsx`, `SettingsPage.tsx`, `DashboardPage.tsx`.)

Then run `npm run dev`, open Net Worth, add a credit card with balance/APR/min/limit, confirm it appears with the caption.

- [ ] **Step 5: Commit**

```bash
git add src/components/networth/NetWorthPage.tsx
git commit -m "feat(networth): capture kind/APR/min/limit on debts"
```

---

## Task 9: Tier 2 — Fixed Bills section

**Files:**
- Create: `src/components/statement/FixedBillsSection.tsx`

This section renders the `fixed_bill` expense items with sub-category, autopay, and notes, plus an add-form that warns on debt-like labels. (It is wired into `StatementPage` in Task 12.)

- [ ] **Step 1: Write the component**

Create `src/components/statement/FixedBillsSection.tsx`:

```typescript
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

export function FixedBillsSection({ items, symbol, onAdd, onUpdate, onDelete }: Props) {
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
```

- [ ] **Step 2: Verify it type-checks in isolation**

Run: `npx tsc -b 2>&1 | grep FixedBillsSection`
Expected: no output (file is clean; not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add src/components/statement/FixedBillsSection.tsx
git commit -m "feat(tier2): fixed bills section with debt-keyword guard"
```

---

## Task 10: Tier 3a / 3b — Debt Minimums sections

A single parameterized component renders the registry debts of one `kind`, letting the user enter this month's balance + minimum snapshot per debt. Shows APR and (for cards) utilization.

**Files:**
- Create: `src/components/statement/DebtMinimumsSection.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/statement/DebtMinimumsSection.tsx`:

```typescript
import { useState } from 'react'
import { CurrencyInput } from '../shared/CurrencyInput'
import { formatCurrency } from '../../utils/formatting'
import { utilizationPct } from '../../utils/debt'
import type { Debt, DebtKind, DebtSnapshot } from '../../types'

interface Props {
  kind: DebtKind
  debts: Debt[]                    // full registry
  snapshots: DebtSnapshot[]        // current month's snapshots
  symbol: string
  onSetSnapshot: (debtId: string, data: { balance: number; minPayment: number }) => void
}

function utilizationColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400'
  if (pct > 30) return 'text-red-500'
  if (pct < 10) return 'text-emerald-600'
  return 'text-amber-500'
}

export function DebtMinimumsSection({ kind, debts, snapshots, symbol, onSetSnapshot }: Props) {
  const relevant = debts.filter((d) => d.kind === kind)
  const snapById = new Map(snapshots.map((s) => [s.debtId, s]))

  const totalMin = relevant.reduce((s, d) => s + (snapById.get(d.id)?.minPayment ?? d.minPayment), 0)
  const totalBalance = relevant.reduce((s, d) => s + (snapById.get(d.id)?.balance ?? d.balance), 0)

  const title = kind === 'loan' ? 'Tier 3a — Loan Minimums' : 'Tier 3b — Credit Card Minimums'
  const accent = kind === 'loan' ? 'border-purple-400 bg-purple-50/30' : 'border-pink-400 bg-pink-50/30'
  const tierLabel = kind === 'loan' ? 'Tier 3a' : 'Tier 3b'

  return (
    <div className="mb-1">
      <div className={`flex items-center justify-between px-4 py-2 border-l-4 ${accent}`}>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        <span className="text-xs font-semibold tabular-nums text-gray-600">
          {tierLabel} total: {formatCurrency(totalMin, symbol)}/mo · {formatCurrency(totalBalance, symbol)} balance
        </span>
      </div>
      {relevant.length === 0 ? (
        <p className="text-xs text-gray-300 px-4 py-3">
          No {kind === 'loan' ? 'loans' : 'credit cards'} in the registry. Add them on the Net Worth page.
        </p>
      ) : (
        <table className="w-full">
          <tbody>
            {relevant.map((d) => {
              const snap = snapById.get(d.id)
              const balance = snap?.balance ?? d.balance
              const minPayment = snap?.minPayment ?? d.minPayment
              const util = kind === 'credit_card' ? utilizationPct(balance, d.creditLimit) : null
              return (
                <tr key={d.id} className="border-b border-gray-50">
                  <td className="py-2 pl-4 pr-2 text-sm text-gray-700">
                    {d.label}
                    <span className="ml-2 text-[11px] text-gray-400">{d.apr ? `${d.apr}%` : 'no APR'}</span>
                    {util !== null && <span className={`ml-2 text-[11px] ${utilizationColor(util)}`}>{util.toFixed(0)}% util</span>}
                  </td>
                  <td className="py-2 px-1">
                    <DebtCell label="min" value={minPayment} symbol={symbol}
                      onCommit={(v) => onSetSnapshot(d.id, { balance, minPayment: v })} />
                  </td>
                  <td className="py-2 px-1 pr-4">
                    <DebtCell label="balance" value={balance} symbol={symbol}
                      onCommit={(v) => onSetSnapshot(d.id, { balance: v, minPayment })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function DebtCell({ label, value, symbol, onCommit }: { label: string; value: number; symbol: string; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(value)
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] uppercase text-gray-400">{label}</span>
      <CurrencyInput
        value={draft}
        onChange={setDraft}
        symbol={symbol}
        className="w-28 border border-gray-200 rounded pl-6 pr-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      {draft !== value && (
        <button onClick={() => onCommit(draft)} className="mt-0.5 text-[11px] text-emerald-600 hover:text-emerald-700">save</button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc -b 2>&1 | grep DebtMinimumsSection`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/statement/DebtMinimumsSection.tsx
git commit -m "feat(tier3): loan + credit-card minimum snapshot sections"
```

---

## Task 11: Tier 4 (Rolling) & Tier 7 (Variable) sections

**Files:**
- Create: `src/components/statement/RollingSection.tsx`
- Create: `src/components/statement/VariableSection.tsx`

- [ ] **Step 1: Write `RollingSection.tsx`**

```typescript
import { CurrencyInput } from '../shared/CurrencyInput'
import { formatCurrency } from '../../utils/formatting'
import type { RollingPayment, Debt } from '../../types'

interface Props {
  rolling: RollingPayment
  queueTop: Debt | null   // Debt Queue #1
  symbol: string
  onUpdate: (updates: Partial<RollingPayment>) => void
}

function status(rolling: RollingPayment): { text: string; color: string } {
  if (rolling.paidThisMonth >= rolling.amount && rolling.amount > 0) return { text: 'On track', color: 'text-emerald-600' }
  if (rolling.paidThisMonth === 0) return { text: 'Missed', color: 'text-red-500' }
  return { text: 'Partial', color: 'text-amber-500' }
}

export function RollingSection({ rolling, queueTop, symbol, onUpdate }: Props) {
  const st = status(rolling)
  const offTarget = !!rolling.targetDebtId && !!queueTop && rolling.targetDebtId !== queueTop.id

  return (
    <div className="mb-1">
      <div className="flex items-center justify-between px-4 py-2 border-l-4 border-blue-500 bg-blue-50/30">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tier 4 — Rolling $8K</span>
        <span className={`text-xs font-semibold ${st.color}`}>{st.text}</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 w-32">Rolling amount</label>
          <CurrencyInput value={rolling.amount} onChange={(v) => onUpdate({ amount: v })} symbol={symbol}
            className="w-32 border border-gray-200 rounded pl-6 pr-2 py-1 text-sm bg-white" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 w-32">Current target</label>
          <span className="text-sm font-medium text-gray-800">
            {queueTop ? queueTop.label : <span className="text-gray-400">— no debt in queue —</span>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 w-32">Paid this month</label>
          <CurrencyInput value={rolling.paidThisMonth}
            onChange={(v) => onUpdate({ paidThisMonth: v, targetDebtId: rolling.targetDebtId ?? queueTop?.id ?? null })}
            symbol={symbol}
            className="w-32 border border-gray-200 rounded pl-6 pr-2 py-1 text-sm bg-white" />
        </div>
        {offTarget && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠ This payment did not go to your #1 target ({queueTop?.label}). Confirm the framework override is intentional.
          </p>
        )}
        <p className="text-[11px] text-gray-400">Committed {formatCurrency(rolling.amount, symbol)} / paid {formatCurrency(rolling.paidThisMonth, symbol)}.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `VariableSection.tsx`**

```typescript
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
  onDelete: (id: string) => void
}

export function VariableSection({ items, symbol, onAdd, onDelete }: Props) {
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
            <tr key={item.id} className="border-b border-gray-50 group hover:bg-gray-50/50">
              <td className="py-2.5 pl-4 pr-2 text-sm text-gray-700">
                {item.label}
                {item.variableCategory && <span className="ml-2 text-[11px] text-gray-400 uppercase">{item.variableCategory}</span>}
              </td>
              <td className="py-2.5 px-2 text-sm text-right font-medium tabular-nums text-gray-800">{formatCurrency(item.amount, symbol)}</td>
              <td className="py-2.5 pr-4 pl-2">
                <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-50 transition">✕</button>
              </td>
            </tr>
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
                    className="w-28 border border-red-200 rounded pl-6 pr-2 py-1.5 text-sm bg-white" />
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
```

- [ ] **Step 3: Verify they type-check**

Run: `npx tsc -b 2>&1 | grep -E 'RollingSection|VariableSection'`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/statement/RollingSection.tsx src/components/statement/VariableSection.tsx
git commit -m "feat(tier4,tier7): rolling payment + variable/discretionary sections"
```

---

## Task 12: Debt Tracking section (cards table, loans table, payoff queue)

**Files:**
- Create: `src/components/debt/DebtTrackingSection.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/debt/DebtTrackingSection.tsx`:

```typescript
import { formatCurrency } from '../../utils/formatting'
import { buildDebtQueue, utilizationPct } from '../../utils/debt'
import type { Debt, DebtGroup, DebtSnapshot } from '../../types'

interface Props {
  debts: Debt[]
  snapshots: DebtSnapshot[]      // current month — overrides registry balance where present
  grouping: DebtGroup[]
  rollingAmount: number
  symbol: string
}

const GROUP_LABEL: Record<DebtGroup, string> = {
  credit_card: 'CC', cash: 'Cash', student: 'Student', auto: 'Auto', mortgage: 'Mortgage', other: 'Other',
}

export function DebtTrackingSection({ debts, snapshots, grouping, rollingAmount, symbol }: Props) {
  // Effective balances: monthly snapshot wins over the registry's live balance.
  const snapById = new Map(snapshots.map((s) => [s.debtId, s]))
  const effective = debts.map((d) => ({
    ...d,
    balance: snapById.get(d.id)?.balance ?? d.balance,
    minPayment: snapById.get(d.id)?.minPayment ?? d.minPayment,
  }))

  const cards = effective.filter((d) => d.kind === 'credit_card')
  const loans = effective.filter((d) => d.kind === 'loan')
  const totalCardDebt = cards.reduce((s, d) => s + d.balance, 0)
  const totalLoanDebt = loans.reduce((s, d) => s + d.balance, 0)
  const queue = buildDebtQueue(effective, grouping, rollingAmount)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 mb-4 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Debt Tracking</h2>
        <span className="text-sm font-semibold tabular-nums text-red-500">{formatCurrency(totalCardDebt + totalLoanDebt, symbol)} total</span>
      </div>

      {/* Credit Cards */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Credit Cards · {formatCurrency(totalCardDebt, symbol)}</p>
        <Table head={['Card', 'Balance', 'APR', 'Min', 'Util']}>
          {cards.map((d) => {
            const util = utilizationPct(d.balance, d.creditLimit)
            return (
              <tr key={d.id} className="border-b border-gray-50">
                <td className="py-1.5 text-sm text-gray-700">{d.label}</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(d.balance, symbol)}</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{d.apr}%</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(d.minPayment, symbol)}</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{util === null ? '—' : `${util.toFixed(0)}%`}</td>
              </tr>
            )
          })}
        </Table>
      </div>

      {/* Loans */}
      <div className="px-4 py-3 border-t border-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Loans · {formatCurrency(totalLoanDebt, symbol)}</p>
        <Table head={['Loan', 'Balance', 'APR', 'Min', 'Type']}>
          {loans.map((d) => (
            <tr key={d.id} className="border-b border-gray-50">
              <td className="py-1.5 text-sm text-gray-700">{d.label}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(d.balance, symbol)}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{d.apr}%</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(d.minPayment, symbol)}</td>
              <td className="py-1.5 text-sm text-right capitalize">{d.loanType ?? 'other'}</td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Payoff Queue */}
      <div className="px-4 py-3 border-t border-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Debt Payoff Queue · highest APR first</p>
        <Table head={['#', 'Type', 'Name', 'Balance', 'APR', 'Min', 'Months @ rolling']}>
          {queue.map((q) => (
            <tr key={q.debt.id} className={q.rank === 1 ? 'bg-emerald-50' : 'border-b border-gray-50'}>
              <td className="py-1.5 text-sm font-semibold">#{q.rank}</td>
              <td className="py-1.5 text-sm">{GROUP_LABEL[q.group]}</td>
              <td className="py-1.5 text-sm text-gray-700">{q.debt.label}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(q.debt.balance, symbol)}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{q.debt.apr}%</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{formatCurrency(q.debt.minPayment, symbol)}</td>
              <td className="py-1.5 text-sm text-right tabular-nums">{q.monthsToClear ?? '—'}</td>
            </tr>
          ))}
        </Table>
        {queue.length === 0 && <p className="text-xs text-gray-300 py-2">No debts in the registry yet.</p>}
      </div>
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full">
      <thead>
        <tr>{head.map((h, i) => <th key={h} className={`text-[11px] font-medium text-gray-400 uppercase pb-1 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc -b 2>&1 | grep DebtTrackingSection`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/debt/DebtTrackingSection.tsx
git commit -m "feat(debt): debt tracking section with cards/loans tables + payoff queue"
```

---

## Task 13: Wire the new sections into `StatementPage`

Replace the Fixed/Variable `SectionTable`s with the five tier components and add the Debt Tracking section below Expenses.

**Files:**
- Modify: `src/components/statement/StatementPage.tsx`

- [ ] **Step 1: Update imports and destructured hooks**

At the top of `src/components/statement/StatementPage.tsx`, ensure these imports exist (remove the now-unused `SectionTable` and `AddLineItemForm` imports for expenses if no longer referenced — income still uses them, so keep them):

```typescript
import { FixedBillsSection } from './FixedBillsSection'
import { DebtMinimumsSection } from './DebtMinimumsSection'
import { RollingSection } from './RollingSection'
import { VariableSection } from './VariableSection'
import { DebtTrackingSection } from '../debt/DebtTrackingSection'
import { buildDebtQueue } from '../../utils/debt'
```

In the destructured `useMonthData(yearMonth)` call, add the new actions:

```typescript
const {
  record,
  addIncome, updateIncome, deleteIncome,
  addExpense, updateExpense, deleteExpense,
  updateReview,
  setDebtSnapshot, updateRolling,
  copyFromRecord,
} = useMonthData(yearMonth)
```

(`debts` is already pulled from `useNetWorth()` per Task 6.)

- [ ] **Step 2: Replace the expense filters and the Expenses card body**

Replace these lines:
```typescript
const fixedExpenses = record.expenses.filter((e) => e.subcategory === 'fixed')
const variableExpenses = record.expenses.filter((e) => e.subcategory === 'variable')
```
with:
```typescript
const fixedBills = record.expenses.filter((e) => e.subcategory === 'fixed_bill')
const variableItems = record.expenses.filter((e) => e.subcategory === 'variable')
const queue = buildDebtQueue(debts, settings.queueGrouping, record.rolling.amount)
const queueTop = queue[0]?.debt ?? null
```

Then replace the entire Expenses `<div className="bg-white ...">...</div>` block (the one containing the two `SectionTable` calls for Fixed and Variable) with:

```tsx
{/* Expenses — Cash Waterfall tiers */}
<div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
    <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Expenses</h2>
    <span className="text-sm font-semibold tabular-nums text-red-500">{formatCurrency(metrics.totalExpenses, sym)}</span>
  </div>

  <FixedBillsSection
    items={fixedBills}
    symbol={sym}
    onAdd={addExpense}
    onUpdate={(id, u) => updateExpense(id, u)}
    onDelete={deleteExpense}
  />

  <DebtMinimumsSection
    kind="loan"
    debts={debts}
    snapshots={record.debtSnapshots}
    symbol={sym}
    onSetSnapshot={setDebtSnapshot}
  />

  <DebtMinimumsSection
    kind="credit_card"
    debts={debts}
    snapshots={record.debtSnapshots}
    symbol={sym}
    onSetSnapshot={setDebtSnapshot}
  />

  <RollingSection
    rolling={record.rolling}
    queueTop={queueTop}
    symbol={sym}
    onUpdate={updateRolling}
  />

  <VariableSection
    items={variableItems}
    symbol={sym}
    onAdd={addExpense}
    onDelete={deleteExpense}
  />
</div>

{/* Debt Tracking — sits below Expenses */}
<DebtTrackingSection
  debts={debts}
  snapshots={record.debtSnapshots}
  grouping={settings.queueGrouping}
  rollingAmount={record.rolling.amount}
  symbol={sym}
/>
```

- [ ] **Step 3: Keep `updateDebt` available for snapshot→registry sync (optional)**

The hybrid model keeps the registry's `balance` as the "live" value. When the user saves a monthly snapshot we also want the registry balance to track the latest month so Net Worth stays current. In `setDebtSnapshot`'s call site, after setting the snapshot, also push the balance to the registry. Wrap the handler:

```typescript
function handleSetSnapshot(debtId: string, data: { balance: number; minPayment: number }) {
  setDebtSnapshot(debtId, data)
  updateDebt(debtId, { balance: data.balance })
}
```

Use `onSetSnapshot={handleSetSnapshot}` in both `DebtMinimumsSection` calls instead of `setDebtSnapshot`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: `StatementPage.tsx` errors resolved. Remaining errors only in `ReviewSection.tsx`, `SettingsPage.tsx`, `DashboardPage.tsx`.

- [ ] **Step 5: Run the app and smoke-test**

Run `npm run dev`. On a month: add a fixed bill (try a label "Chase card" → expect the debt-keyword confirm). Confirm the loan/card minimum sections list registry debts and let you save a monthly balance/min. Set rolling paid, confirm status + off-target warning. Add a variable item. Confirm the Debt Tracking tables + payoff queue render with #1 highlighted.

- [ ] **Step 6: Commit**

```bash
git add src/components/statement/StatementPage.tsx
git commit -m "feat(statement): replace fixed/variable with waterfall tiers + debt tracking"
```

---

## Task 14: Settings additions

**Files:**
- Modify: `src/components/dashboard/SettingsPage.tsx`

- [ ] **Step 1: Add a "Waterfall & Debt" settings card**

In `src/components/dashboard/SettingsPage.tsx`, import `CurrencyInput` and `DEFAULT_ROLLING_CENTS`:

```typescript
import { CurrencyInput } from '../shared/CurrencyInput'
import type { AppSettings, DebtGroup } from '../../types'
```

After the existing "Targets" card `</div>` (the one closing the targets block) and before the "Data" `<div className="mt-8">`, insert:

```tsx
<div className="mt-8">
  <h2 className="text-lg font-semibold text-gray-900 mb-1">Waterfall & Debt</h2>
  <p className="text-sm text-gray-400 mb-4">Constants that drive the Cash Waterfall and payoff queue.</p>
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Rolling amount (Tier 4)</label>
      <CurrencyInput
        value={form.rollingAmount}
        onChange={(v) => setForm({ ...form, rollingAmount: v })}
        symbol={form.currencySymbol}
        className="w-40 border border-gray-200 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <p className="text-xs text-gray-400 mt-1.5">Above-minimum debt paydown applied to queue #1. Default $8,000.</p>
    </div>

    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Burn-rate override (months)</label>
      <input
        type="number" min={1} max={12} step={1}
        value={form.burnRateOverrideMonths}
        onChange={(e) => setForm({ ...form, burnRateOverrideMonths: Number(e.target.value) || 1 })}
        className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <p className="text-xs text-gray-400 mt-1.5">Consecutive months over 100% burn that pause Tier 5. Default 2.</p>
    </div>

    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Debt payoff rule</label>
      <select
        value={form.payoffMode}
        onChange={(e) => setForm({ ...form, payoffMode: e.target.value as AppSettings['payoffMode'] })}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="apr">Highest APR first (avalanche)</option>
        <option value="snowball">Lowest balance first (snowball)</option>
      </select>
      <p className="text-xs text-gray-400 mt-1.5">Queue grouping: {form.queueGrouping.map((g) => g.replace('_', ' ')).join(' → ')}</p>
    </div>

    <button
      type="button"
      onClick={() => { save(form); setSaved(true); setTimeout(() => setSaved(false), 2000) }}
      className="w-full bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
    >
      {saved ? '✓ Saved' : 'Save'}
    </button>
  </div>
</div>
```

> Note: `payoffMode: 'snowball'` is captured but `buildDebtQueue` only implements APR ordering in this plan. Snowball is a future enhancement; the setting persists so the queue can honor it later. The `queueGrouping` is shown read-only (editing order is a future enhancement; the default covers Rule #1).

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `SettingsPage.tsx` errors resolved. Remaining only in `ReviewSection.tsx`, `DashboardPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/SettingsPage.tsx
git commit -m "feat(settings): rolling amount, burn override, payoff mode"
```

---

## Task 15: Monthly Review integration

Add a waterfall-commitments block and a debt-delta block to the Review section, fed by the new metrics + `computeDebtDelta`.

**Files:**
- Modify: `src/components/review/ReviewSection.tsx`

- [ ] **Step 1: Compute debt delta and pass prior snapshots**

`ReviewSection` already receives `record`, `metrics`, and uses `useNetWorth()` for `debts`. It needs the prior month's `debtSnapshots`. `StatementPage` already has `priorRecord` from `useComparison`. Add a `priorRecord` prop.

In `StatementPage.tsx`, pass it:
```tsx
<ReviewSection
  record={record}
  metrics={metrics}
  delta={delta}
  lineItemDeltas={lineItemDeltas}
  priorReview={priorRecord?.review ?? null}
  priorRecord={priorRecord}
  settings={settings}
  onUpdateReview={updateReview}
/>
```

In `ReviewSection.tsx`, extend `Props`:
```typescript
import { computeDebtDelta } from '../../utils/debt'
// ...
interface Props {
  record: MonthRecord
  metrics: MonthMetrics
  delta: MonthDelta | null
  lineItemDeltas: LineItemDelta[]
  priorReview: ReviewData | null
  priorRecord: MonthRecord | null
  settings: AppSettings
  onUpdateReview: (review: ReviewData) => void
}
```
and destructure `priorRecord` in the function params.

- [ ] **Step 2: Add the waterfall + debt-delta computed values**

Inside the component, after `const { debts } = useNetWorth()`:

```typescript
const debtDelta = priorRecord
  ? computeDebtDelta(record.debtSnapshots, priorRecord.debtSnapshots, debts)
  : null
```

- [ ] **Step 3: Render a "Current waterfall commitments" block**

Immediately after the "True consumption burn rate" `<div>` (inside the headline/burn `space-y-3` container's parent, i.e. right before the `<div className="border-t border-gray-100" />` that precedes the Debt block), insert a new block:

```tsx
<div className="border-t border-gray-100" />

<div>
  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Current waterfall commitments</p>
  <ul className="space-y-1.5 text-sm text-gray-800">
    {[
      { label: 'Tier 2 — Fixed bills', amount: metrics.tier2Total },
      { label: 'Tier 3a — Loan minimums', amount: metrics.tier3aTotal },
      { label: 'Tier 3b — CC minimums', amount: metrics.tier3bTotal },
      { label: 'Tier 4 — Rolling', amount: record.rolling.amount },
    ].map(({ label, amount }) => (
      <li key={label} className="flex items-baseline gap-2">
        <span className="text-gray-400">•</span>
        <span className="w-48">{label}:</span>
        <span className="font-semibold text-gray-900 tabular-nums">{fmt(amount)}</span>
      </li>
    ))}
    <li className="flex items-baseline gap-2 pt-1 border-t border-gray-50">
      <span className="text-gray-400">•</span>
      <span className="w-48 font-medium">Total committed:</span>
      <span className="font-semibold text-gray-900 tabular-nums">{fmt(metrics.totalCommitted)}</span>
    </li>
    <li className="flex items-baseline gap-2">
      <span className="text-gray-400">•</span>
      <span className="w-48 font-medium">Remaining for Tiers 5–7:</span>
      <span className={`font-semibold tabular-nums ${metrics.remainingForLowerTiers < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmt(metrics.remainingForLowerTiers)}</span>
    </li>
  </ul>
</div>
```

- [ ] **Step 4: Render debt-delta inside the existing Debt block**

In the existing Debt block `<ul>`, after the "Total debt" `<li>`, add a debt-delta line:

```tsx
{debtDelta && (
  <li className="flex items-baseline gap-2">
    <span className="text-gray-400">•</span>
    <span>
      Debt change vs last month — CC {renderDelta(debtDelta.creditCardDelta)} · Loans {renderDelta(debtDelta.loanDelta)} · Total {renderDelta(debtDelta.totalDelta)}
    </span>
  </li>
)}
```

(`renderDelta` already treats a positive number as "down/paid", which matches `computeDebtDelta`'s sign convention.)

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: `ReviewSection.tsx` errors resolved. Only `DashboardPage.tsx` may remain (Task 16).

- [ ] **Step 6: Commit**

```bash
git add src/components/review/ReviewSection.tsx src/components/statement/StatementPage.tsx
git commit -m "feat(review): waterfall commitments + month-over-month debt delta"
```

---

## Task 16: Dashboard prominence + Sidebar/route for migration

**Files:**
- Modify: `src/components/dashboard/DashboardPage.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Read the current DashboardPage**

Run: `sed -n '1,80p' src/components/dashboard/DashboardPage.tsx` to see its structure before editing. (It renders metric cards for the current month.)

- [ ] **Step 2: Add a "Current Rolling $8K target" card to the Dashboard**

In `DashboardPage.tsx`, import the registry and queue:

```typescript
import { useNetWorth } from '../../hooks/useNetWorth'
import { useSettings } from '../../hooks/useSettings'
import { getMonth } from '../../utils/storage'
import { currentYearMonth } from '../../hooks/useMonthData'
import { buildDebtQueue } from '../../utils/debt'
import { formatCurrency } from '../../utils/formatting'
```

Inside the component, compute the queue top from the current month's rolling amount (fall back to settings):

```typescript
const { debts } = useNetWorth()
const { settings } = useSettings()
const thisMonth = getMonth(currentYearMonth())
const rollingAmount = thisMonth?.rolling.amount ?? settings.rollingAmount
const queueTop = buildDebtQueue(debts, settings.queueGrouping, rollingAmount)[0] ?? null
```

Add this card near the top of the dashboard's returned JSX (above or beside the existing metric cards):

```tsx
{queueTop && (
  <div className="bg-gray-900 text-white rounded-xl p-5 mb-4">
    <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Current Rolling target</p>
    <p className="text-2xl font-bold text-emerald-400">{queueTop.debt.label}</p>
    <p className="text-sm text-gray-300 mt-1">
      {formatCurrency(queueTop.debt.balance, settings.currencySymbol)} @ {queueTop.debt.apr}% ·
      {' '}~{queueTop.monthsToClear ?? '—'} months at {formatCurrency(rollingAmount, settings.currencySymbol)}/mo
    </p>
  </div>
)}
```

- [ ] **Step 3: Add the migration route**

In `src/App.tsx`, add the import and route:

```typescript
import { MigrationPage } from './components/migration/MigrationPage'
// ...
<Route path="/migrate" element={<MigrationPage />} />
```

(The `MigrationPage` file is created in Task 17; this route will fail to compile until then — that's fine, do Task 17 immediately after, or reorder so Task 17 precedes this step. The commit at the end of Task 17 should be the one that leaves the build green.)

- [ ] **Step 4: Add the Sidebar nav entry**

In `src/components/layout/Sidebar.tsx`, after the Settings `<Link>`, add:

```tsx
<Link
  to="/migrate"
  onClick={onClose}
  className={clsx(
    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm no-underline transition-colors',
    location.pathname === '/migrate'
      ? 'bg-gray-700 text-white'
      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
  )}
>
  <span>⇄</span> Migrate data
</Link>
```

- [ ] **Step 5: Commit (after Task 17 makes it compile)**

Defer the commit for `App.tsx`/`Sidebar.tsx`/`DashboardPage.tsx` until Task 17 creates `MigrationPage`. Then:

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx src/components/dashboard/DashboardPage.tsx
git commit -m "feat(dashboard): prominent rolling target + migration nav/route"
```

---

## Task 17: Migration tool

A one-time screen that reads existing months, finds legacy `fixed`/`variable` items that look like debts, lets the user create registry debts from them, and reclassifies the rest into `fixed_bill`/`variable`.

**Files:**
- Create: `src/components/migration/MigrationPage.tsx`

- [ ] **Step 1: Write the migration page**

Create `src/components/migration/MigrationPage.tsx`:

```typescript
import { useMemo, useState } from 'react'
import { getIndex, getMonth, setMonth, getDebts } from '../../utils/storage'
import { useNetWorth } from '../../hooks/useNetWorth'
import { classifyDebtKind, looksLikeDebt } from '../../utils/debtKeywords'
import { formatCurrency, parseCents } from '../../utils/formatting'
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
```

- [ ] **Step 2: Verify the full build is green**

Run: `npm run build`
Expected: PASS — zero TypeScript errors across the project (this is the first task that closes the loop opened in Task 1).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites (`storage`, `debt`, `calculations`, `debtKeywords`, plus any pre-existing tests).

- [ ] **Step 4: Manual end-to-end smoke test**

Run `npm run dev`. Then:
1. Open `/migrate` — confirm debt-like legacy items are listed; fill balance/APR/min for one; import.
2. Confirm a debt appears on Net Worth.
3. Open a month — confirm the imported item no longer shows as a fixed bill, and the loan/CC minimum sections list the new debt.
4. Confirm the Debt Tracking payoff queue and Dashboard "Current Rolling target" card render.

- [ ] **Step 5: Commit (this commit also lands the deferred Task 16 files)**

```bash
git add src/components/migration/MigrationPage.tsx src/App.tsx src/components/layout/Sidebar.tsx src/components/dashboard/DashboardPage.tsx
git commit -m "feat(migration): in-app migration tool; wire route, nav, dashboard target"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §1 Tier 2 Fixed Bills (fields, debt-keyword validation, subtotal) → Task 9. ✓
- §2 Tier 3a Loan Minimums (fields, subtotal) → Tasks 8 (registry fields) + 10 (monthly snapshot UI). ✓
- §3 Tier 3b CC Minimums (fields, utilization color, subtotal) → Tasks 8 + 10 (`utilizationColor`). ✓
- §4 Tier 4 Rolling (amount, current target, paid, status, off-target warning) → Task 11. ✓
- §5 Tier 7 Variable rename + category tags → Task 11. ✓
- §6 Debt Tracking (cards table, loans table, queue sorted APR-desc grouped, prominent #1) → Tasks 12 + 16. ✓
- §7 Monthly Review integration (waterfall commitments, debt delta) → Task 15. ✓
- §8 Settings (rolling amount, burn override, payoff rule, grouping display) → Task 14. ✓
- Data migration notes → Task 17. ✓
- Naming conventions (canonical name, aliases field, no miscellaneous) → `aliases` on `Debt` (Task 1); registry dedup in migration (Task 17). ✓ (No "miscellaneous" category is introduced; unknown loan types fall to `'other'` which is an explicit bucket, not a catch-all expense category.)

**Known simplifications (documented, not gaps):**
- `monthsToClear` uses standalone `ceil(balance / rollingAmount)` (ignores interest and the cascade), matching the spec's example values for Amex (6) and Chase (1). Cascade-accurate projection is a future enhancement.
- `payoffMode: 'snowball'` and editable `queueGrouping` order persist in settings but the queue only implements APR ordering with the default grouping. Flagged inline in Task 14.
- Burn-rate override (pause Tier 5 after N months >100%) stores the threshold; Tiers 5/6 themselves are not part of this dashboard's expense entry, so no enforcement UI is built — consistent with the spec, which only asks for the constant.
- Future Enhancements (§"Optional") — auto-snapshot on the 14th, APR alerts, income-tier progress bar, Plaid/CSV import — intentionally out of scope.

**Type consistency:** `setDebtSnapshot(debtId, {balance, minPayment})` signature is identical across `useMonthData` (Task 5), `DebtMinimumsSection` props (Task 10), and the `handleSetSnapshot` wrapper (Task 13). `RollingPayment`/`DebtSnapshot`/`DebtGroup`/`QueueEntry` names are used identically wherever referenced. `computeMetrics(record, debts)` arity is updated at every call site (Tasks 4, 6).

**Placeholder scan:** No TODO/TBD/"add error handling"/"similar to Task N" placeholders; every code step contains complete code.
