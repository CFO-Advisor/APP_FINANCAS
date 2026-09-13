import { TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/csv-export'
import type { DashboardSummary } from '@/lib/types'

interface KpiCard {
  title: string
  value: number
  prevValue: number
  icon: LucideIcon
  /** Only set when the value itself carries a positive/negative signal (e.g. balance). */
  valueColor?: string
  /** For this KPI, does an increase mean things are better (true) or worse (false)? */
  upIsGood: boolean
}

function TrendBadge({ value, prevValue, upIsGood, trendLabel }: { value: number; prevValue: number; upIsGood: boolean; trendLabel: string }) {
  if (prevValue === 0) {
    if (value === 0) return null
    return <p className="mt-1 text-xs text-muted-foreground">novo vs {trendLabel}</p>
  }

  const pct = ((value - prevValue) / Math.abs(prevValue)) * 100
  const isUp = pct > 0
  const isGood = pct === 0 ? null : isUp === upIsGood
  const color = isGood === null ? undefined : isGood ? 'var(--positive)' : 'var(--destructive)'
  const Icon = isUp ? ArrowUpRight : ArrowDownRight

  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
      {pct !== 0 && <Icon className="h-3 w-3 shrink-0" style={{ color }} />}
      <span style={{ color }}>{Math.abs(pct).toFixed(0)}%</span>
      vs {trendLabel}
    </p>
  )
}

export function SummaryCards({
  summary,
  previous,
  trendLabel = 'período anterior',
}: {
  summary: DashboardSummary
  previous?: DashboardSummary
  trendLabel?: string
}) {
  const cards: KpiCard[] = [
    { title: 'Receitas', value: summary.totalIncome, prevValue: previous?.totalIncome ?? 0, icon: TrendingUp, upIsGood: true },
    { title: 'Despesas', value: summary.totalExpense, prevValue: previous?.totalExpense ?? 0, icon: TrendingDown, upIsGood: false },
    { title: 'Investimentos', value: summary.totalInvestment, prevValue: previous?.totalInvestment ?? 0, icon: BarChart3, upIsGood: true },
    {
      title: 'Saldo',
      value: summary.balance,
      prevValue: previous?.balance ?? 0,
      icon: Wallet,
      valueColor: summary.balance >= 0 ? 'var(--positive)' : 'var(--destructive)',
      upIsGood: true,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="group rounded-xl border border-border bg-card px-5 py-5 transition-all duration-200 hover:border-foreground/25 hover:bg-card/70"
        >
          <p className="mb-3 flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted text-foreground/70 transition-colors duration-200 group-hover:bg-muted-foreground/10">
              <card.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            </span>
            <span className="truncate">{card.title}</span>
          </p>
          <p
            className="kpi-value text-[1.65rem] font-medium leading-none tracking-[-0.03em] text-foreground"
            style={card.valueColor ? { color: card.valueColor } : undefined}
          >
            {formatCurrency(card.value)}
          </p>
          {previous && (
            <TrendBadge value={card.value} prevValue={card.prevValue} upIsGood={card.upIsGood} trendLabel={trendLabel} />
          )}
        </div>
      ))}
    </div>
  )
}
