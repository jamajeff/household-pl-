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

export interface ReviewData {
  targetDebtSnapshot: number | null   // target debt balance at month-end, in cents
  totalDebtSnapshot: number | null    // sum of all debt balances at month-end, in cents
  snapshotTakenAt: string | null      // ISO timestamp of last snapshot
  oneStepIncomeTier: string           // freeform — bottom-two leverage action
  oneWin: string
  oneToWatch: string
  oneDecisionNext: string
}

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

export interface MonthRecord {
  yearMonth: string // "YYYY-MM"
  income: IncomeLineItem[]
  expenses: ExpenseLineItem[]   // now Tier 2 (fixed_bill) + Tier 7 (variable) only
  debtSnapshots: DebtSnapshot[] // Tier 3a/3b monthly data
  rolling: RollingPayment       // Tier 4
  review: ReviewData
  updatedAt: string
}

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

export interface MonthDelta {
  totalRevenue: number
  totalExpenses: number
  netCashFlow: number
  burnRate: number
}

export interface LineItemDelta {
  label: string
  currentAmount: number | null
  priorAmount: number | null
  delta: number
  status: 'new' | 'removed' | 'changed' | 'unchanged'
}
