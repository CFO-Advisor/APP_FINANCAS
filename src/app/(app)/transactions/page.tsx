'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { TransactionFormDialog } from '@/components/transactions/transaction-form-dialog'
import { TransactionTable } from '@/components/transactions/transaction-table'
import { createClient } from '@/lib/supabase/client'
import { exportToCSV } from '@/lib/csv-export'
import type { Transaction } from '@/lib/types'

const now = new Date()

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)

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
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <TransactionTable
          transactions={filtered}
          onEdit={handleEdit}
          onDeleted={fetchTransactions}
        />
      )}

      {/* Form Dialog */}
      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        transaction={editTarget}
        onSuccess={fetchTransactions}
      />
    </div>
  )
}
