'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, FileDown, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { TransactionFormDialog } from '@/components/transactions/transaction-form-dialog'
import { TransactionTable } from '@/components/transactions/transaction-table'
import { ImportDialog } from '@/components/import/import-dialog'
import { createClient } from '@/lib/supabase/client'
import { exportToCSV } from '@/lib/csv-export'
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

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

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

    if (!txRes.error && txRes.data) setTransactions(txRes.data as Transaction[])
    if (!banksRes.error && banksRes.data) setBanks(banksRes.data as Bank[])
    if (!cardsRes.error && cardsRes.data) setCreditCards(cardsRes.data as CreditCard[])
    setLoading(false)
  }, [month, year])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (category !== 'all' && t.category !== category) return false
      if (type !== 'all' && t.type !== type) return false
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [transactions, category, type, search])

  function handleEdit(transaction: Transaction) {
    setEditTarget(transaction)
    setDialogOpen(true)
  }

  function handleAdd() {
    setEditTarget(null)
    setDialogOpen(true)
  }

  function handleDialogClose(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditTarget(null)
  }

  function handleReset() {
    setCategory('all')
    setType('all')
    setSearch('')
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
        categories={allCategories}
        onMonthChange={setMonth}
        onYearChange={setYear}
        onCategoryChange={setCategory}
        onTypeChange={setType}
        onSearchChange={setSearch}
        onReset={handleReset}
      />

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#6c63ff' }} />
        </div>
      ) : (
        <TransactionTable
          transactions={filtered}
          onEdit={handleEdit}
          onDeleted={fetchTransactions}
          banks={banks}
          creditCards={creditCards}
        />
      )}

      {/* Form Dialog */}
      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        transaction={editTarget}
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
        onOpenChange={setImportOpen}
        banks={banks}
        creditCards={creditCards}
        onSuccess={fetchTransactions}
      />
    </div>
  )
}
