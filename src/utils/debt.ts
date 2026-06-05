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
