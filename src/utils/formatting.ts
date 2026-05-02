export function formatCurrency(cents: number, symbol = '$'): string {
  const dollars = cents / 100
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(dollars))
  return `${dollars < 0 ? '-' : ''}${symbol}${formatted}`
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

export function parseCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, '')
  const dollars = parseFloat(cleaned) || 0
  return Math.round(dollars * 100)
}

export function labelMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export function shortMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}
