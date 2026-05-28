'use client'

import Link from 'next/link'
import { ArrowRight, Banknote, BarChart2, Building2, Coins, Package, type LucideIcon } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/csv-export'

export interface InvestmentGroupBalance {
  label: string
  color: string
  icon: LucideIcon
  total: number
}

interface InvestmentBalanceWidgetProps {
  groups: InvestmentGroupBalance[]
}

interface TooltipPayload {
  name: string
  value: number
  payload: { color: string }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-md">
        <p className="text-xs font-medium">{payload[0].name}</p>
        <p className="text-sm font-bold" style={{ color: payload[0].payload.color }}>
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    )
  }
  return null
}

export function InvestmentBalanceWidget({ groups }: InvestmentBalanceWidgetProps) {
  const total = groups.reduce((s, g) => s + g.total, 0)
  const activeGroups = groups.filter((g) => g.total > 0)
  const chartData = activeGroups.map((g) => ({ name: g.label, value: g.total, color: g.color }))
  const maxTotal = Math.max(...groups.map((g) => g.total), 1)

  if (total === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Saldo por Investimento</CardTitle>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/investments" />} className="flex items-center gap-1" style={{ color: '#a78bfa' }}>
            Ver <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum investimento registrado.</p>
            <Button size="sm" nativeButton={false} render={<Link href="/investments" />}>
              Ver investimentos
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-base">Saldo por Investimento</CardTitle>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/investments" />} className="flex items-center gap-1" style={{ color: '#a78bfa' }}>
          Ver todos <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini donut + total */}
        <div className="flex items-center gap-4">
          {chartData.length > 0 && (
            <div className="shrink-0">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={46}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Total Investido</p>
            <p className="text-2xl font-bold" style={{ color: '#a78bfa' }}>
              {formatCurrency(total)}
            </p>
            <p className="text-xs text-muted-foreground">
              {activeGroups.length} grupo{activeGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Group list */}
        <div className="space-y-2">
          {activeGroups.map((g) => {
            const pct = maxTotal > 0 ? (g.total / maxTotal) * 100 : 0
            const Icon = g.icon
            return (
              <div key={g.label}>
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <Icon className="h-3 w-3 shrink-0" style={{ color: g.color }} />
                  <span className="flex-1 truncate font-medium">{g.label}</span>
                  <span className="shrink-0 font-semibold" style={{ color: g.color }}>
                    {formatCurrency(g.total)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: g.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Group definitions — categories mapped to groups, shared with the investments page
export interface InvestmentGroupDef {
  label: string
  color: string
  icon: LucideIcon
  categories: string[]
}

export const INVESTMENT_GROUPS: InvestmentGroupDef[] = [
  { label: 'Aplicações Financeiras', color: '#43e97b', icon: Banknote, categories: ['Tesouro Direto', 'CDB', 'LCI/LCA', 'Poupança', 'Debêntures', 'Fundo RF'] },
  { label: 'Ações e FIIs',           color: '#6c63ff', icon: BarChart2, categories: ['Ações', 'FIIs', 'ETFs', 'BDRs', 'Opções', 'Fundo Ações'] },
  { label: 'Imóveis',                color: '#f7971e', icon: Building2, categories: ['Imóvel Residencial', 'Imóvel Comercial', 'Terreno', 'Reforma/Benfeitorias'] },
  { label: 'Cripto',                 color: '#fbbf24', icon: Coins,    categories: ['Bitcoin', 'Ethereum', 'Altcoins', 'Stablecoins', 'DeFi'] },
  { label: 'Outros',                 color: '#38f9d7', icon: Package,  categories: ['Previdência Privada', 'COE', 'Ouro', 'Câmbio', 'Consórcio', 'Startup/Equity'] },
]
