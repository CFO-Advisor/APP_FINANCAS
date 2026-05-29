'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pencil, Trash2, AlertTriangle } from 'lucide-react'
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
import { CATEGORY_COLORS } from '@/lib/constants'
import { formatCurrency } from '@/lib/csv-export'
import { createClient } from '@/lib/supabase/client'
import { toError } from '@/lib/utils'
import { BankIcon } from '@/components/banks/bank-icon'
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

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', deleteTarget.id)

    if (error) {
      console.error(toError(error))
      toast.error('Erro ao excluir transação.')
    } else {
      toast.success('Transação excluída.')
      onDeleted()
    }

    setDeleting(false)
    setDeleteTarget(null)
  }

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
      <div className="overflow-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Categoria</TableHead>
              <TableHead className="hidden lg:table-cell">Banco</TableHead>
              <TableHead className="hidden md:table-cell">Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-20 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/40/50">
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(t.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{t.description}</span>
                    {t.status === 'pending' && (
                      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Pendente
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground sm:hidden">{t.category}</span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: (CATEGORY_COLORS[t.category] ?? '#94A3B8') + '20',
                      color: CATEGORY_COLORS[t.category] ?? '#64748B',
                    }}
                  >
                    {t.category}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {t.credit_card_id && cardMap.has(t.credit_card_id) ? (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white" style={{ backgroundColor: cardMap.get(t.credit_card_id)!.color }}>C</span>
                      <span className="text-xs">{cardMap.get(t.credit_card_id)!.name}</span>
                    </span>
                  ) : t.bank_id && bankMap.has(t.bank_id) ? (
                    <span className="flex items-center gap-1.5">
                      <BankIcon name={bankMap.get(t.bank_id)!.name} color={bankMap.get(t.bank_id)!.color} size="xs" />
                      <span className="text-xs">{bankMap.get(t.bank_id)!.name}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge
                    variant="secondary"
                    style={
                      t.type === 'income'
                        ? { backgroundColor: '#43e97b20', color: '#43e97b' }
                        : t.type === 'investment'
                        ? { backgroundColor: '#a78bfa20', color: '#a78bfa' }
                        : t.type === 'credit_card_payment'
                        ? { backgroundColor: '#6c63ff20', color: '#6c63ff' }
                        : { backgroundColor: '#ff658420', color: '#ff6584' }
                    }
                  >
                    {t.type === 'income' ? 'Receita'
                      : t.type === 'investment' ? 'Investimento'
                      : t.type === 'credit_card_payment' ? 'Pg. Fatura'
                      : 'Despesa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: t.type === 'income' ? '#43e97b' : t.type === 'investment' ? '#a78bfa' : t.type === 'credit_card_payment' ? '#6c63ff' : '#ff6584' }}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                      onClick={() => onEdit(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
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
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Excluir transação
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir{' '}
            <strong>&quot;{deleteTarget?.description}&quot;</strong>? Esta ação não pode ser desfeita.
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
    </>
  )
}
