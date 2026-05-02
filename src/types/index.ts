export type Person = 'person1' | 'person2' | 'shared'

export type IncomeSubcategory = 'active' | 'semi_active' | 'passive'

export type ExpenseSubcategory = 'fixed' | 'variable' | 'wealth'

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
  wealthBuildingTotal: number
  netCashFlow: number
  savingsRate: number
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
  wealthBuildingTotal: number
  netCashFlow: number
  savingsRate: number
  burnRate: number
}

export interface LineItemDelta {
  label: string
  currentAmount: number | null
  priorAmount: number | null
  delta: number
  status: 'new' | 'removed' | 'changed' | 'unchanged'
}
