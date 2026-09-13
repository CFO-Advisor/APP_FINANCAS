'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/csv-export'

interface IncomeCategoryChartProps {
  data: { name: string; value: number }[]
}

interface TooltipPayload {
  name: string
  value: number
  payload: { color: string }
}

// Baseline palette — green-forward for income
const INCOME_COLORS = [
  '#43e97b', '#38f9d7', '#6c63ff', '#a78bfa', '#fbbf24', '#f7971e', '#ff6584',
]

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-2.5 shadow-lg">
        <p className="text-xs font-semibold text-foreground">{payload[0].name}</p>
        <p className="text-sm font-bold" style={{ color: payload[0].payload.color }}>
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    )
  }
  return null
}

export function IncomeCategoryChart({ data }: IncomeCategoryChartProps) {
  if (data.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
            Receitas por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Nenhuma receita registrada neste período.</p>
        </CardContent>
      </Card>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  const dataWithColors = data.map((item, i) => ({
    ...item,
    color: INCOME_COLORS[i % INCOME_COLORS.length],
  }))

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
          Receitas por Categoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={dataWithColors}
                cx="50%"
                cy="50%"
                innerRadius={72}
                outerRadius={105}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {dataWithColors.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[0.6rem] font-medium uppercase tracking-widest text-muted-foreground">Total</p>
              <p className="text-lg font-semibold tracking-tight tabular-nums text-foreground">
                {formatCurrency(total)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
