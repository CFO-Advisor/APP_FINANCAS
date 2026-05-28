'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BudgetFormDialog } from '@/components/budget/budget-form-dialog'
import { BudgetProgressList } from '@/components/budget/budget-progress-list'
import { createClient } from '@/lib/supabase/client'
import { MONTHS } from '@/lib/constants'
import { formatCurrency } from '@/lib/csv-export'
import type { Budget, Transaction, BudgetVsActual } from '@/lib/types'

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Budget | null>(null)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(currentYear)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    const [budgetsRes, txRes] = await Promise.all([
      supabase.from('budgets').select('*').eq('month', month).eq('year', year),
      supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate),
    ])

    if (!budgetsRes.error && budgetsRes.data) setBudgets(budgetsRes.data as Budget[])
    if (!txRes.error && txRes.data) setTransactions(txRes.data as Transaction[])
    setLoading(false)
  }, [month, year])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleDelete(budget: Budget) {
    const supabase = createClient()
    const { error } = await supabase.from('budgets').delete().eq('id', budget.id)
    if (error) {
      toast.error('Erro ao excluir orçamento.')
    } else {
      toast.success('Orçamento excluído.')
      fetchData()
    }
  }

  function handleEdit(budget: Budget) {
    setEditTarget(budget)
    setDialogOpen(true)
  }

  function handleAdd() {
    setEditTarget(null)
    setDialogOpen(true)
  }

  // Compute actual totals per category from transactions
  const actualByCategory = useMemo(() => {
    const map: Record<string, { amount: number; type: 'expense' | 'income' }> = {}
    for (const t of transactions) {
      if (t.type === 'investment' || t.type === 'credit_card_payment') continue
      if (!map[t.category]) map[t.category] = { amount: 0, type: t.type }
      map[t.category].amount += t.amount
    }
    return map
  }, [transactions])

  function buildItems(type: 'expense' | 'income'): BudgetVsActual[] {
    const typeBudgets = budgets.filter((b) => b.type === type)

    // budgeted categories
    const items: BudgetVsActual[] = typeBudgets.map((b) => {
      const actual = actualByCategory[b.category]?.amount ?? 0
      const remaining = b.amount - actual
      const percentage = b.amount > 0 ? (actual / b.amount) * 100 : 0
      return { category: b.category, type, budgeted: b.amount, actual, remaining, percentage }
    })

    // transactions in categories with no budget
    for (const [cat, info] of Object.entries(actualByCategory)) {
      if (info.type !== type) continue
      if (typeBudgets.some((b) => b.category === cat)) continue
      items.push({ category: cat, type, budgeted: 0, actual: info.amount, remaining: -info.amount, percentage: 100 })
    }

    return items.sort((a, b) => b.actual - a.actual)
  }

  const expenseItems = useMemo(() => buildItems('expense'), [budgets, actualByCategory])
  const incomeItems = useMemo(() => buildItems('income'), [budgets, actualByCategory])

  const totalExpBudget = expenseItems.reduce((s, i) => s + i.budgeted, 0)
  const totalExpActual = expenseItems.reduce((s, i) => s + i.actual, 0)
  const totalIncBudget = incomeItems.reduce((s, i) => s + i.budgeted, 0)
  const totalIncActual = incomeItems.reduce((s, i) => s + i.actual, 0)

  const selectedMonthLabel = MONTHS.find((m) => m.value === month)?.label ?? ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orçamento</h1>
          <p className="text-sm text-muted-foreground">
            Planejado vs. realizado — {selectedMonthLabel} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => { if (v) setMonth(Number(v)) }}>
            <SelectTrigger className="w-36 bg-card">
              <span className="flex flex-1 text-left text-sm">{selectedMonthLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => { if (v) setYear(Number(v)) }}>
            <SelectTrigger className="w-24 bg-card">
              <span className="flex flex-1 text-left text-sm">{year}</span>
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Novo orçamento
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-card shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Receitas Orçadas"
            accentColor="#6c63ff"
            value={totalIncBudget}
          />
          <SummaryCard
            label="Receitas Realizadas"
            accentColor={totalIncActual >= totalIncBudget ? '#43e97b' : '#6c63ff'}
            value={totalIncActual}
            sub={totalIncBudget > 0
              ? `${((totalIncActual / totalIncBudget) * 100).toFixed(0)}% do orçado`
              : undefined}
          />
          <SummaryCard
            label="Despesas Orçadas"
            accentColor="#6c63ff"
            value={totalExpBudget}
          />
          <SummaryCard
            label="Despesas Realizadas"
            accentColor={totalExpActual > totalExpBudget ? '#ff6584' : '#6c63ff'}
            value={totalExpActual}
            sub={totalExpBudget > 0
              ? `${((totalExpActual / totalExpBudget) * 100).toFixed(0)}% do orçado`
              : undefined}
          />
        </div>
      )}

      {/* Progress lists */}
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
          <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <BudgetProgressList
            title="Receitas"
            items={incomeItems}
            budgets={budgets}
            onEdit={handleEdit}
            onDelete={handleDelete}
            accentColor="green"
          />
          <BudgetProgressList
            title="Despesas"
            items={expenseItems}
            budgets={budgets}
            onEdit={handleEdit}
            onDelete={handleDelete}
            accentColor="red"
          />
        </div>
      )}

      <BudgetFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditTarget(null)
        }}
        budget={editTarget}
        month={month}
        year={year}
        onSuccess={fetchData}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  accentColor,
  sub,
}: {
  label: string
  value: number
  accentColor: string
  sub?: string
}) {
  return (
    <Card className="relative overflow-hidden shadow-sm">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accentColor }} />
      <CardHeader className="pb-1 pt-5">
        <CardTitle className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-xl font-bold" style={{ color: accentColor }}>{formatCurrency(value)}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}
