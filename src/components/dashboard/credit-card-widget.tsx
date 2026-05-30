import Link from 'next/link'
import { CreditCard, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCardIcon } from '@/components/credit-cards/credit-card-icon'
import { formatCurrency } from '@/lib/csv-export'
import type { CreditCardBalance } from '@/lib/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CreditCardWidgetProps {
  cards: CreditCardBalance[]
}

export function CreditCardWidget({ cards }: CreditCardWidgetProps) {
  if (cards.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Cartões de Crédito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
            <Button size="sm" variant="outline">
              Cadastrar cartão
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalDebt = cards.reduce((s, c) => s + c.outstandingBalance, 0)

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Cartões de Crédito
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs" style={{ color: '#a78bfa' }}>
          Ver todos →
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total debt */}
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">Total nas faturas</span>
          <span className="font-bold" style={{ color: '#ff6584' }}>{formatCurrency(totalDebt)}</span>
        </div>

        {/* Per-card list */}
        <div className="space-y-2">
          {cards.map((card) => {
            const dueDate = new Date(card.nextDueDate + 'T00:00:00')
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            const isDueSoon = daysUntilDue <= 5 && daysUntilDue >= 0
            const isOverdue = daysUntilDue < 0

            return (
              <div key={card.id} className="flex items-center gap-3">
                <CreditCardIcon brand={card.brand} color={card.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium">{card.name}</p>
                    <span className="ml-2 shrink-0 text-sm font-semibold" style={{ color: '#ff6584' }}>
                      {formatCurrency(card.outstandingBalance)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {/* Utilization bar */}
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(card.utilizationPct, 100)}%`,
                          backgroundColor: card.utilizationPct > 80 ? '#ff6584' : card.utilizationPct > 50 ? '#f7971e' : '#6c63ff',
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {card.utilizationPct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    {(isDueSoon || isOverdue) && (
                      <AlertCircle className="h-3 w-3" style={{ color: isOverdue ? '#ff6584' : '#f7971e' }} />
                    )}
                    <p
                      className="text-xs"
                      style={{ color: isOverdue ? '#ff6584' : isDueSoon ? '#f7971e' : undefined, fontWeight: (isOverdue || isDueSoon) ? 500 : undefined }}
                    >
                      Vence {format(dueDate, "dd 'de' MMM", { locale: ptBR })}
                      {isDueSoon && !isOverdue && ` (${daysUntilDue}d)`}
                      {isOverdue && ' (vencido)'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
