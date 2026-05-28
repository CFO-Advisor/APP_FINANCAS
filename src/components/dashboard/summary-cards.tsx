import { TrendingUp, TrendingDown, Wallet, BarChart3, type LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/csv-export'
import type { DashboardSummary } from '@/lib/types'

interface KpiCard {
  title: string
  value: number
  icon: LucideIcon
  accentColor: string
}

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const cards: KpiCard[] = [
    { title: 'Receitas',      value: summary.totalIncome,      icon: TrendingUp,  accentColor: '#43e97b' },
    { title: 'Despesas',      value: summary.totalExpense,     icon: TrendingDown, accentColor: '#ff6584' },
    { title: 'Investimentos', value: summary.totalInvestment,  icon: BarChart3,   accentColor: '#a78bfa' },
    { title: 'Saldo',         value: summary.balance,          icon: Wallet,      accentColor: summary.balance >= 0 ? '#7c6eff' : '#ff6584' },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="relative overflow-hidden rounded-xl border border-border bg-card px-5 pb-5 pt-5 transition-transform duration-200 hover:-translate-y-0.5"
        >
          {/* Radial gradient glow from top-right */}
          <div
            className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full opacity-[0.12] blur-2xl"
            style={{ background: card.accentColor }}
          />

          {/* Icon pill */}
          <div
            className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: card.accentColor + '22', color: card.accentColor }}
          >
            <card.icon className="h-5 w-5" strokeWidth={2.2} />
          </div>

          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {card.title}
          </p>
          <p className="text-[1.75rem] font-bold leading-none tabular-nums" style={{ color: card.accentColor }}>
            {formatCurrency(card.value)}
          </p>
        </div>
      ))}
    </div>
  )
}
