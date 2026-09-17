'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, FileDown, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { TransactionFormDialog } from '@/components/transactions/transaction-form-dialog'
import { TransactionTable } from '@/components/transactions/transaction-table'
import { ImportDialog } from '@/components/import/import-dialog'
import { AI_PREFILL_EVENT, AI_PREFILL_STORAGE, AI_OPEN_IMPORT_EVENT, AI_CATEGORY_CREATED_EVENT, consumePendingImportFile } from '@/components/layout/assistant-panel'
import { createClient } from '@/lib/supabase/client'
import { exportToCSV, formatCurrency } from '@/lib/csv-export'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, INVESTMENT_CATEGORIES } from '@/lib/constants'
import type { Transaction, Bank, CreditCard, TransactionType } from '@/lib/types'

const CUSTOM_CAT_KEY = 'financas_custom_categories_v3'
const now = new Date()

type CustomCategories = { expense: string[]; income: string[]; investment: string[] }

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)
  const [aiPrefill, setAiPrefill] = useState<Parameters<typeof TransactionFormDialog>[0]['prefill']>(null)
  const [aiImportFile, setAiImportFile] = useState<File | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [customCategories, setCustomCategories] = useState<CustomCategories>(() => {
    if (typeof window === 'undefined') return { expense: [], income: [], investment: [] }
    try {
      const stored = localStorage.getItem(CUSTOM_CAT_KEY)
      return stored ? JSON.parse(stored) : { expense: [], income: [], investment: [] }
    } catch { return { expense: [], income: [], investment: [] } }
  })

  const allCategories = useMemo(() => {
    const allExpense = [...EXPENSE_CATEGORIES, ...customCategories.expense.filter((c) => !EXPENSE_CATEGORIES.includes(c))]
    const allIncome = [...INCOME_CATEGORIES, ...customCategories.income.filter((c) => !INCOME_CATEGORIES.includes(c))]
    const allInvestment = [...INVESTMENT_CATEGORIES, ...customCategories.investment.filter((c) => !INVESTMENT_CATEGORIES.includes(c))]
    return [...new Set([...allExpense, ...allIncome, ...allInvestment])]
  }, [customCategories])

  function handleAddCategory(name: string, type: TransactionType) {
    setCustomCategories((prev) => {
      const list = (type in prev ? prev[type as keyof CustomCategories] : null) ?? []
      if (list.includes(name)) return prev
      const updated = { ...prev, [type]: [...list, name] }
      localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Filters
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [category, setCategory] = useState('all')
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const [bankFilter, setBankFilter] = useState('all')

  const [reloadKey, setReloadKey] = useState(0)
  const fetchTransactions = () => setReloadKey((k) => k + 1)
  const urlTypeApplied = useRef(false)

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      const supabase = createClient()

      // Filtro de tipo vindo da URL (cards do dashboard → /transactions?type=expense),
      // aplicado uma única vez para não sobrescrever a escolha manual do usuário.
      if (!urlTypeApplied.current) {
        const t = new URLSearchParams(window.location.search).get('type')
        if (t === 'income' || t === 'expense' || t === 'investment' || t === 'credit_card_payment' || t === 'transfer') setType(t)
        urlTypeApplied.current = true
      }

      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

      const [txRes, banksRes, cardsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),
        supabase.from('banks').select('*').order('name'),
        supabase.from('credit_cards').select('*').order('name'),
      ])

      if (ignore) return

      if (!txRes.error && txRes.data) setTransactions(txRes.data as Transaction[])
      if (!banksRes.error && banksRes.data) setBanks(banksRes.data as Bank[])
      if (!cardsRes.error && cardsRes.data) setCreditCards(cardsRes.data as CreditCard[])
      setLoading(false)
    }

    load()
    return () => { ignore = true }
  }, [reloadKey, month, year])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (category !== 'all' && t.category !== category) return false
      if (type !== 'all' && t.type !== type) return false
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false
      // Filtro por conta: inclui transferências onde a conta é origem ou destino
      if (bankFilter !== 'all' && t.bank_id !== bankFilter && t.transfer_bank_id !== bankFilter) return false
      return true
    })
  }, [transactions, category, type, search, bankFilter])

  // Resumo do período filtrado (padrão dos apps financeiros BR: entradas/saídas/saldo)
  const filtersActive = category !== 'all' || type !== 'all' || search !== '' || bankFilter !== 'all'
  const summary = useMemo(() => {
    let entradas = 0
    let saidas = 0
    let transfer = 0
    let investido = 0
    let faturas = 0
    for (const t of filtered) {
      if (t.type === 'income') entradas += t.amount
      else if (t.type === 'expense') saidas += t.amount
      else if (t.type === 'transfer') transfer += t.amount
      else if (t.type === 'investment') investido += t.amount
      else if (t.type === 'credit_card_payment') faturas += t.amount
    }
    return { entradas, saidas, transfer, investido, faturas }
  }, [filtered])

  // Separa transações de cartão das bancárias (tabelas distintas)
  const cardTxs = useMemo(() => filtered.filter((t) => !!t.credit_card_id), [filtered])
  const bankTxs = useMemo(() => filtered.filter((t) => !t.credit_card_id), [filtered])

  function handleEdit(transaction: Transaction) {
    setEditTarget(transaction)
    setDialogOpen(true)
  }

  function handleAdd() {
    setAiPrefill(null)
    setEditTarget(null)
    setDialogOpen(true)
  }

  // Assistente IA: evento de prefill (painel aberto) ou sessionStorage
  // (quando o assistente navega até esta página a partir de outra)
  useEffect(() => {
    function onPrefill(e: Event) {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      setAiPrefill(detail)
      setEditTarget(null)
      setDialogOpen(true)
    }
    window.addEventListener(AI_PREFILL_EVENT, onPrefill)
    // Assistente IA: arquivo de extrato anexado no painel → abre o import
    function onOpenImport() {
      const f = consumePendingImportFile()
      if (f) setAiImportFile(f)
      setImportOpen(true)
    }
    window.addEventListener(AI_OPEN_IMPORT_EVENT, onOpenImport)
    // Assistente IA: categoria criada no painel → atualiza a lista viva
    function onCategoryCreated(e: Event) {
      const d = (e as CustomEvent).detail as { name?: string; type?: string } | undefined
      if (!d?.name) return
      const t = (d.type === 'income' || d.type === 'investment' ? d.type : 'expense') as TransactionType
      handleAddCategory(d.name, t)
    }
    window.addEventListener(AI_CATEGORY_CREATED_EVENT, onCategoryCreated)
    try {
      const stored = sessionStorage.getItem(AI_PREFILL_STORAGE)
      if (stored) {
        sessionStorage.removeItem(AI_PREFILL_STORAGE)
        const detail = JSON.parse(stored)
        setAiPrefill(detail)
        setEditTarget(null)
        setDialogOpen(true)
      }
    } catch { /* ignore */ }
    return () => {
      window.removeEventListener(AI_PREFILL_EVENT, onPrefill)
      window.removeEventListener(AI_OPEN_IMPORT_EVENT, onOpenImport)
      window.removeEventListener(AI_CATEGORY_CREATED_EVENT, onCategoryCreated)
    }
  }, [])

  function handleDialogClose(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditTarget(null)
  }

  function handleReset() {
    setCategory('all')
    setType('all')
    setSearch('')
    setBankFilter('all')
  }

  function handleExport() {
    exportToCSV(filtered)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transações</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Carregando...' : `${filtered.length} transação${filtered.length !== 1 ? 'ões' : ''} encontrada${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Nova transação
          </Button>
        </div>
      </div>

      {/* Filters */}
      <TransactionFilters
        month={month}
        year={year}
        category={category}
        type={type}
        search={search}
        bank={bankFilter}
        banks={banks}
        categories={allCategories}
        onMonthChange={setMonth}
        onYearChange={setYear}
        onCategoryChange={setCategory}
        onTypeChange={setType}
        onSearchChange={setSearch}
        onBankChange={setBankFilter}
        onReset={handleReset}
      />

      {/* Resumo do período filtrado */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="text-base font-semibold text-emerald-600">{formatCurrency(summary.entradas)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="text-base font-semibold text-destructive">{formatCurrency(summary.saidas)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`text-base font-semibold ${summary.entradas - summary.saidas >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {formatCurrency(summary.entradas - summary.saidas)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Investido</p>
              <p className="text-base font-semibold">{formatCurrency(summary.investido)}</p>
            </div>
          </div>
          {(summary.transfer > 0 || summary.faturas > 0) && (
            <p className="text-xs text-muted-foreground">
              {summary.transfer > 0 && (<>Transferências entre contas: <strong>{formatCurrency(summary.transfer)}</strong> (movimentação interna, não entra em Entradas/Saídas). </>)}
              {summary.faturas > 0 && (<>Pg. Fatura: <strong>{formatCurrency(summary.faturas)}</strong>.</>)}
            </p>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : filtersActive && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="font-medium">Nenhuma transação com esses filtros</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente ajustar a busca ou limpar os filtros.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleReset}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <>
          {bankTxs.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Transações bancárias ({bankTxs.length})
              </h2>
              <TransactionTable
                transactions={bankTxs}
                onEdit={handleEdit}
                onDeleted={fetchTransactions}
                banks={banks}
                creditCards={creditCards}
              />
            </section>
          )}

          {cardTxs.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Cartão de crédito ({cardTxs.length})
              </h2>
              <TransactionTable
                transactions={cardTxs}
                onEdit={handleEdit}
                onDeleted={fetchTransactions}
                banks={banks}
                creditCards={creditCards}
              />
            </section>
          )}

          {filtered.length === 0 && (
            <TransactionTable
              transactions={[]}
              onEdit={handleEdit}
              onDeleted={fetchTransactions}
              banks={banks}
              creditCards={creditCards}
            />
          )}
        </>
      )}

      {/* Form Dialog */}
      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        transaction={editTarget}
        prefill={aiPrefill}
        onSuccess={fetchTransactions}
        customExpenseCategories={customCategories.expense}
        customIncomeCategories={customCategories.income}
        customInvestmentCategories={customCategories.investment}
        onAddCategory={handleAddCategory}
        banks={banks}
        creditCards={creditCards}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importOpen}
        pendingFile={aiImportFile}
        onOpenChange={setImportOpen}
        banks={banks}
        creditCards={creditCards}
        onSuccess={fetchTransactions}
        customCategories={[...customCategories.expense, ...customCategories.income, ...customCategories.investment]}
      />
    </div>
  )
}
