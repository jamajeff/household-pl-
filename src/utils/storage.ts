import type { AppSettings, MonthRecord } from '../types'

const PREFIX = 'pl:'
const INDEX_KEY = `${PREFIX}index`
const SETTINGS_KEY = `${PREFIX}settings`

const DEFAULT_SETTINGS: AppSettings = {
  person1Name: 'Person 1',
  person2Name: 'Person 2',
  currencySymbol: '$',
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
    return raw ? JSON.parse(raw) : null
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
