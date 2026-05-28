'use client'

import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BankIcon } from '@/components/banks/bank-icon'
import { formatCurrency } from '@/lib/csv-export'
import type { BankBalance } from '@/lib/types'

interface BankBalanceWidgetProps {
  banks: BankBalance[]
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

export function BankBalanceWidget({ banks }: BankBalanceWidgetProps) {
  const totalBalance = banks.reduce((s, b) => s + b.balance, 0)

  if (banks.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Saldo por Banco</CardTitle>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/banks" />} className="flex items-center gap-1 text-blue-600">
            Gerenciar <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum banco cadastrado.</p>
            <Button size="sm" nativeButton={false} render={<Link href="/banks" />}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar banco
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Only positive balances go to the pie chart (negative shown separately)
  const chartData = banks
    .filter((b) => b.balance > 0)
    .map((b) => ({ name: b.name, value: b.balance, color: b.color }))

  const maxBalance = Math.max(...banks.map((b) => Math.abs(b.balance)), 1)

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-base">Saldo por Banco</CardTitle>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/banks" />} className="flex items-center gap-1 text-blue-600">
          Ver todos <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total + donut */}
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
            <p className="text-xs text-muted-foreground">Saldo Total</p>
            <p className="text-2xl font-bold" style={{ color: totalBalance >= 0 ? '#43e97b' : '#ff6584' }}>
              {formatCurrency(totalBalance)}
            </p>
            <p className="text-xs text-muted-foreground">{banks.length} conta{banks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Bank list */}
        <div className="space-y-2">
          {banks.map((bank) => {
            const pct = maxBalance > 0 ? (Math.abs(bank.balance) / maxBalance) * 100 : 0
            const negative = bank.balance < 0
            return (
              <div key={bank.id}>
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <BankIcon name={bank.name} color={bank.color} size="xs" />
                  <span className="flex-1 truncate font-medium">{bank.name}</span>
                  <span className="shrink-0 font-semibold" style={{ color: negative ? '#ff6584' : '#43e97b' }}>
                    {formatCurrency(bank.balance)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: negative ? '#ff6584' : bank.color }}
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
