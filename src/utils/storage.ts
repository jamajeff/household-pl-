import type { AppSettings, MonthRecord, Asset, Debt, ReviewData, DebtSnapshot, RollingPayment, DebtKind, LoanType } from '../types'

export interface ExportedData {
  version: number
  exportedAt: string
  settings: AppSettings
  index: string[]
  months: Record<string, MonthRecord | null>
  assets: Asset[]
  debts: Debt[]
}

const PREFIX = 'pl:'
const INDEX_KEY = `${PREFIX}index`
const SETTINGS_KEY = `${PREFIX}settings`
const ASSETS_KEY = `${PREFIX}assets`
const DEBTS_KEY = `${PREFIX}debts`

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

export function getIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function setIndex(months: string[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(months))
}

export function getMonth(yearMonth: string): MonthRecord | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${yearMonth}`)
    if (!raw) return null
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
  } catch {
    return null
  }
}

export function setMonth(record: MonthRecord): void {
  const key = `${PREFIX}${record.yearMonth}`
  localStorage.setItem(key, JSON.stringify(record))
  const index = getIndex()
  if (!index.includes(record.yearMonth)) {
    const updated = [...index, record.yearMonth].sort()
    setIndex(updated)
  }
}

export function deleteMonth(yearMonth: string): void {
  localStorage.removeItem(`${PREFIX}${yearMonth}`)
  const index = getIndex().filter((m) => m !== yearMonth)
  setIndex(index)
}

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function setSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function getAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(ASSETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function setAssets(assets: Asset[]): void {
  localStorage.setItem(ASSETS_KEY, JSON.stringify(assets))
}

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
      loanType: d.loanType ?? (d.category === 'credit_card' ? undefined : inferLoanType(d.category)),
    })) as Debt[]
  } catch {
    return []
  }
}

export function setDebts(debts: Debt[]): void {
  localStorage.setItem(DEBTS_KEY, JSON.stringify(debts))
}

export function exportAllData(): ExportedData {
  const index = getIndex()
  const months: Record<string, MonthRecord | null> = {}
  for (const ym of index) months[ym] = getMonth(ym)
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    index,
    months,
    assets: getAssets(),
    debts: getDebts(),
  }
}

export function importAllData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!Array.isArray(d.index)) return false
  if (d.settings) setSettings(d.settings as AppSettings)
  setIndex(d.index as string[])
  const months = (d.months ?? {}) as Record<string, MonthRecord>
  for (const ym of d.index as string[]) {
    if (months[ym]) setMonth(months[ym])
  }
  if (Array.isArray(d.assets)) setAssets(d.assets as Asset[])
  if (Array.isArray(d.debts)) setDebts(d.debts as Debt[])
  return true
}
