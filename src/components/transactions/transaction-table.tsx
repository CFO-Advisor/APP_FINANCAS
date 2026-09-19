'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pencil, Trash2, AlertTriangle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/csv-export'
import { createClient } from '@/lib/supabase/client'
import { toError } from '@/lib/utils'
import { BankIcon } from '@/components/banks/bank-icon'
import { transferSides } from '@/lib/transfers'
import type { Transaction, Bank, CreditCard } from '@/lib/types'

interface TransactionTableProps {
  transactions: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDeleted: () => void
  banks?: Bank[]
  creditCards?: CreditCard[]
}

export function TransactionTable({ transactions, onEdit, onDeleted, banks = [], creditCards = [] }: TransactionTableProps) {
  const bankMap = new Map(banks.map((b) => [b.id, b]))
  const cardMap = new Map(creditCards.map((c) => [c.id, c]))
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  // O par de uma transferência vive no extrato de OUTRA conta. Apagar só um lado
  // deixa o saldo daquela conta inconsistente (foi o que aconteceu em 19/09).
  const [pairTarget, setPairTarget] = useState<Transaction | null>(null)
  const [pairLoading, setPairLoading] = useState(false)
  // Seleção para exclusão em massa
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  // Auditoria: e-mail/nome de quem criou/editou cada transação
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const ids = [...new Set(
      transactions.flatMap((t) => [t.created_by, t.updated_by].filter(Boolean) as string[])
    )]
    if (ids.length === 0) return
    void (async () => {
      try {
        const res = await fetch('/api/users/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        if (res.ok) {
          const body = await res.json()
          const map: Record<string, string> = {}
          for (const [id, email] of Object.entries(body.emails ?? {})) {
            const local = String(email).split('@')[0]
            map[id] = local
              .replace(/[._-]+/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())
          }
          setAuthorNames(map)
        }
      } catch {
        // auditoria é informativa; falha no lookup não quebra a tabela
      }
    })()
  }, [transactions])

  // Remove da seleção ids que saíram da lista (filtros, exclusão)
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const ids = new Set(transactions.map((t) => t.id))
      const next = new Set([...prev].filter((id) => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [transactions])

  const allSelected = transactions.length > 0 && transactions.every((t) => selected.has(t.id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(transactions.map((t) => t.id)))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Ao abrir a confirmação de exclusão de uma transferência, procura o outro
  // lado: mesma quantia, na conta da contrapartida, com data próxima (PIX cai no
  // mesmo dia; TED/DOC pode virar o dia útil).
  useEffect(() => {
    setPairTarget(null)
    const t = deleteTarget
    if (!t || t.type !== 'transfer' || !t.transfer_bank_id || !t.bank_id) return
    let cancelled = false
    const shift = (iso: string, delta: number) => {
      const d = new Date(`${iso}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + delta)
      return d.toISOString().slice(0, 10)
    }
    ;(async () => {
      setPairLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('type', 'transfer')
        .eq('bank_id', t.transfer_bank_id)
        .eq('amount', t.amount)
        .gte('date', shift(t.date, -3))
        .lte('date', shift(t.date, 3))
      if (cancelled) return
      const cands = (data ?? []) as Transaction[]
      // Prefere quem aponta de volta para esta linha; senão, o primeiro candidato.
      setPairTarget(cands.find((c) => c.transfer_bank_id === t.bank_id) ?? cands[0] ?? null)
      setPairLoading(false)
    })()
    return () => { cancelled = true }
  }, [deleteTarget])

  async function confirmBulkDelete() {
    if (selected.size === 0) return
    setBulkDeleting(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', [...selected])

    if (error) {
      console.error(toError(error))
      toast.error('Erro ao excluir transações.')
    } else {
      toast.success(`${selected.size} transação(ões) excluída(s).`)
      onDeleted()
      setSelected(new Set())
    }

    setBulkDeleting(false)
    setBulkOpen(false)
  }

  async function confirmDelete(alsoPair = false) {
    if (!deleteTarget) return
    setDeleting(true)

    const supabase = createClient()
    // Com o par selecionado, os dois lados saem juntos — é o único jeito de
    // apagar uma transferência sem deixar uma conta inconsistente.
    const ids = alsoPair && pairTarget ? [deleteTarget.id, pairTarget.id] : [deleteTarget.id]
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids)

    if (error) {
      console.error(toError(error))
      toast.error('Erro ao excluir transação.')
    } else {
      toast.success(ids.length > 1 ? 'Transferência e o outro lado excluídos.' : 'Transação excluída.')
      onDeleted()
    }

    setDeleting(false)
    setDeleteTarget(null)
  }

  // Transferências selecionadas que têm o par em outra conta (aviso do lote)
  const selectedWithPair = transactions.filter(
    (t) => selected.has(t.id) && t.type === 'transfer' && t.transfer_bank_id,
  )

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">Nenhuma transação encontrada.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste os filtros ou adicione uma nova transação.
        </p>
      </div>
    )
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selecionada(s)</span>
          <Button variant="destructive" size="sm" onClick={() => setBulkOpen(true)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Excluir selecionadas
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}
      <div className="overflow-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10 pr-0">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todas"
                />
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Categoria</TableHead>
              <TableHead className="hidden lg:table-cell">Banco</TableHead>
              <TableHead className="hidden md:table-cell">Tipo</TableHead>
              <TableHead className="hidden xl:table-cell">Autor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-24 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/40/50">
                <TableCell className="w-10 pr-0">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                    checked={selected.has(t.id)}
                    onChange={() => toggleOne(t.id)}
                    aria-label={`Selecionar ${t.description}`}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(t.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                  {t.purchase_date && (
                    <p className="text-[10px] text-muted-foreground/70">
                      compra {format(new Date(t.purchase_date + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{t.description}</span>
                  <span className="ml-2 text-xs text-muted-foreground sm:hidden">
                    {t.category}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {t.category}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {t.credit_card_id && cardMap.has(t.credit_card_id) ? (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white" style={{ backgroundColor: cardMap.get(t.credit_card_id)!.color }}>C</span>
                      <span className="text-xs">{cardMap.get(t.credit_card_id)!.name}</span>
                    </span>
                  ) : t.type === 'transfer' ? (() => {
                    const { from, to } = transferSides(t)
                    const fromBank = from ? bankMap.get(from) : null
                    const toBank = to ? bankMap.get(to) : null
                    return (
                      <span className="flex items-center gap-1.5">
                        {fromBank ? (
                          <>
                            <BankIcon name={fromBank.name} color={fromBank.color} size="xs" />
                            <span className="text-xs">{fromBank.name}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground/70">conta não informada</span>
                        )}
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {toBank ? (
                          <>
                            <BankIcon name={toBank.name} color={toBank.color} size="xs" />
                            <span className="text-xs">{toBank.name}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground/70">conta não informada</span>
                        )}
                      </span>
                    )
                  })() : t.bank_id && bankMap.has(t.bank_id) ? (
                    <span className="flex items-center gap-1.5">
                      <BankIcon name={bankMap.get(t.bank_id)!.name} color={bankMap.get(t.bank_id)!.color} size="xs" />
                      <span className="text-xs">{bankMap.get(t.bank_id)!.name}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="secondary">
                    {t.type === 'income' ? 'Receita'
                      : t.type === 'investment' ? 'Investimento'
                      : t.type === 'credit_card_payment' ? 'Pg. Fatura'
                      : t.type === 'transfer' ? 'Transferência'
                      : 'Despesa'}
                  </Badge>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="text-xs">
                    <span className="text-muted-foreground">
                      {t.created_by ? (authorNames[t.created_by] ?? '—') : '—'}
                    </span>
                    {t.updated_by && t.updated_by !== t.created_by && (
                      <p className="text-[10px] text-muted-foreground/70">
                        edit. por {authorNames[t.updated_by] ?? '—'}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold tabular-nums text-foreground">
                    {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'}
                    {formatCurrency(t.amount)}
                  </span>
                </TableCell>
                <TableCell className="w-24 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => onEdit(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir transação
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir{' '}
            <strong>&quot;{deleteTarget?.description}&quot;</strong>? Esta ação não pode ser desfeita.
          </p>

          {/* Aviso de par: o outro lado desta transferência vive no extrato de
              outra conta. Apagar só um lado deixa o saldo daquela conta errado
              — foi o que quebrou a Inter em 19/09. */}
          {deleteTarget?.type === 'transfer' && deleteTarget.transfer_bank_id && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
              <p className="font-medium text-amber-600">Esta transferência tem o outro lado em outra conta</p>
              {pairLoading ? (
                <p className="mt-1 text-muted-foreground">Procurando o outro lado…</p>
              ) : pairTarget ? (
                <p className="mt-1 text-muted-foreground">
                  {bankMap.get(pairTarget.bank_id ?? '')?.name ?? 'outra conta'} ·{' '}
                  {new Date(`${pairTarget.date}T00:00:00`).toLocaleDateString('pt-BR')} ·{' '}
                  {formatCurrency(pairTarget.amount)} ({pairTarget.transfer_dir === 'in' ? 'entrou' : 'saiu'}).{' '}
                  Apagar só este lado deixa o saldo desta conta inconsistente — o outro lado continua lá.
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Não encontrei o outro lado na base (o extrato da outra conta pode não ter sido importado).
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            {pairTarget && deleteTarget?.type === 'transfer' ? (
              <>
                <Button variant="outline" className="text-destructive" onClick={() => confirmDelete(false)} disabled={deleting}>
                  Só este lado
                </Button>
                <Button variant="destructive" onClick={() => confirmDelete(true)} disabled={deleting}>
                  {deleting ? 'Excluindo...' : 'Excluir os dois lados'}
                </Button>
              </>
            ) : (
              <Button variant="destructive" onClick={() => confirmDelete()} disabled={deleting}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir transações
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{selected.size}</strong> transação(ões)? Esta ação não pode ser desfeita.
          </p>
          {selectedWithPair.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              <strong className="text-amber-600">{selectedWithPair.length} transferência(s)</strong>{' '}
              da seleção têm o par no extrato de outra conta. Apagar só um lado deixa o saldo daquela conta
              inconsistente — para excluir uma transferência por inteiro, use a exclusão individual e escolha
              &quot;Excluir os dois lados&quot;.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
