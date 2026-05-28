'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

// ── Extended transaction type for extrato ─────────────
type BankTx = Pick<Transaction, 'id' | 'bank_id' | 'credit_card_id' | 'type' | 'amount' | 'date' | 'description' | 'category'>

const TYPE_LABEL: Record<string, { label: string; color: string; sign: '+' | '-' }> = {
  income:               { label: 'Receita',     color: '#43e97b', sign: '+' },
  expense:              { label: 'Despesa',      color: '#ff6584', sign: '-' },
  investment:           { label: 'Investimento', color: '#a78bfa', sign: '-' },
  credit_card_payment:  { label: 'Pg. Fatura',   color: '#f7971e', sign: '-' },
}

// ── Running balance computation ───────────────────────
function computeExtrato(
  bank: BankBalance,
  allTx: BankTx[],
  startDate: string,
  endDate: string,
): { tx: BankTx; balanceAfter: number }[] {
  const bankTx = allTx
    .filter((t) => t.bank_id === bank.id && !(t.credit_card_id && t.type !== 'credit_card_payment'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  let balance = bank.initial_balance
  const result: { tx: BankTx; balanceAfter: number }[] = []

  for (const tx of bankTx) {
    balance = tx.type === 'income' ? balance + tx.amount : balance - tx.amount
    const inRange = (!startDate || tx.date >= startDate) && (!endDate || tx.date <= endDate)
    if (inRange) result.push({ tx, balanceAfter: balance })
  }

  return result.reverse()
}

// ── Page ───────────────────────────────────────────────
export default function BanksPage() {
  const [banks, setBanks] = useState<BankBalance[]>([])
  const [allBankTransactions, setAllBankTransactions] = useState<BankTx[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Bank | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedBankId, setExpandedBankId] = useState<string | null>(null)
  const [dateFilters, setDateFilters] = useState<Record<string, { start: string; end: string }>>({})

  const fetchBanks = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [banksRes, txRes] = await Promise.all([
      supabase.from('banks').select('*').order('created_at'),
      supabase
        .from('transactions')
        .select('id, bank_id, credit_card_id, type, amount, date, description, category')
        .not('bank_id', 'is', null)
        .order('date', { ascending: false }),
    ])

    if (banksRes.error) { setLoading(false); return }

    const rawBanks = (banksRes.data ?? []) as Bank[]
    const allTx = (txRes.data ?? []) as BankTx[]

    setAllBankTransactions(allTx)

    const totals: Record<string, { income: number; expense: number }> = {}
    for (const t of allTx) {
      if (!t.bank_id) continue
      if (t.credit_card_id && t.type !== 'credit_card_payment') continue
      if (!totals[t.bank_id]) totals[t.bank_id] = { income: 0, expense: 0 }
      if (t.type === 'income') totals[t.bank_id].income += t.amount
      else totals[t.bank_id].expense += t.amount
    }

    setBanks(rawBanks.map((b) => {
      const t = totals[b.id] ?? { income: 0, expense: 0 }
      return { ...b, totalIncome: t.income, totalExpense: t.expense, balance: b.initial_balance + t.income - t.expense }
    }))
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

  function toggleExpand(bankId: string) {
    setExpandedBankId((prev) => (prev === bankId ? null : bankId))
  }

  function setFilter(bankId: string, field: 'start' | 'end', value: string) {
    setDateFilters((prev) => ({ ...prev, [bankId]: { ...prev[bankId], [field]: value } }))
  }

  function clearFilter(bankId: string) {
    setDateFilters((prev) => ({ ...prev, [bankId]: { start: '', end: '' } }))
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
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saldo Total</p>
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

      {/* Bank cards */}
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
        <div className="space-y-4">
          {banks.map((bank) => (
            <BankCard
              key={bank.id}
              bank={bank}
              allTx={allBankTransactions}
              expanded={expandedBankId === bank.id}
              filter={dateFilters[bank.id] ?? { start: '', end: '' }}
              onToggle={() => toggleExpand(bank.id)}
              onEdit={() => { setEditTarget(bank); setDialogOpen(true) }}
              onDelete={() => setDeleteTarget(bank)}
              onFilterChange={(field, val) => setFilter(bank.id, field, val)}
              onFilterClear={() => clearFilter(bank.id)}
            />
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
          <DialogHeader><DialogTitle>Excluir conta</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir <strong>{deleteTarget?.name}</strong>? As transações vinculadas perderão o vínculo.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── BankCard sub-component ────────────────────────────
interface BankCardProps {
  bank: BankBalance
  allTx: BankTx[]
  expanded: boolean
  filter: { start: string; end: string }
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onFilterChange: (field: 'start' | 'end', value: string) => void
  onFilterClear: () => void
}

function BankCard({ bank, allTx, expanded, filter, onToggle, onEdit, onDelete, onFilterChange, onFilterClear }: BankCardProps) {
  const extrato = useMemo(
    () => computeExtrato(bank, allTx, filter.start, filter.end),
    [bank, allTx, filter.start, filter.end],
  )

  const totalTx = useMemo(
    () => allTx.filter((t) => t.bank_id === bank.id && !(t.credit_card_id && t.type !== 'credit_card_payment')).length,
    [bank.id, allTx],
  )

  const hasFilter = filter.start !== '' || filter.end !== ''

  return (
    <Card className="overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="pt-5">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <BankIcon name={bank.name} color={bank.color} size="md" />
            <div>
              <p className="font-semibold">{bank.name}</p>
              <p className="text-xs text-muted-foreground">{BANK_TYPE_LABELS[bank.type]}</p>
              {(bank.agency || bank.account_number) && (
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {bank.agency && <span>Ag: {bank.agency}</span>}
                  {bank.agency && bank.account_number && <span className="mx-1">·</span>}
                  {bank.account_number && <span>Cc: {bank.account_number}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Balance section */}
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

        {/* Extrato toggle */}
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
          onClick={onToggle}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? 'Ocultar extrato' : `Ver extrato (${totalTx} lançamentos)`}
        </button>

        {/* Extrato */}
        {expanded && (
          <div className="mt-3 border-t border-border pt-4">
            {/* Date filter */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <Input
                  type="date"
                  placeholder="Data inicial"
                  value={filter.start}
                  onChange={(e) => onFilterChange('start', e.target.value)}
                  className="h-8 text-xs"
                />
                <span className="shrink-0 text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  placeholder="Data final"
                  value={filter.end}
                  onChange={(e) => onFilterChange('end', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              {hasFilter && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Limpar filtro"
                  onClick={onFilterClear}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Column headers */}
            <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-x-3 px-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Descrição / Categoria</span>
              <span className="text-right">Valor</span>
              <span className="text-right w-28">Saldo</span>
            </div>

            {/* Rows */}
            {extrato.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {hasFilter ? 'Nenhum lançamento no período selecionado.' : 'Nenhum lançamento nesta conta.'}
              </p>
            ) : (
              <div className="max-h-96 space-y-0.5 overflow-y-auto">
                {extrato.map(({ tx, balanceAfter }) => {
                  const meta = TYPE_LABEL[tx.type] ?? { label: tx.type, color: '#8892a4', sign: '-' as const }
                  return (
                    <div
                      key={tx.id}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40"
                    >
                      {/* Left: date + description + category */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold"
                            style={{ background: meta.color + '20', color: meta.color }}
                          >
                            {meta.label}
                          </span>
                          <p className="truncate text-sm font-medium">{tx.description}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {tx.category} · {format(new Date(tx.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>

                      {/* Amount */}
                      <span
                        className="shrink-0 text-right text-sm font-semibold tabular-nums"
                        style={{ color: meta.color }}
                      >
                        {meta.sign}{formatCurrency(tx.amount)}
                      </span>

                      {/* Running balance */}
                      <span
                        className="w-28 shrink-0 text-right text-xs font-medium tabular-nums"
                        style={{ color: balanceAfter >= 0 ? '#43e97b' : '#ff6584' }}
                      >
                        {formatCurrency(balanceAfter)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Footer: period summary */}
            {extrato.length > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted-foreground">
                <span>{extrato.length} lançamento{extrato.length !== 1 ? 's' : ''}{hasFilter ? ' no período' : ''}</span>
                <span>
                  Saldo{hasFilter ? ' final do período' : ' atual'}:{' '}
                  <strong style={{ color: extrato[0].balanceAfter >= 0 ? '#43e97b' : '#ff6584' }}>
                    {formatCurrency(extrato[0].balanceAfter)}
                  </strong>
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
