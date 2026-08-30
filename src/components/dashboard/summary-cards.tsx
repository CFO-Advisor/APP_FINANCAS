import { TrendingUp, TrendingDown, Wallet, BarChart3, type LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/csv-export'
import type { DashboardSummary } from '@/lib/types'

interface KpiCard {
  title: string
  value: number
  icon: LucideIcon
  /** Only set when the value itself carries a positive/negative signal (e.g. balance). */
  valueColor?: string
}

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const cards: KpiCard[] = [
    { title: 'Receitas', value: summary.totalIncome, icon: TrendingUp },
    { title: 'Despesas', value: summary.totalExpense, icon: TrendingDown },
    { title: 'Investimentos', value: summary.totalInvestment, icon: BarChart3 },
    {
      title: 'Saldo',
      value: summary.balance,
      icon: Wallet,
      valueColor: summary.balance >= 0 ? '#059669' : 'var(--destructive)',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-border bg-card px-5 py-5 transition-colors duration-200 hover:border-foreground/20"
        >
          <p className="mb-2.5 flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <card.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {card.title}
          </p>
          <p
            className="text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-foreground"
            style={card.valueColor ? { color: card.valueColor } : undefined}
          >
            {formatCurrency(card.value)}
          </p>
        </div>
      ))}
    </div>
  )
}
