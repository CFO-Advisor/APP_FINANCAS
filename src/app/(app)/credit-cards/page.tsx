'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp, Upload, CreditCard as CreditCardLucide, Wallet, ShieldCheck, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CreditCardIcon } from '@/components/credit-cards/credit-card-icon'
import { CreditCardFormDialog } from '@/components/credit-cards/credit-card-form-dialog'
import { CreditCardBalanceChart } from '@/components/credit-cards/credit-card-balance-chart'
import { ImportDialog } from '@/components/import/import-dialog'
import { createClient } from '@/lib/supabase/client'
import { CARD_BRAND_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/csv-export'
import { computeCardBalance, groupTransactionsByBillingCycle } from '@/lib/credit-card-utils'
import type { CreditCard, CreditCardBalance, Transaction } from '@/lib/types'
import type { LucideIcon } from 'lucide-react'

interface KpiItem {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  accentColor: string
}

function KpiCard({ label, value, sub, icon: Icon, accentColor }: KpiItem) {
  return (
    <Card className="relative overflow-hidden border-border shadow-sm">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accentColor }} />
      <Icon className="absolute right-4 top-5 h-9 w-9 opacity-[0.12]" style={{ color: accentColor }} />
      <CardContent className="px-5 pb-5 pt-6">
        <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        <p className="text-[1.7rem] font-bold leading-none" style={{ color: accentColor }}>
          {value}
        </p>
        {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function CreditCardsPage() {
  const [cards, setCards] = useState<CreditCardBalance[]>([])
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CreditCard | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CreditCard | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [cardsRes, txRes] = await Promise.all([
      supabase.from('credit_cards').select('*').order('created_at'),
      supabase.from('transactions').select('*').not('credit_card_id', 'is', null).order('date', { ascending: false }),
    ])

    const rawCards = (cardsRes.data ?? []) as CreditCard[]
    const txs = (txRes.data ?? []) as Transaction[]

    setAllTransactions(txs)
    setCards(rawCards.map((c) => computeCardBalance(c, txs)))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('credit_cards').delete().eq('id', deleteTarget.id)
    if (error) toast.error('Erro ao excluir cartão.')
    else { toast.success('Cartão excluído.'); fetchData() }
    setDeleting(false)
    setDeleteTarget(null)
  }

  const totalDebt = cards.reduce((s, c) => s + c.outstandingBalance, 0)
  const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0)
  const totalAvailable = cards.reduce((s, c) => s + c.availableCredit, 0)
  const totalUtilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0

  const utilizationColor =
    totalUtilization > 80 ? '#ff6584' : totalUtilization > 50 ? '#f7971e' : '#43e97b'

  const kpis: KpiItem[] = [
    {
      label: 'Total nas Faturas',
      value: formatCurrency(totalDebt),
      sub: `${cards.length} cartão${cards.length !== 1 ? 'ões' : ''} com fatura`,
      icon: CreditCardLucide,
      accentColor: '#ff6584',
    },
    {
      label: 'Limite Total',
      value: formatCurrency(totalLimit),
      sub: `Soma dos limites cadastrados`,
      icon: Wallet,
      accentColor: '#6c63ff',
    },
    {
      label: 'Crédito Disponível',
      value: formatCurrency(totalAvailable),
      sub: `${(100 - totalUtilization).toFixed(0)}% do limite livre`,
      icon: ShieldCheck,
      accentColor: '#43e97b',
    },
    {
      label: 'Utilização Global',
      value: `${totalUtilization.toFixed(1)}%`,
      sub: totalUtilization > 80 ? 'Atenção: uso elevado' : totalUtilization > 50 ? 'Uso moderado' : 'Uso saudável',
      icon: TrendingUp,
      accentColor: utilizationColor,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cartões de Crédito</h1>
          <p className="text-sm text-muted-foreground">
            {cards.length} cartão{cards.length !== 1 ? 'ões' : ''} cadastrado{cards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar fatura
          </Button>
          <Button size="sm" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo cartão
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg border bg-card shadow-sm" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#6c63ff' }} />
          </div>
        </>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-muted-foreground">Nenhum cartão cadastrado.</p>
          <Button size="sm" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar cartão
          </Button>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <KpiCard key={k.label} {...k} />
            ))}
          </div>

          {/* Global utilization bar */}
          <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-widest text-muted-foreground">
                Utilização consolidada
              </span>
              <span className="font-bold" style={{ color: utilizationColor }}>
                {totalUtilization.toFixed(1)}% de {formatCurrency(totalLimit)}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-3 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(totalUtilization, 100)}%`,
                  background: `linear-gradient(90deg, ${utilizationColor}cc, ${utilizationColor})`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span style={{ color: '#ff6584' }}>Usado: {formatCurrency(totalDebt)}</span>
              <span style={{ color: '#43e97b' }}>Disponível: {formatCurrency(totalAvailable)}</span>
            </div>
          </div>

          {/* Bar chart — limit vs fatura per card */}
          <CreditCardBalanceChart cards={cards} />

          {/* Card list */}
          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">
            Detalhes por Cartão
          </p>
          <div className="space-y-4">
            {cards.map((card) => {
              const isExpanded = expandedCardId === card.id
              // exclude payments from billing cycle display — they're not card expenses
              const cardTransactions = allTransactions.filter((t) => t.credit_card_id === card.id && t.type !== 'credit_card_payment')
              const billingCycles = groupTransactionsByBillingCycle(cardTransactions, card.closing_day)
              const dueDate = new Date(card.nextDueDate + 'T00:00:00')
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              const isDueSoon = daysUntilDue <= 5 && daysUntilDue >= 0
              const isOverdue = daysUntilDue < 0
              const cardUtilColor = card.utilizationPct > 80 ? '#ff6584' : card.utilizationPct > 50 ? '#f7971e' : '#43e97b'

              return (
                <Card key={card.id} className="shadow-sm overflow-hidden">
                  {/* Card color accent line */}
                  <div className="h-[3px] w-full" style={{ background: card.color }} />
                  <CardContent className="pt-4">
                    {/* Card header row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCardIcon brand={card.brand} color={card.color} size="md" />
                        <div>
                          <p className="font-semibold">{card.name}</p>
                          <p className="text-xs text-muted-foreground">{CARD_BRAND_LABELS[card.brand]}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground/70">
                            Fecha dia {card.closing_day} · Vence dia {card.due_day}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setEditTarget(card); setDialogOpen(true) }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(card)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Balance section */}
                    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Saldo Devedor</p>
                        <p className="text-lg font-bold" style={{ color: '#ff6584' }}>{formatCurrency(card.outstandingBalance)}</p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          Vence {format(dueDate, "dd/MM", { locale: ptBR })}
                          {isDueSoon && !isOverdue && <span style={{ color: '#f7971e' }}> · {daysUntilDue}d</span>}
                          {isOverdue && <span style={{ color: '#ff6584' }}> · vencida!</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Disponível</p>
                        <p className="text-lg font-bold" style={{ color: '#43e97b' }}>{formatCurrency(card.availableCredit)}</p>
                        <p className="text-[0.65rem] text-muted-foreground">de {formatCurrency(card.credit_limit)}</p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Utilização</p>
                        <p className="text-lg font-bold" style={{ color: cardUtilColor }}>{card.utilizationPct.toFixed(0)}%</p>
                        <p className="text-[0.65rem] text-muted-foreground">do limite</p>
                      </div>
                    </div>

                    {/* Utilization bar */}
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(card.utilizationPct, 100)}%`,
                          background: `linear-gradient(90deg, ${card.color}99, ${card.color})`,
                        }}
                      />
                    </div>

                    {/* Expand/collapse */}
                    <button
                      type="button"
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-md py-1 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
                      onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {isExpanded ? 'Ocultar lançamentos' : `Ver lançamentos (${cardTransactions.length})`}
                    </button>

                    {/* Fatura breakdown */}
                    {isExpanded && (
                      <div className="mt-3 space-y-4 border-t border-border pt-3">
                        {billingCycles.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
                        ) : (
                          billingCycles.map((cycle) => (
                            <div key={cycle.end.toISOString()}>
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold text-muted-foreground">{cycle.label}</p>
                                <p className="text-xs font-semibold" style={{ color: '#ff6584' }}>
                                  {formatCurrency(cycle.transactions.reduce((s, t) => s + t.amount, 0))}
                                </p>
                              </div>
                              <div className="space-y-1">
                                {cycle.transactions.map((t) => (
                                  <div key={t.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm">{t.description}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {t.category} · {format(new Date(t.date + 'T00:00:00'), 'dd/MM/yyyy')}
                                      </p>
                                    </div>
                                    <span className="ml-3 shrink-0 text-sm font-semibold" style={{ color: '#ff6584' }}>
                                      -{formatCurrency(t.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Form dialog */}
      <CreditCardFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditTarget(null) }}
        card={editTarget}
        onSuccess={fetchData}
      />

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        banks={[]}
        creditCards={cards}
        onSuccess={fetchData}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir cartão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir <strong>{deleteTarget?.name}</strong>? Os lançamentos vinculados a este cartão perderão o vínculo.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
