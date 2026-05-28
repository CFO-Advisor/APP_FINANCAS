'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BankIcon } from '@/components/banks/bank-icon'
import { BankFormDialog } from '@/components/banks/bank-form-dialog'
import { createClient } from '@/lib/supabase/client'
import { BANK_TYPE_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/csv-export'
import type { Bank, BankBalance, Transaction } from '@/lib/types'

export default function BanksPage() {
  const [banks, setBanks] = useState<BankBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Bank | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchBanks = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [banksRes, txRes] = await Promise.all([
      supabase.from('banks').select('*').order('created_at'),
      supabase.from('transactions').select('bank_id, type, amount, credit_card_id').not('bank_id', 'is', null),
    ])

    if (banksRes.error) { setLoading(false); return }

    const rawBanks = (banksRes.data ?? []) as Bank[]
    const allTx = (txRes.data ?? []) as Pick<Transaction, 'bank_id' | 'type' | 'amount' | 'credit_card_id'>[]

    // Compute balance per bank (exclude credit card transactions — they haven't hit the bank yet)
    const totals: Record<string, { income: number; expense: number }> = {}
    for (const t of allTx) {
      if (!t.bank_id) continue
      // skip card expenses (not yet debited from bank), but include payments (they ARE debited)
      if (t.credit_card_id && t.type !== 'credit_card_payment') continue
      if (!totals[t.bank_id]) totals[t.bank_id] = { income: 0, expense: 0 }
      if (t.type === 'income') totals[t.bank_id].income += t.amount
      else totals[t.bank_id].expense += t.amount
    }

    const bankBalances: BankBalance[] = rawBanks.map((b) => {
      const t = totals[b.id] ?? { income: 0, expense: 0 }
      return {
        ...b,
        totalIncome: t.income,
        totalExpense: t.expense,
        balance: b.initial_balance + t.income - t.expense,
      }
    })

    setBanks(bankBalances)
    setLoading(false)
  }, [])

  useEffect(() => { fetchBanks() }, [fetchBanks])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('banks').delete().eq('id', deleteTarget.id)
    if (error) toast.error('Erro ao excluir banco.')
    else { toast.success('Banco excluído.'); fetchBanks() }
    setDeleting(false)
    setDeleteTarget(null)
  }

  const totalBalance = banks.reduce((s, b) => s + b.balance, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bancos e Contas</h1>
          <p className="text-sm text-muted-foreground">
            {banks.length} conta{banks.length !== 1 ? 's' : ''} cadastrada{banks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova conta
        </Button>
      </div>

      {/* Total balance */}
      {!loading && banks.length > 0 && (
        <Card className="border-primary/30 shadow-sm">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saldo Total
              </p>
              <p className="text-3xl font-bold" style={{ color: totalBalance >= 0 ? '#43e97b' : '#ff6584' }}>
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <div className="flex -space-x-2">
              {banks.slice(0, 5).map((b) => (
                <BankIcon key={b.id} name={b.name} color={b.color} size="sm" className="ring-2 ring-card" />
              ))}
              {banks.length > 5 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-medium ring-2 ring-card">
                  +{banks.length - 5}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank cards grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : banks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-muted-foreground">Nenhuma conta cadastrada.</p>
          <Button size="sm" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar conta
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank) => (
            <Card key={bank.id} className="group shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <BankIcon name={bank.name} color={bank.color} size="md" />
                    <div>
                      <p className="font-semibold">{bank.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {BANK_TYPE_LABELS[bank.type]}
                      </p>
                      {(bank.agency || bank.account_number) && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">
                          {bank.agency && <span>Ag: {bank.agency}</span>}
                          {bank.agency && bank.account_number && <span className="mx-1">·</span>}
                          {bank.account_number && <span>Cc: {bank.account_number}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditTarget(bank); setDialogOpen(true) }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(bank)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Saldo atual</p>
                      <p className="text-xl font-bold" style={{ color: bank.balance >= 0 ? '#43e97b' : '#ff6584' }}>
                        {formatCurrency(bank.balance)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>↑ {formatCurrency(bank.totalIncome)}</p>
                      <p>↓ {formatCurrency(bank.totalExpense)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <BankFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditTarget(null) }}
        bank={editTarget}
        onSuccess={fetchBanks}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir <strong>{deleteTarget?.name}</strong>? As transações vinculadas a esta conta perderão o vínculo.
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
