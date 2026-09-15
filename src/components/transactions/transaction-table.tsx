'use client'

import { useState } from 'react'
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
                  ) : t.type === 'transfer' && t.bank_id && bankMap.has(t.bank_id) ? (
                    <span className="flex items-center gap-1.5">
                      <BankIcon name={bankMap.get(t.bank_id)!.name} color={bankMap.get(t.bank_id)!.color} size="xs" />
                      <span className="text-xs">{bankMap.get(t.bank_id)!.name}</span>
                      {t.transfer_bank_id && bankMap.has(t.transfer_bank_id) && (
                        <>
                          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <BankIcon name={bankMap.get(t.transfer_bank_id)!.name} color={bankMap.get(t.transfer_bank_id)!.color} size="xs" />
                          <span className="text-xs">{bankMap.get(t.transfer_bank_id)!.name}</span>
                        </>
                      )}
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
                  <Badge variant="secondary">
                    {t.type === 'income' ? 'Receita'
                      : t.type === 'investment' ? 'Investimento'
                      : t.type === 'credit_card_payment' ? 'Pg. Fatura'
                      : t.type === 'transfer' ? 'Transferência'
                      : 'Despesa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold tabular-nums text-foreground">
                    {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'}
                    {formatCurrency(t.amount)}
                  </span>
                </TableCell>
                <TableCell>
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
