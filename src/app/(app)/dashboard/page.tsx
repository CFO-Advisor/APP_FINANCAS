'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ArrowDownRight, Landmark, TrendingUp as TrendingUpIcon, Package2, ScrollText, CreditCard as CreditCardIcon, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { DashboardAlerts } from '@/components/dashboard/dashboard-alerts'
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
import type { Transaction, DashboardSummary, CategoryTotal, Budget, BudgetVsActual, Bank, BankBalance, CreditCard, CreditCardBalance, Debt, Asset } from '@/lib/types'

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i)

type ViewMode = 'monthly' | 'yearly'

/** Total de dias do período selecionado (mês: 28-31; ano: 365/366 conforme bissexto). */
function totalDaysInPeriod(viewMode: ViewMode, month: number, year: number): number {
  if (viewMode === 'yearly') {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return isLeap ? 366 : 365
  }
  return new Date(year, month, 0).getDate()
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([])
  const [cardBalances, setCardBalances] = useState<CreditCardBalance[]>([])
  const [investmentGroupBalances, setInvestmentGroupBalances] = useState<InvestmentGroupBalance[]>([])
  const [assetsData, setAssetsData] = useState<Pick<Asset, 'group_type' | 'value'>[]>([])
  const [debtsData, setDebtsData] = useState<Pick<Debt, 'group_type' | 'total_amount' | 'monthly_amount' | 'installments_paid' | 'status'>[]>([])
  const [previousSummary, setPreviousSummary] = useState<DashboardSummary>({ totalIncome: 0, totalExpense: 0, totalInvestment: 0, balance: 0 })
  const [caixaInicial, setCaixaInicial] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(currentYear)

  useEffect(() => {
    let ignore = false

    async function fetchData() {
    setLoading(true)
    const supabase = createClient()

    const startDate = viewMode === 'yearly'
      ? `${year}-01-01`
      : `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = viewMode === 'yearly'
      ? `${year}-12-31`
      : `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

    // Previous period (previous month, or previous year in yearly view) — for KPI trend deltas
    const prevMonth = month === 1 ? 12 : month - 1
    const prevMonthYear = month === 1 ? year - 1 : year
    const prevStartDate = viewMode === 'yearly'
      ? `${year - 1}-01-01`
      : `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-01`
    const prevEndDate = viewMode === 'yearly'
      ? `${year - 1}-12-31`
      : `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-${new Date(prevMonthYear, prevMonth, 0).getDate()}`

    const [txRes, budgetsRes, banksRes, allTxRes, cardsRes, allCardTxRes, allInvTxRes, invSettingsRes, assetsRes, debtsRes, prevTxRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('month', month).eq('year', year),
      supabase.from('banks').select('*').order('name'),
      supabase.from('transactions').select('bank_id, transfer_bank_id, type, amount, credit_card_id, date').not('bank_id', 'is', null),
      supabase.from('credit_cards').select('*').order('name'),
      supabase.from('transactions').select('*').not('credit_card_id', 'is', null),
      supabase.from('transactions').select('category, amount').eq('type', 'investment'),
      supabase.from('investment_settings').select('group_key, initial_balance'),
      supabase.from('assets').select('group_type, value'),
      supabase.from('debts').select('group_type, total_amount, monthly_amount, installments_paid, status').neq('status', 'paid'),
      supabase.from('transactions').select('type, amount').gte('date', prevStartDate).lte('date', prevEndDate),
    ])

    if (ignore) return

    if (!txRes.error && txRes.data) setTransactions(txRes.data as Transaction[])
    if (!budgetsRes.error && budgetsRes.data) setBudgets(budgetsRes.data as Budget[])

    if (!prevTxRes.error && prevTxRes.data) {
      const prevTx = prevTxRes.data as Pick<Transaction, 'type' | 'amount'>[]
      setPreviousSummary(
        prevTx.reduce(
          (acc, t) => {
            if (t.type === 'income') acc.totalIncome += t.amount
            else if (t.type === 'expense') acc.totalExpense += t.amount
            else if (t.type === 'investment') acc.totalInvestment += t.amount
            acc.balance = acc.totalIncome - acc.totalExpense
            return acc
          },
          { totalIncome: 0, totalExpense: 0, totalInvestment: 0, balance: 0 }
        )
      )
    }

    if (!banksRes.error && banksRes.data) {
      const rawBanks = banksRes.data as Bank[]
      const allTx = (allTxRes.data ?? []) as Pick<Transaction, 'bank_id' | 'transfer_bank_id' | 'type' | 'amount' | 'credit_card_id' | 'date'>[]
      const totals: Record<string, { income: number; expense: number }> = {}
      // Transferências movem saldo entre contas, mas não são receita nem despesa
      const transferOut: Record<string, number> = {}
      const transferIn: Record<string, number> = {}
      for (const t of allTx) {
        // skip card expenses (not yet debited from bank), but include payments (they ARE debited)
        if (t.credit_card_id && t.type !== 'credit_card_payment') continue
        if (t.type === 'transfer') {
          if (t.bank_id) transferOut[t.bank_id] = (transferOut[t.bank_id] ?? 0) + t.amount
          if (t.transfer_bank_id) transferIn[t.transfer_bank_id] = (transferIn[t.transfer_bank_id] ?? 0) + t.amount
          continue
        }
        if (!t.bank_id) continue
        if (!totals[t.bank_id]) totals[t.bank_id] = { income: 0, expense: 0 }
        if (t.type === 'income') totals[t.bank_id].income += t.amount
        else totals[t.bank_id].expense += t.amount
      }
      setBankBalances(rawBanks.map((b) => {
        const t = totals[b.id] ?? { income: 0, expense: 0 }
        return {
          ...b,
          totalIncome: t.income,
          totalExpense: t.expense,
          balance: b.initial_balance + t.income - t.expense + (transferIn[b.id] ?? 0) - (transferOut[b.id] ?? 0),
        }
      }))

      // Caixa no início do período = saldo inicial das contas + movimentos
      // anteriores ao período (mesmas regras do caixa: compra no cartão só
      // afeta quando a fatura é paga; transferência entre contas é interna).
      let caixaInicialCalc = rawBanks.reduce((s, b) => s + b.initial_balance, 0)
      for (const t of allTx) {
        if (t.date >= startDate) continue
        if (t.credit_card_id && t.type !== 'credit_card_payment') continue
        if (t.type === 'transfer') continue
        caixaInicialCalc += t.type === 'income' ? t.amount : -t.amount
      }
      setCaixaInicial(caixaInicialCalc)
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

    if (!assetsRes.error && assetsRes.data) setAssetsData(assetsRes.data as Pick<Asset, 'group_type' | 'value'>[])
    if (!debtsRes.error && debtsRes.data) setDebtsData(debtsRes.data as Pick<Debt, 'group_type' | 'total_amount' | 'monthly_amount' | 'installments_paid' | 'status'>[])

    setUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    setLoading(false)
    }

    fetchData()
    return () => { ignore = true }
  }, [month, year, viewMode])

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

  const totalDays = totalDaysInPeriod(viewMode, month, year)
  const expenseDailyAvg = totalDays > 0 ? summary.totalExpense / totalDays : 0

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

  // Balance sheet totals
  const bankTotal       = bankBalances.reduce((s, b) => s + b.balance, 0)
  const investmentTotal = investmentGroupBalances.reduce((s, g) => s + g.total, 0)
  const goodsTotal      = assetsData.filter((a) => a.group_type === 'goods').reduce((s, a) => s + a.value, 0)
  const rightsTotal     = assetsData.filter((a) => a.group_type === 'rights').reduce((s, a) => s + a.value, 0)
  const totalAtivos     = bankTotal + investmentTotal + goodsTotal + rightsTotal

  const cardTotal       = cardBalances.reduce((s, c) => s + c.outstandingBalance, 0)
  const loanRemaining   = debtsData.filter((d) => d.group_type === 'loans').reduce((s, d) => s + Math.max(0, d.total_amount - (d.installments_paid ?? 0) * d.monthly_amount), 0)
  const billsMonthly    = debtsData.filter((d) => d.group_type === 'bills').reduce((s, d) => s + d.monthly_amount, 0)
  const otherTotal      = debtsData.filter((d) => d.group_type === 'other').reduce((s, d) => s + (d.total_amount > 0 ? d.total_amount : d.monthly_amount), 0)
  const totalPassivos   = cardTotal + loanRemaining + billsMonthly + otherTotal
  const patrimonioLiquido = totalAtivos - totalPassivos

  // ── Fluxo de Caixa (movimentação efetiva das contas bancárias) ──────
  // Compras no cartão só saem do caixa quando a fatura é paga;
  // transferências entre contas são internas (efeito líquido zero);
  // lançamentos sem conta vinculada não passam pelo caixa.
  const cashFlow = useMemo(() => {
    let entradas = 0
    let saidasDespesas = 0
    let saidasInvestimentos = 0
    let saidasFatura = 0
    let comprasCartao = 0
    const entradasCat: Record<string, number> = {}

    for (const t of transactions) {
      if (t.credit_card_id && t.type !== 'credit_card_payment') {
        comprasCartao += t.amount
        continue
      }
      if (t.type === 'transfer') continue
      if (!t.bank_id) continue

      if (t.type === 'income') {
        entradas += t.amount
        entradasCat[t.category] = (entradasCat[t.category] ?? 0) + t.amount
        continue
      }
      if (t.type === 'investment') saidasInvestimentos += t.amount
      else if (t.type === 'credit_card_payment') saidasFatura += t.amount
      else saidasDespesas += t.amount
    }

    const saidas = saidasDespesas + saidasInvestimentos + saidasFatura
    const bruto = entradas + saidas
    return {
      entradas,
      saidas,
      saidasDespesas,
      saidasInvestimentos,
      saidasFatura,
      comprasCartao,
      resultado: entradas - saidas,
      pctEntradas: bruto > 0 ? (entradas / bruto) * 100 : 0,
      pctSaidas: bruto > 0 ? (saidas / bruto) * 100 : 0,
      entradasCat: Object.entries(entradasCat).sort((a, b) => b[1] - a[1]).slice(0, 4),
    }
  }, [transactions])

  const actualByCategory = useMemo(() => {
    const map: Record<string, { amount: number; type: 'expense' | 'income' }> = {}
    for (const t of transactions) {
      if (t.type === 'investment' || t.type === 'credit_card_payment' || t.type === 'transfer') continue
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
  const trendLabel = viewMode === 'yearly' ? 'ano anterior' : 'mês anterior'

  return (
    <div className="space-y-6" aria-busy={loading}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumo financeiro de {periodLabel}
            {updatedAt && <span className="text-muted-foreground/70"> · atualizado às {updatedAt}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div
            role="group"
            aria-label="Período de visualização"
            className="flex overflow-hidden rounded-lg border border-border text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              aria-pressed={viewMode === 'monthly'}
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
              aria-pressed={viewMode === 'yearly'}
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

      {/* Alerts — only rendered when there's something actionable */}
      {!loading && <DashboardAlerts cards={cardBalances} budgetItems={budgetExpenseItems} />}

      {/* Summary Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-card border border-border" />
          ))}
        </div>
      ) : (
        <SummaryCards summary={summary} previous={previousSummary} trendLabel={trendLabel} expenseDailyAvg={expenseDailyAvg} periodDays={totalDays} />
      )}

      {/* Three donut charts side by side */}
      <div className="grid gap-6 lg:grid-cols-3">
        {loading ? (
          <>
            <div className="h-80 animate-pulse rounded-lg border border-border bg-card" />
            <div className="h-80 animate-pulse rounded-lg border border-border bg-card" />
            <div className="h-80 animate-pulse rounded-lg border border-border bg-card" />
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
        <div className="grid gap-6 sm:grid-cols-2">
          {loading ? (
            <>
              <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
              <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
              <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
              <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
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
              <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
              <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
              <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
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

      {/* Balanço Patrimonial — full width */}
      {loading ? (
        <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="font-semibold">Balanço Patrimonial</p>
              <p className="text-xs text-muted-foreground">Visão consolidada do patrimônio</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Patrimônio Líquido</p>
                <p
                  className="text-lg font-semibold tracking-tight tabular-nums"
                  style={{ color: patrimonioLiquido >= 0 ? 'var(--positive)' : 'var(--destructive)' }}
                >
                  {formatCurrency(patrimonioLiquido)}
                </p>
              </div>
              <Link href="/balance">
                <Button variant="ghost" size="sm" className="flex items-center gap-1 text-primary">
                  Ver detalhes <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Ativos vs Passivos proportion bar */}
          {(totalAtivos + totalPassivos) > 0 && (
            <div className="px-5 pt-4">
              <div className="mb-1.5 flex justify-between text-[0.65rem] text-muted-foreground">
                <span>Ativos {((totalAtivos / (totalAtivos + totalPassivos)) * 100).toFixed(0)}%</span>
                <span>Passivos {((totalPassivos / (totalAtivos + totalPassivos)) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full"
                  style={{ width: `${(totalAtivos / (totalAtivos + totalPassivos)) * 100}%`, backgroundColor: 'var(--positive)' }}
                />
                <div
                  className="h-full"
                  style={{ width: `${(totalPassivos / (totalAtivos + totalPassivos)) * 100}%`, backgroundColor: 'var(--destructive)' }}
                />
              </div>
            </div>
          )}

          {/* Two columns */}
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {/* Ativos */}
            <div className="px-5 py-4">
              <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: 'var(--positive)' }}>
                Ativos
              </p>
              <div className="space-y-2.5">
                {([
                  { label: 'Bancos',          value: bankTotal,       Icon: Landmark       },
                  { label: 'Investimentos',   value: investmentTotal, Icon: TrendingUpIcon  },
                  { label: 'Bens',            value: goodsTotal,      Icon: Package2        },
                  { label: 'Direitos',        value: rightsTotal,     Icon: ScrollText      },
                ] as const).map(({ label, value, Icon }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="flex-1 text-sm text-muted-foreground">{label}</span>
                    <span className="tabular-nums text-sm font-medium text-foreground">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-border pt-2.5">
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--positive)' }}>{formatCurrency(totalAtivos)}</span>
              </div>
            </div>

            {/* Passivos */}
            <div className="px-5 py-4">
              <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: 'var(--destructive)' }}>
                Passivos
              </p>
              <div className="space-y-2.5">
                {([
                  { label: 'Cartões',         value: cardTotal,      Icon: CreditCardIcon },
                  { label: 'Empréstimos',     value: loanRemaining,  Icon: Landmark       },
                  { label: 'Contas a Pagar',  value: billsMonthly,   Icon: ScrollText     },
                  { label: 'Obrigações',      value: otherTotal,     Icon: AlertCircle    },
                ] as const).map(({ label, value, Icon }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="flex-1 text-sm text-muted-foreground">{label}</span>
                    <span className="tabular-nums text-sm font-medium text-foreground">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-border pt-2.5">
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--destructive)' }}>{formatCurrency(totalPassivos)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fluxo de Caixa — full width */}
      {loading ? (
        <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="font-semibold">Fluxo de Caixa</p>
              <p className="text-xs text-muted-foreground">Entradas e saídas de {periodLabel} · contas bancárias</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Resultado do período</p>
                <p
                  className="text-lg font-semibold tracking-tight tabular-nums"
                  style={{ color: cashFlow.resultado >= 0 ? 'var(--positive)' : 'var(--destructive)' }}
                >
                  {formatCurrency(cashFlow.resultado)}
                </p>
              </div>
              <Link href="/transactions">
                <Button variant="ghost" size="sm" className="flex items-center gap-1 text-primary">
                  Ver transações <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Entradas vs Saídas proportion bar */}
          {(cashFlow.entradas + cashFlow.saidas) > 0 && (
            <div className="px-5 pt-4">
              <div className="mb-1.5 flex justify-between text-[0.65rem] text-muted-foreground">
                <span>Entradas {cashFlow.pctEntradas.toFixed(0)}%</span>
                <span>Saídas {cashFlow.pctSaidas.toFixed(0)}%</span>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full"
                  style={{ width: `${cashFlow.pctEntradas}%`, backgroundColor: 'var(--positive)' }}
                />
                <div
                  className="h-full"
                  style={{ width: `${cashFlow.pctSaidas}%`, backgroundColor: 'var(--destructive)' }}
                />
              </div>
            </div>
          )}

          {/* Two columns */}
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {/* Entradas */}
            <div className="px-5 py-4">
              <p className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: 'var(--positive)' }}>
                <ArrowUpRight className="h-3 w-3" /> Entradas
              </p>
              <div className="space-y-2.5">
                {cashFlow.entradasCat.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma entrada no período.</p>
                ) : (
                  cashFlow.entradasCat.map(([cat, value]) => (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] ?? 'var(--positive)' }} />
                      <span className="flex-1 truncate text-sm text-muted-foreground">{cat}</span>
                      <span className="tabular-nums text-sm font-medium text-foreground">{formatCurrency(value)}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 flex justify-between border-t border-border pt-2.5">
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--positive)' }}>{formatCurrency(cashFlow.entradas)}</span>
              </div>
            </div>

            {/* Saídas */}
            <div className="px-5 py-4">
              <p className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: 'var(--destructive)' }}>
                <ArrowDownRight className="h-3 w-3" /> Saídas
              </p>
              <div className="space-y-2.5">
                {([
                  { label: 'Despesas',            value: cashFlow.saidasDespesas,      Icon: ArrowDownRight },
                  { label: 'Investimentos',       value: cashFlow.saidasInvestimentos, Icon: TrendingUpIcon },
                  { label: 'Pagamento de fatura', value: cashFlow.saidasFatura,        Icon: CreditCardIcon },
                ] as const).map(({ label, value, Icon }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="flex-1 text-sm text-muted-foreground">{label}</span>
                    <span className="tabular-nums text-sm font-medium text-foreground">{formatCurrency(value)}</span>
                  </div>
                ))}
                {cashFlow.comprasCartao > 0 && (
                  <div className="flex items-center gap-2 border-t border-dashed border-border pt-2.5">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground/70">
                      <CreditCardIcon className="h-3 w-3" />
                    </span>
                    <span className="flex-1 text-sm text-muted-foreground">
                      Compras no cartão <span className="text-[0.65rem] text-muted-foreground/70">(fora do caixa)</span>
                    </span>
                    <span className="tabular-nums text-sm font-medium text-muted-foreground">{formatCurrency(cashFlow.comprasCartao)}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-between border-t border-border pt-2.5">
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--destructive)' }}>{formatCurrency(cashFlow.saidas)}</span>
              </div>
            </div>
          </div>

          {/* Saldo inicial → resultado → saldo final */}
          <div className="grid gap-4 border-t border-border px-5 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Saldo inicial do período</p>
              <p className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(caixaInicial)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resultado do período</p>
              <p
                className="text-base font-semibold tabular-nums"
                style={{ color: cashFlow.resultado >= 0 ? 'var(--positive)' : 'var(--destructive)' }}
              >
                {cashFlow.resultado >= 0 ? '+' : ''}{formatCurrency(cashFlow.resultado)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo final do período</p>
              <p className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(caixaInicial + cashFlow.resultado)}</p>
            </div>
          </div>

          {/* Referências */}
          <div className="space-y-1 border-t border-border bg-muted/30 px-5 py-3">
            <p className="text-[0.7rem] text-muted-foreground">
              Caixa hoje em todas as contas:{' '}
              <span className="font-medium tabular-nums text-foreground">{formatCurrency(bankTotal)}</span>
              {' '}· compras no cartão entram no caixa somente quando a fatura é paga
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
