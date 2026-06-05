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
