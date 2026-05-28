'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, TrendingDown, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DebtFormDialog } from '@/components/debts/debt-form-dialog'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/csv-export'
import { DEBT_GROUP_DEFS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Debt, DebtStatus } from '@/lib/types'

const STATUS_STYLES: Record<DebtStatus, { bg: string; text: string; label: string }> = {
  active:  { bg: '#7c6eff20', text: '#7c6eff', label: 'Ativo'    },
  overdue: { bg: '#ff558820', text: '#ff5588', label: 'Vencido'  },
  paid:    { bg: '#43e97b20', text: '#43e97b', label: 'Pago'     },
}

function StatusBadge({ status }: { status: DebtStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Debt | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchDebts = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setDebts((data ?? []) as Debt[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchDebts() }, [fetchDebts])

  async function togglePaid(debt: Debt) {
    const newStatus: DebtStatus = debt.status === 'paid' ? 'active' : 'paid'
    const supabase = createClient()
    const { error } = await supabase.from('debts').update({ status: newStatus }).eq('id', debt.id)
    if (error) toast.error('Erro ao atualizar status.')
    else {
      toast.success(newStatus === 'paid' ? 'Marcado como pago!' : 'Reativado.')
      fetchDebts()
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('debts').delete().eq('id', deleteTarget.id)
    if (error) toast.error('Erro ao excluir.')
    else { toast.success('Dívida excluída.'); fetchDebts() }
    setDeleting(false)
    setDeleteTarget(null)
  }

  const activeDebts  = debts.filter((d) => d.status !== 'paid')
  const totalMonthly = activeDebts.reduce((s, d) => s + d.monthly_amount, 0)
  const totalLoans   = activeDebts.filter((d) => d.group_type === 'loans').reduce((s, d) => s + d.total_amount, 0)
  const totalBills   = activeDebts.filter((d) => d.group_type === 'bills').reduce((s, d) => s + d.monthly_amount, 0)
  const totalOther   = activeDebts.filter((d) => d.group_type === 'other').reduce((s, d) => s + d.monthly_amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dívidas e Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">
            {activeDebts.length} obrigaç{activeDebts.length !== 1 ? 'ões ativas' : 'ão ativa'}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Dívida / Conta
        </Button>
      </div>

      {/* KPI cards */}
      {!loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Compromisso / Mês', value: totalMonthly, color: '#ff6584', Icon: TrendingDown },
            { label: 'Empréstimos & Financ.', value: totalLoans,   color: '#f7971e', Icon: DEBT_GROUP_DEFS[0].icon },
            { label: 'Contas do Mês',          value: totalBills,   color: '#38f9d7', Icon: DEBT_GROUP_DEFS[1].icon },
            { label: 'Outras Obrigações',       value: totalOther,   color: '#a78bfa', Icon: DEBT_GROUP_DEFS[2].icon },
          ].map(({ label, value, color, Icon }) => (
            <div
              key={label}
              className="relative overflow-hidden rounded-xl border border-border bg-card px-5 pb-5 pt-5"
            >
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full opacity-[0.12] blur-2xl"
                style={{ background: color }}
              />
              <div
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: color + '22', color }}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </p>
              <p className="text-[1.75rem] font-bold leading-none tabular-nums" style={{ color }}>
                {formatCurrency(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Group sections */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-5">
          {DEBT_GROUP_DEFS.map((group) => {
            const groupDebts = debts.filter((d) => d.group_type === group.key)
            const activeCount = groupDebts.filter((d) => d.status !== 'paid').length

            return (
              <Card key={group.key} className="shadow-sm">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="flex items-center gap-3 text-base font-semibold">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: group.color + '22', color: group.color }}
                    >
                      <group.icon className="h-4 w-4" />
                    </span>
                    {group.label}
                    <span className="ml-auto text-sm font-normal text-muted-foreground">
                      {activeCount} ativ{activeCount !== 1 ? 'as' : 'a'}
                    </span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="px-4 pb-4">
                  {groupDebts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma dívida neste grupo.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {groupDebts.map((debt) => (
                        <div
                          key={debt.id}
                          className={cn(
                            'flex items-center gap-3 py-3',
                            debt.status === 'paid' && 'opacity-50'
                          )}
                        >
                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                                style={{ background: group.color + '20', color: group.color }}
                              >
                                {debt.category}
                              </span>
                              <StatusBadge status={debt.status} />
                            </div>

                            <p className="mt-1 text-sm font-medium leading-snug">
                              {debt.description}
                            </p>

                            {/* Loan progress bar */}
                            {debt.group_type === 'loans' && debt.installments_total != null && (
                              <div className="mt-2">
                                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                  <span>
                                    {debt.installments_paid ?? 0}/{debt.installments_total} parcelas
                                  </span>
                                  <span>
                                    {Math.round(
                                      ((debt.installments_paid ?? 0) / debt.installments_total) * 100
                                    )}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(100, ((debt.installments_paid ?? 0) / debt.installments_total) * 100)}%`,
                                      background: group.color,
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {debt.due_day != null && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Vence todo dia {debt.due_day}
                              </p>
                            )}
                          </div>

                          {/* Amount */}
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums" style={{ color: group.color }}>
                              {formatCurrency(debt.monthly_amount)}
                              <span className="text-xs font-normal text-muted-foreground">/mês</span>
                            </p>
                            {debt.group_type === 'loans' && debt.total_amount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Total: {formatCurrency(debt.total_amount)}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'h-8 w-8',
                                debt.status === 'paid'
                                  ? 'text-emerald-500 hover:text-emerald-600'
                                  : 'text-muted-foreground hover:text-emerald-500'
                              )}
                              title={debt.status === 'paid' ? 'Marcar como ativo' : 'Marcar como pago'}
                              onClick={() => togglePaid(debt)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                              onClick={() => { setEditTarget(debt); setDialogOpen(true) }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTarget(debt)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Form dialog */}
      <DebtFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditTarget(null) }}
        debt={editTarget}
        onSuccess={fetchDebts}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir dívida</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir <strong>&quot;{deleteTarget?.description}&quot;</strong>?{' '}
            Esta ação não pode ser desfeita.
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
