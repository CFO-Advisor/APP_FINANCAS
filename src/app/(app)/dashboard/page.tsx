'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
import { IncomeCategoryChart } from '@/components/dashboard/income-category-chart'
import { InvestmentCategoryChart } from '@/components/dashboard/investment-category-chart'
import { BudgetWidget } from '@/components/dashboard/budget-widget'
import { BankBalanceWidget } from '@/components/dashboard/bank-balance-widget'
import { CreditCardWidget } from '@/components/dashboard/credit-card-widget'
import { InvestmentBalanceWidget, INVESTMENT_GROUPS, type InvestmentGroupBalance } from '@/components/dashboard/investment-balance-widget'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_COLORS, MONTHS } from '@/lib/constants'
import { formatCurrency } from '@/lib/csv-export'
import { computeCardBalance } from '@/lib/credit-card-utils'
import type { Transaction, DashboardSummary, CategoryTotal, Budget, BudgetVsActual, Bank, BankBalance, CreditCard, CreditCardBalance } from '@/lib/types'

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i)

type ViewMode = 'monthly' | 'yearly'

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([])
  const [cardBalances, setCardBalances] = useState<CreditCardBalance[]>([])
  const [investmentGroupBalances, setInvestmentGroupBalances] = useState<InvestmentGroupBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(currentYear)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const startDate = viewMode === 'yearly'
      ? `${year}-01-01`
      : `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = viewMode === 'yearly'
      ? `${year}-12-31`
      : `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

    const [txRes, budgetsRes, banksRes, allTxRes, cardsRes, allCardTxRes, allInvTxRes, invSettingsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('month', month).eq('year', year),
      supabase.from('banks').select('*').order('name'),
      supabase.from('transactions').select('bank_id, type, amount, credit_card_id').not('bank_id', 'is', null),
      supabase.from('credit_cards').select('*').order('name'),
      supabase.from('transactions').select('*').not('credit_card_id', 'is', null),
      supabase.from('transactions').select('category, amount').eq('type', 'investment'),
      supabase.from('investment_settings').select('group_key, initial_balance'),
    ])

    if (!txRes.error && txRes.data) setTransactions(txRes.data as Transaction[])
    if (!budgetsRes.error && budgetsRes.data) setBudgets(budgetsRes.data as Budget[])

    if (!banksRes.error && banksRes.data) {
      const rawBanks = banksRes.data as Bank[]
      const allTx = (allTxRes.data ?? []) as Pick<Transaction, 'bank_id' | 'type' | 'amount' | 'credit_card_id'>[]
      const totals: Record<string, { income: number; expense: number }> = {}
      for (const t of allTx) {
        if (!t.bank_id) continue
        // skip card expenses (not yet debited from bank), but include payments (they ARE debited)
        if (t.credit_card_id && t.type !== 'credit_card_payment') continue
        if (!totals[t.bank_id]) totals[t.bank_id] = { income: 0, expense: 0 }
        if (t.type === 'income') totals[t.bank_id].income += t.amount
        else totals[t.bank_id].expense += t.amount
      }
      setBankBalances(rawBanks.map((b) => {
        const t = totals[b.id] ?? { income: 0, expense: 0 }
        return { ...b, totalIncome: t.income, totalExpense: t.expense, balance: b.initial_balance + t.income - t.expense }
      }))
    }

    if (!cardsRes.error && cardsRes.data) {
      const rawCards = cardsRes.data as CreditCard[]
      const cardTxs = (allCardTxRes.data ?? []) as Transaction[]
      setCardBalances(rawCards.map((c) => computeCardBalance(c, cardTxs)))
    }

    // Investment accumulated balances (all time, not filtered by period)
    const allInvTx = (allInvTxRes.data ?? []) as { category: string; amount: number }[]
    const invSettings = (invSettingsRes.data ?? []) as { group_key: string; initial_balance: number }[]
    const invSettingsMap: Record<string, number> = {}
    for (const s of invSettings) invSettingsMap[s.group_key] = s.initial_balance
    const catTotals: Record<string, number> = {}
    for (const t of allInvTx) catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount
    setInvestmentGroupBalances(
      INVESTMENT_GROUPS.map((g) => ({
        label: g.label,
        color: g.color,
        icon: g.icon,
        total:
          (invSettingsMap[g.label] ?? 0) +
          g.categories.reduce((s, cat) => s + (catTotals[cat] ?? 0), 0),
      }))
    )

    setLoading(false)
  }, [month, year, viewMode])

  useEffect(() => { fetchData() }, [fetchData])

  const summary: DashboardSummary = transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.totalIncome += t.amount
      else if (t.type === 'expense') acc.totalExpense += t.amount
      else if (t.type === 'investment') acc.totalInvestment += t.amount
      acc.balance = acc.totalIncome - acc.totalExpense
      return acc
    },
    { totalIncome: 0, totalExpense: 0, totalInvestment: 0, balance: 0 }
  )

  const categoryTotals: CategoryTotal[] = Object.entries(
    transactions
      .filter((t) => t.type === 'expense')
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount
        return acc
      }, {})
  )
    .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] ?? '#94A3B8' }))
    .sort((a, b) => b.value - a.value)

  const incomeCategoryTotals = Object.entries(
    transactions
      .filter((t) => t.type === 'income')
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount
        return acc
      }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const investmentCategoryTotals: CategoryTotal[] = Object.entries(
    transactions
      .filter((t) => t.type === 'investment')
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount
        return acc
      }, {})
  )
    .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] ?? '#a78bfa' }))
    .sort((a, b) => b.value - a.value)

  const recentTransactions = transactions.slice(0, 6)

  const actualByCategory = useMemo(() => {
    const map: Record<string, { amount: number; type: 'expense' | 'income' }> = {}
    for (const t of transactions) {
      if (t.type === 'investment' || t.type === 'credit_card_payment') continue
      if (!map[t.category]) map[t.category] = { amount: 0, type: t.type }
      map[t.category].amount += t.amount
    }
    return map
  }, [transactions])

  function buildBudgetItems(type: 'expense' | 'income'): BudgetVsActual[] {
    return budgets
      .filter((b) => b.type === type)
      .map((b) => {
        const actual = actualByCategory[b.category]?.amount ?? 0
        const remaining = b.amount - actual
        const percentage = b.amount > 0 ? (actual / b.amount) * 100 : 0
        return { category: b.category, type, budgeted: b.amount, actual, remaining, percentage }
      })
      .sort((a, b) => b.percentage - a.percentage)
  }

  const budgetExpenseItems = useMemo(() => buildBudgetItems('expense'), [budgets, actualByCategory])
  const budgetIncomeItems = useMemo(() => buildBudgetItems('income'), [budgets, actualByCategory])

  const selectedMonthLabel = MONTHS.find((m) => m.value === month)?.label ?? ''
  const periodLabel = viewMode === 'yearly' ? String(year) : `${selectedMonthLabel} ${year}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumo financeiro de {periodLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex overflow-hidden rounded-lg border border-border text-sm font-medium">
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setViewMode('yearly')}
              className={`px-3 py-1.5 transition-colors border-l border-border ${
                viewMode === 'yearly'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              Anual
            </button>
          </div>

          {/* Month selector — only in monthly mode */}
          {viewMode === 'monthly' && (
            <Select value={String(month)} onValueChange={(v) => { if (v) setMonth(Number(v)) }}>
              <SelectTrigger className="w-36 bg-card">
                {/* Render the label directly to avoid Base UI SelectValue display issue */}
                <span className="flex flex-1 text-left text-sm">
                  {selectedMonthLabel}
                </span>
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Year selector */}
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
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-card border shadow-sm" />
          ))}
        </div>
      ) : (
        <SummaryCards summary={summary} />
      )}

      {/* Three donut charts side by side */}
      <div className="grid gap-6 lg:grid-cols-3">
        {loading ? (
          <>
            <div className="h-80 animate-pulse rounded-lg border bg-card shadow-sm" />
            <div className="h-80 animate-pulse rounded-lg border bg-card shadow-sm" />
            <div className="h-80 animate-pulse rounded-lg border bg-card shadow-sm" />
          </>
        ) : (
          <>
            <IncomeCategoryChart data={incomeCategoryTotals} />
            <CategoryChart data={categoryTotals} />
            <InvestmentCategoryChart data={investmentCategoryTotals} />
          </>
        )}
      </div>

      {/* Bank + Cards + Investments + Budget */}
      {viewMode === 'monthly' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
              <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
              <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
              <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
            </>
          ) : (
            <>
              <BankBalanceWidget banks={bankBalances} />
              <CreditCardWidget cards={cardBalances} />
              <InvestmentBalanceWidget groups={investmentGroupBalances} />
              <BudgetWidget expenseItems={budgetExpenseItems} incomeItems={budgetIncomeItems} />
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
              <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
              <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
            </>
          ) : (
            <>
              <BankBalanceWidget banks={bankBalances} />
              <CreditCardWidget cards={cardBalances} />
              <InvestmentBalanceWidget groups={investmentGroupBalances} />
            </>
          )}
        </div>
      )}

      {/* Recent transactions — full width */}
      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border bg-card shadow-sm" />
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {viewMode === 'yearly' ? `Últimas transações de ${year}` : 'Transações Recentes'}
            </CardTitle>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/transactions" />} className="flex items-center gap-1 text-blue-600">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
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
              <div className="grid gap-x-6 sm:grid-cols-2">
                {recentTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.category} •{' '}
                        {format(new Date(t.date + 'T00:00:00'), 'dd MMM', { locale: ptBR })}
                      </p>
                    </div>
                    <span
                      className="ml-3 shrink-0 text-sm font-semibold"
                      style={{ color: t.type === 'income' ? '#43e97b' : t.type === 'investment' ? '#a78bfa' : '#ff6584' }}
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
      )}
    </div>
  )
}
