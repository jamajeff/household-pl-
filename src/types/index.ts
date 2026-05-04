export type Person = 'person1' | 'person2' | 'shared'

export type IncomeSubcategory = 'active' | 'semi_active' | 'passive'

export type ExpenseSubcategory = 'fixed' | 'variable'

export type AssetCategory = 'investment' | 'savings' | 'real_estate' | 'other'
export type DebtCategory = 'mortgage' | 'auto' | 'student' | 'credit_card' | 'other'

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
  label: string
  balance: number // integer cents
  category: DebtCategory
  updatedAt: string
}

export interface ReviewData {
  keyChanges: string
  actionItems: [string, string, string]
}

export interface MonthRecord {
  yearMonth: string // "YYYY-MM"
  income: IncomeLineItem[]
  expenses: ExpenseLineItem[]
  review: ReviewData
  updatedAt: string
}

export interface AppSettings {
  person1Name: string
  person2Name: string
  currencySymbol: string
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
  fixedExpenses: number
  variableExpenses: number
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
