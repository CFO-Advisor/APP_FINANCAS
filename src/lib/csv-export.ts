import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Transaction } from './types'

export function exportToCSV(transactions: Transaction[], filename?: string) {
  const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)']

  const rows = transactions.map((t) => [
    format(new Date(t.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
    t.description,
    t.category,
    t.type === 'income' ? 'Receita' : t.type === 'investment' ? 'Investimento' : 'Despesa',
    t.amount.toFixed(2).replace('.', ','),
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(';'))
    .join('\n')

  const bom = '﻿'
  const blob = new Blob([bom + csvContent], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename ?? `financas_${format(new Date(), 'yyyy-MM-dd')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
