'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/csv-export'
import type { CreditCardBalance, BudgetVsActual } from '@/lib/types'

interface DashboardAlertsProps {
  cards: CreditCardBalance[]
  budgetItems: BudgetVsActual[]
}

interface Alert {
  key: string
  text: string
  href: string
  severity: 'high' | 'medium'
}

export function DashboardAlerts({ cards, budgetItems }: DashboardAlertsProps) {
  const alerts: Alert[] = []

  for (const card of cards) {
    const dueDate = new Date(card.nextDueDate + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntilDue < 0) {
      alerts.push({ key: `card-${card.id}`, text: `Fatura do ${card.name} venceu há ${-daysUntilDue}d (${formatCurrency(card.outstandingBalance)})`, href: '/credit-cards', severity: 'high' })
    } else if (daysUntilDue <= 5) {
      alerts.push({ key: `card-${card.id}`, text: `Fatura do ${card.name} vence em ${daysUntilDue}d (${formatCurrency(card.outstandingBalance)})`, href: '/credit-cards', severity: 'medium' })
    }
  }

  for (const item of budgetItems) {
    if (item.actual > item.budgeted && item.budgeted > 0) {
      alerts.push({ key: `budget-${item.category}`, text: `${item.category} passou do orçamento: ${formatCurrency(item.actual)} de ${formatCurrency(item.budgeted)}`, href: '/budget', severity: 'high' })
    }
  }

  if (alerts.length === 0) return null

  const hasHigh = alerts.some((a) => a.severity === 'high')

  return (
    <div
      className="rounded-lg border-l-4 bg-card px-4 py-3"
      style={{ borderLeftColor: hasHigh ? 'var(--destructive)' : '#d97706' }}
    >
      <div className="space-y-1.5">
        {alerts.slice(0, 4).map((alert) => (
          <Link
            key={alert.key}
            href={alert.href}
            className="flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            <AlertCircle
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: alert.severity === 'high' ? 'var(--destructive)' : '#d97706' }}
            />
            {alert.text}
          </Link>
        ))}
      </div>
    </div>
  )
}
