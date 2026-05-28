import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type ExtratoEntry = {
  tx: {
    date: string
    description: string
    category: string
    type: string
    amount: number
  }
  balanceAfter: number
}

const TYPE_LABELS: Record<string, string> = {
  income:              'Receita',
  expense:             'Despesa',
  investment:          'Investimento',
  credit_card_payment: 'Pg. Fatura',
}

export function exportBankStatementToExcel(
  bankName: string,
  entries: ExtratoEntry[],
) {
  const header = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)', 'Saldo (R$)']

  // Display is newest-first; Excel shows oldest-first (natural reading order)
  const rows = [...entries].reverse().map(({ tx, balanceAfter }) => [
    format(new Date(tx.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
    tx.description,
    tx.category,
    TYPE_LABELS[tx.type] ?? tx.type,
    tx.type === 'income' ? tx.amount : -tx.amount,
    balanceAfter,
  ])

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  ws['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, bankName.slice(0, 31))

  const date = format(new Date(), 'yyyy-MM-dd')
  const safe = bankName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  XLSX.writeFile(wb, `extrato-${safe}-${date}.xlsx`)
}
