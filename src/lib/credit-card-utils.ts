import type { CreditCard, CreditCardBalance, Transaction } from './types'

export function getBillingCycle(closingDay: number, referenceDate: Date = new Date()): { start: Date; end: Date; label: string } {
  const ref = new Date(referenceDate)
  ref.setHours(0, 0, 0, 0)

  const day = ref.getDate()

  let cycleEndYear = ref.getFullYear()
  let cycleEndMonth = ref.getMonth()

  // If today is after (or on) closing day, cycle ends on closing_day of next month
  if (day > closingDay) {
    cycleEndMonth += 1
    if (cycleEndMonth > 11) { cycleEndMonth = 0; cycleEndYear += 1 }
  }

  const end = new Date(cycleEndYear, cycleEndMonth, closingDay)

  // Start = closing_day+1 of previous month relative to end
  const startMonth = cycleEndMonth === 0 ? 11 : cycleEndMonth - 1
  const startYear = cycleEndMonth === 0 ? cycleEndYear - 1 : cycleEndYear
  const start = new Date(startYear, startMonth, closingDay + 1)

  const label = `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`

  return { start, end, label }
}

export function getNextDueDate(dueDay: number, closingDay: number, referenceDate: Date = new Date()): string {
  const { end } = getBillingCycle(closingDay, referenceDate)

  // Due date is dueDay of the month after the cycle closes
  const dueMonth = end.getMonth() + 1
  const dueYear = dueMonth > 11 ? end.getFullYear() + 1 : end.getFullYear()
  const dueMonthNormalized = dueMonth > 11 ? 0 : dueMonth

  const due = new Date(dueYear, dueMonthNormalized, dueDay)
  return due.toISOString().split('T')[0]
}

export function isInBillingCycle(txDate: string, closingDay: number, referenceDate: Date = new Date()): boolean {
  const { start, end } = getBillingCycle(closingDay, referenceDate)
  const date = new Date(txDate + 'T00:00:00')
  return date >= start && date <= end
}

export function computeCardBalance(card: CreditCard, transactions: Transaction[]): CreditCardBalance {
  const { start, end } = getBillingCycle(card.closing_day)
  const cardTxs = transactions.filter((t) => t.credit_card_id === card.id)

  // Current billing cycle PENDING expenses (charges not yet paid)
  const currentFaturaTotal = cardTxs
    .filter((t) => {
      if (t.type !== 'expense') return false
      if (t.status === 'settled') return false  // already paid in a previous fatura
      const d = new Date(t.date + 'T00:00:00')
      return d >= start && d <= end
    })
    .reduce((s, t) => s + t.amount, 0)

  // Outstanding balance = ALL pending card charges (unpaid across all cycles)
  const outstandingBalance = cardTxs
    .filter((t) => t.type === 'expense' && t.status === 'pending')
    .reduce((s, t) => s + t.amount, 0)

  const availableCredit = Math.max(0, card.credit_limit - outstandingBalance)
  const utilizationPct = card.credit_limit > 0 ? (outstandingBalance / card.credit_limit) * 100 : 0
  const nextDueDate = getNextDueDate(card.due_day, card.closing_day)
  const nextClosingDate = end.toISOString().split('T')[0]

  return {
    ...card,
    currentFaturaTotal,
    outstandingBalance,
    availableCredit,
    utilizationPct,
    nextDueDate,
    nextClosingDate,
  }
}

export function groupTransactionsByBillingCycle(
  transactions: Transaction[],
  closingDay: number,
): { label: string; start: Date; end: Date; transactions: Transaction[] }[] {
  if (transactions.length === 0) return []

  const cycles: Map<string, { label: string; start: Date; end: Date; transactions: Transaction[] }> = new Map()

  for (const tx of transactions) {
    const txDate = new Date(tx.date + 'T00:00:00')
    const cycle = getBillingCycle(closingDay, txDate)
    const key = cycle.end.toISOString().split('T')[0]
    if (!cycles.has(key)) cycles.set(key, { ...cycle, transactions: [] })
    cycles.get(key)!.transactions.push(tx)
  }

  return Array.from(cycles.values()).sort((a, b) => b.end.getTime() - a.end.getTime())
}
