import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/csv-export'
import type { DashboardSummary } from '@/lib/types'

interface SummaryCardsProps {
  summary: DashboardSummary
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      title: 'Receitas',
      value: summary.totalIncome,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-l-4 border-l-green-500',
    },
    {
      title: 'Despesas',
      value: summary.totalExpense,
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-l-4 border-l-red-500',
    },
    {
      title: 'Saldo',
      value: summary.balance,
      icon: Wallet,
      color: summary.balance >= 0 ? 'text-blue-600' : 'text-red-600',
      bg: summary.balance >= 0 ? 'bg-blue-50' : 'bg-red-50',
      border: summary.balance >= 0 ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-red-500',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title} className={`${card.border} shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>
              {formatCurrency(card.value)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
