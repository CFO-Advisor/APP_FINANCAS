'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_COLORS, MONTHS } from '@/lib/constants'
import { formatCurrency } from '@/lib/csv-export'
import type { Transaction, DashboardSummary, CategoryTotal } from '@/lib/types'

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(currentYear)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    if (!error && data) {
      setTransactions(data as Transaction[])
    }
    setLoading(false)
  }, [month, year])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const summary: DashboardSummary = transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.totalIncome += t.amount
      else acc.totalExpense += t.amount
      acc.balance = acc.totalIncome - acc.totalExpense
      return acc
    },
    { totalIncome: 0, totalExpense: 0, balance: 0 }
  )

  const categoryTotals: CategoryTotal[] = Object.entries(
    transactions
      .filter((t) => t.type === 'expense')
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount
        return acc
      }, {})
  )
    .map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] ?? '#94A3B8',
    }))
    .sort((a, b) => b.value - a.value)

  const recentTransactions = transactions.slice(0, 5)

  const selectedMonthLabel = MONTHS.find((m) => m.value === month)?.label ?? ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumo financeiro de {selectedMonthLabel} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => { if (v !== null) setMonth(Number(v)) }}>
            <SelectTrigger className="w-36 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => { if (v !== null) setYear(Number(v)) }}>
            <SelectTrigger className="w-24 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-white border shadow-sm" />
          ))}
        </div>
      ) : (
        <SummaryCards summary={summary} />
      )}

      {/* Chart + Recent */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category chart */}
        {loading ? (
          <div className="h-80 animate-pulse rounded-lg border bg-white shadow-sm" />
        ) : (
          <CategoryChart data={categoryTotals} />
        )}

        {/* Recent transactions */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Transações Recentes</CardTitle>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/transactions" />} className="flex items-center gap-1 text-blue-600">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhuma transação neste período.
                </p>
                <Button size="sm" nativeButton={false} render={<Link href="/transactions" />}>
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar transação
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {recentTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.category} •{' '}
                        {format(new Date(t.date + 'T00:00:00'), 'dd MMM', { locale: ptBR })}
                      </p>
                    </div>
                    <span
                      className={`ml-3 shrink-0 text-sm font-semibold ${
                        t.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'}
                      {formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
