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
  const color = over ? 'var(--destructive)' : green ? 'var(--positive)' : pct > 80 ? 'var(--warning)' : 'var(--primary)'
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
                <span className={`ml-2 shrink-0 font-medium ${over ? 'text-destructive' : green ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
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
  const totalBudgeted = expenseItems.reduce((s, i) => s + i.budgeted, 0)
  const totalActual = expenseItems.reduce((s, i) => s + i.actual, 0)
  const overallPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0
  const overallColor = overallPct > 100 ? 'var(--destructive)' : overallPct > 80 ? 'var(--warning)' : 'var(--positive)'

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Orçamento do Mês</CardTitle>
        <Link href="/budget">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-primary"
          >
            Ver detalhes <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum orçamento definido para este mês.</p>
            <Button size="sm">
              Definir orçamento
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {totalBudgeted > 0 && (
              <div>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">Orçamento de despesas</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(totalActual)} / {formatCurrency(totalBudgeted)}
                    <span className="ml-1 text-muted-foreground">({Math.round(overallPct)}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(overallPct, 100)}%, backgroundColor: overallColor` }}
                  />
                </div>
              </div>
            )}
            <Section title="Despesas" items={expenseItems} />
            <Section title="Receitas" items={incomeItems} green />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
