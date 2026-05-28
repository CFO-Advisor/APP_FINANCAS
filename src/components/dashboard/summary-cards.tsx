import { TrendingUp, TrendingDown, Wallet, BarChart3, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/csv-export'
import type { DashboardSummary } from '@/lib/types'

interface SummaryCardsProps {
  summary: DashboardSummary
}

interface KpiCard {
  title: string
  value: number
  icon: LucideIcon
  accentColor: string
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards: KpiCard[] = [
    {
      title: 'Receitas',
      value: summary.totalIncome,
      icon: TrendingUp,
      accentColor: '#43e97b',
    },
    {
      title: 'Despesas',
      value: summary.totalExpense,
      icon: TrendingDown,
      accentColor: '#ff6584',
    },
    {
      title: 'Investimentos',
      value: summary.totalInvestment,
      icon: BarChart3,
      accentColor: '#a78bfa',
    },
    {
      title: 'Saldo',
      value: summary.balance,
      icon: Wallet,
      accentColor: summary.balance >= 0 ? '#6c63ff' : '#ff6584',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden border-border shadow-sm">
          {/* 3px colored top accent bar */}
          <div
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: card.accentColor }}
          />

          {/* Ghost icon — top-right */}
          <card.icon
            className="absolute right-4 top-5 h-9 w-9 opacity-[0.12]"
            style={{ color: card.accentColor }}
          />

          <CardContent className="px-5 pb-5 pt-6">
            <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {card.title}
            </p>
            <p className="text-[1.8rem] font-bold leading-none" style={{ color: card.accentColor }}>
              {formatCurrency(card.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
