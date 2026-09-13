import Link from 'next/link'
import { TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/csv-export'
import type { DashboardSummary } from '@/lib/types'

interface KpiCard {
  title: string
  value: number
  prevValue: number
  icon: LucideIcon
  /** Cor semântica do chip do ícone — acentua o card. */
  chipColor: string
  /** Only set when the value itself carries a positive/negative signal (e.g. balance). */
  valueColor?: string
  /** For this KPI, does an increase mean things are better (true) or worse (false)? */
  upIsGood: boolean
  /** Destino de detalhe ao clicar no card. */
  href: string
  /** Média diária do período (fluxos de receita/despesa/investimento). */
  dailyAvg?: number
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
  dailyAvg,
}: {
  summary: DashboardSummary
  previous?: DashboardSummary
  trendLabel?: string
  dailyAvg?: { income?: number; expense?: number; investment?: number }
}) {
  const cards: KpiCard[] = [
    { title: 'Receitas', value: summary.totalIncome, prevValue: previous?.totalIncome ?? 0, icon: TrendingUp, chipColor: 'var(--positive)', upIsGood: true, href: '/transactions?type=income', dailyAvg: dailyAvg?.income },
    { title: 'Despesas', value: summary.totalExpense, prevValue: previous?.totalExpense ?? 0, icon: TrendingDown, chipColor: 'var(--destructive)', upIsGood: false, href: '/transactions?type=expense', dailyAvg: dailyAvg?.expense },
    { title: 'Investimentos', value: summary.totalInvestment, prevValue: previous?.totalInvestment ?? 0, icon: BarChart3, chipColor: 'var(--primary)', upIsGood: true, href: '/investments', dailyAvg: dailyAvg?.investment },
    {
      title: 'Saldo',
      value: summary.balance,
      prevValue: previous?.balance ?? 0,
      icon: Wallet,
      chipColor: summary.balance >= 0 ? 'var(--positive)' : 'var(--destructive)',
      valueColor: summary.balance >= 0 ? 'var(--positive)' : 'var(--destructive)',
      upIsGood: true,
      href: '/balance',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.title}
          href={card.href}
          aria-label={`Ver detalhes de ${card.title}`}
          className="group relative block rounded-xl border border-border bg-card px-5 py-5 shadow-sm transition-all duration-200 hover:border-foreground/25 hover:shadow-md"
        >
          <ArrowUpRight
            className="absolute right-4 top-4 h-4 w-4 text-muted-foreground/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            strokeWidth={2}
          />
          <p className="mb-3 flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-105"
              style={{
                backgroundColor: `color-mix(in srgb, ${card.chipColor} 12%, transparent)`,
                color: card.chipColor,
              }}
            >
              <card.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            </span>
            <span className="truncate">{card.title}</span>
          </p>
          <p
            className="kpi-value text-[1.8rem] font-semibold leading-none tracking-[-0.03em] text-foreground"
            style={card.valueColor ? { color: card.valueColor } : undefined}
          >
            {formatCurrency(card.value)}
          </p>
          {card.dailyAvg !== undefined && (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              média/dia · {formatCurrency(card.dailyAvg)}
            </p>
          )}
          {previous && (
            <TrendBadge value={card.value} prevValue={card.prevValue} upIsGood={card.upIsGood} trendLabel={trendLabel} />
          )}
        </Link>
      ))}
    </div>
  )
}