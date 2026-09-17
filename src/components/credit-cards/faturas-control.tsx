'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/csv-export'
import { groupCardFaturas } from '@/lib/credit-card-utils'
import type { CreditCardBalance, Transaction } from '@/lib/types'
import type { FaturaGroup } from '@/lib/credit-card-utils'

function statusFatura(g: FaturaGroup): { label: string; className: string } {
  if (g.total <= 0) return { label: 'Sem despesas', className: 'bg-muted text-muted-foreground' }
  if (g.payments >= g.total) return { label: 'Paga', className: 'bg-emerald-600/15 text-emerald-600' }
  if (g.payments > 0) return { label: 'Parcial', className: 'bg-amber-500/15 text-amber-600' }
  return { label: 'Aberta', className: 'bg-destructive/15 text-destructive' }
}

// Controle de faturas: agrupa as despesas de cada cartão pela data de
// emissão da fatura (modelo atual do import), mostra total, pagamentos e
// os lançamentos de cada fatura (clique para expandir).
export function FaturasControl({ cards, transactions }: { cards: CreditCardBalance[]; transactions: Transaction[] }) {
  const [open, setOpen] = useState<string | null>(null)

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">Cadastre um cartão para acompanhar as faturas.</p>
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => {
        const faturas = groupCardFaturas(card.id, transactions)
        const brandInitial = card.brand === 'visa' ? 'V' : card.brand === 'mastercard' ? 'MC' : card.brand === 'elo' ? 'E' : card.brand === 'amex' ? 'AX' : 'C'
        return (
          <div key={card.id} className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: card.color }}>
                {brandInitial}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{card.name}</p>
              <Badge className="shrink-0" variant="secondary">
                fecha dia {card.closing_day} · vence dia {card.due_day}
              </Badge>
            </div>
            {faturas.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Nenhuma fatura com despesas lançadas ainda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {faturas.map((f) => {
                  const st = statusFatura(f)
                  const key = `${card.id}/${f.date}`
                  const isOpen = open === key
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : key)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                        aria-expanded={isOpen}
                      >
                        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            Fatura {format(new Date(f.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {f.expenses.length} lançamento{f.expenses.length !== 1 ? 's' : ''}
                            {f.payments > 0 ? ` · pago ${formatCurrency(f.payments)}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(f.total)}</span>
                        <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.className}`}>
                          {st.label}
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <ul className="space-y-1 bg-muted/30 px-4 py-3">
                          {f.expenses.map((t) => (
                            <li key={t.id} className="flex items-center justify-between gap-3 text-xs">
                              <span className="min-w-0 flex-1 truncate">
                                {t.description}
                                {t.purchase_date && (
                                  <span className="ml-2 text-muted-foreground/70">
                                    compra {format(new Date(t.purchase_date + 'T00:00:00'), 'dd/MM/yy')}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 font-medium tabular-nums">{formatCurrency(t.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
