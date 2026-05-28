'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/csv-export'
import type { CreditCardBalance } from '@/lib/types'

interface CreditCardBalanceChartProps {
  cards: CreditCardBalance[]
}

interface TooltipPayload {
  name: string
  value: number
  payload: ChartRow
}

interface ChartRow {
  name: string
  used: number
  available: number
  limit: number
  color: string
  pct: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-sm text-foreground">{row.name}</p>
      <p style={{ color: '#ff6584' }}>Fatura: {formatCurrency(row.used)}</p>
      <p style={{ color: '#43e97b' }}>Disponível: {formatCurrency(row.available)}</p>
      <p className="text-muted-foreground">Limite: {formatCurrency(row.limit)} · {row.pct.toFixed(0)}% utilizado</p>
    </div>
  )
}

export function CreditCardBalanceChart({ cards }: CreditCardBalanceChartProps) {
  if (cards.length === 0) return null

  const data: ChartRow[] = cards.map((c) => ({
    name: c.name,
    used: c.currentFaturaTotal,
    available: c.availableCredit,
    limit: c.credit_limit,
    color: c.color,
    pct: c.utilizationPct,
  }))

  const chartHeight = Math.max(180, data.length * 64)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#6c63ff' }} />
          Limite vs. Fatura por Cartão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            barCategoryGap="30%"
          >
            <XAxis
              type="number"
              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
              tick={{ fill: '#8892a4', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fill: '#e2e8f0', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

            {/* Stacked bar: used (fatura) */}
            <Bar dataKey="used" stackId="a" radius={[0, 0, 0, 0]} name="Fatura">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.9} />
              ))}
            </Bar>

            {/* Stacked bar: available */}
            <Bar dataKey="available" stackId="a" radius={[4, 4, 4, 4]} fill="#2e3248" name="Disponível">
              <LabelList
                dataKey="pct"
                position="right"
                formatter={(v: unknown) => `${Number(v).toFixed(0)}%`}
                style={{ fill: '#8892a4', fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-5 rounded-sm" style={{ background: '#ff6584' }} />
            Fatura atual (cor do cartão)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-5 rounded-sm bg-muted" />
            Crédito disponível
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
