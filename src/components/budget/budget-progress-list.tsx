'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/csv-export'
import type { Budget, BudgetVsActual } from '@/lib/types'

interface BudgetProgressListProps {
  title: string
  items: BudgetVsActual[]
  budgets: Budget[]
  onEdit: (budget: Budget) => void
  onDelete: (budget: Budget) => void
  accentColor: 'red' | 'green'
}

function barColor(over: boolean, accentColor: 'red' | 'green', pct: number): string {
  if (over) return '#ff6584'
  if (accentColor === 'green') return '#43e97b'
  if (pct > 80) return '#f7971e'
  return '#6c63ff'
}

function ProgressBar({ pct, over, accentColor }: { pct: number; over: boolean; accentColor: 'red' | 'green' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor(over, accentColor, pct) }}
      />
    </div>
  )
}

export function BudgetProgressList({
  title,
  items,
  budgets,
  onEdit,
  onDelete,
  accentColor,
}: BudgetProgressListProps) {
  if (items.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum orçamento definido para este período.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalBudgeted = items.reduce((s, i) => s + i.budgeted, 0)
  const totalActual = items.reduce((s, i) => s + i.actual, 0)
  const totalPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0
  const totalOver = totalActual > totalBudgeted

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="text-right text-xs text-muted-foreground">
            <span
              className="font-semibold"
              style={{ color: totalOver ? '#ff6584' : 'inherit' }}
            >
              {formatCurrency(totalActual)}
            </span>
            {' / '}
            <span>{formatCurrency(totalBudgeted)}</span>
          </div>
        </div>
        <ProgressBar pct={totalPct} over={totalOver} accentColor={accentColor} />
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const budget = budgets.find(
            (b) => b.category === item.category && b.type === item.type
          )
          const over = item.actual > item.budgeted

          return (
            <div key={item.category} className="group rounded-lg border bg-muted/40 px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">{item.category}</span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {budget && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onEdit(budget)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        style={{ color: '#ff6584' }}
                        onClick={() => onDelete(budget)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <ProgressBar pct={item.percentage} over={over} accentColor={accentColor} />

              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  Real:{' '}
                  <span
                    className="font-semibold"
                    style={{ color: over ? '#ff6584' : 'inherit' }}
                  >
                    {formatCurrency(item.actual)}
                  </span>
                </span>
                <span>
                  {over ? (
                    <span style={{ color: '#ff6584' }}>
                      +{formatCurrency(Math.abs(item.remaining))} acima
                    </span>
                  ) : (
                    <span style={{ color: '#43e97b' }}>
                      {formatCurrency(item.remaining)} restante
                    </span>
                  )}
                  {' · '}
                  Orçado: {formatCurrency(item.budgeted)}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
