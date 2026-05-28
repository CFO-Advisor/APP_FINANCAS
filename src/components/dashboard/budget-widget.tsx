'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/csv-export'
import type { BudgetVsActual } from '@/lib/types'

interface BudgetWidgetProps {
  expenseItems: BudgetVsActual[]
  incomeItems: BudgetVsActual[]
}

function MiniBar({ pct, over, green }: { pct: number; over: boolean; green?: boolean }) {
  const filled = Math.min(pct, 100)
  const color = over ? '#ff6584' : green ? '#43e97b' : pct > 80 ? '#f7971e' : '#6c63ff'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${filled}%`, backgroundColor: color }} />
    </div>
  )
}

function Section({
  title,
  items,
  green,
}: {
  title: string
  items: BudgetVsActual[]
  green?: boolean
}) {
  const top = items.slice(0, 4)
  if (top.length === 0) return null

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {top.map((item) => {
          const over = item.actual > item.budgeted && item.budgeted > 0
          return (
            <div key={item.category}>
              <div className="mb-0.5 flex items-center justify-between text-xs">
                <span className="truncate text-foreground">{item.category}</span>
                <span className={`ml-2 shrink-0 font-medium ${over ? 'text-red-600' : green ? 'text-green-600' : 'text-foreground'}`}>
                  {formatCurrency(item.actual)}
                  {item.budgeted > 0 && (
                    <span className="ml-1 text-muted-foreground font-normal">
                      / {formatCurrency(item.budgeted)}
                    </span>
                  )}
                </span>
              </div>
              {item.budgeted > 0 ? (
                <MiniBar pct={item.percentage} over={over} green={green} />
              ) : (
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div className="h-full w-full rounded-full bg-muted-foreground opacity-40" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BudgetWidget({ expenseItems, incomeItems }: BudgetWidgetProps) {
  const hasData = expenseItems.length > 0 || incomeItems.length > 0

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Orçamento do Mês</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/budget" />}
          className="flex items-center gap-1 text-blue-600"
        >
          Ver detalhes <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum orçamento definido para este mês.</p>
            <Button size="sm" nativeButton={false} render={<Link href="/budget" />}>
              Definir orçamento
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <Section title="Despesas" items={expenseItems} />
            <Section title="Receitas" items={incomeItems} green />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
