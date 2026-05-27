'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CATEGORIES, MONTHS } from '@/lib/constants'

interface TransactionFiltersProps {
  month: number
  year: number
  category: string
  type: string
  search: string
  onMonthChange: (v: number) => void
  onYearChange: (v: number) => void
  onCategoryChange: (v: string) => void
  onTypeChange: (v: string) => void
  onSearchChange: (v: string) => void
  onReset: () => void
}

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

export function TransactionFilters({
  month,
  year,
  category,
  type,
  search,
  onMonthChange,
  onYearChange,
  onCategoryChange,
  onTypeChange,
  onSearchChange,
  onReset,
}: TransactionFiltersProps) {
  const hasActiveFilters = category !== 'all' || type !== 'all' || search !== ''

  return (
    <div className="space-y-3">
      {/* Month/Year row */}
      <div className="flex flex-wrap gap-2">
        <Select value={String(month)} onValueChange={(v) => { if (v !== null) onMonthChange(Number(v)) }}>
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

        <Select value={String(year)} onValueChange={(v) => { if (v !== null) onYearChange(Number(v)) }}>
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

      {/* Search + category + type row */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-white pl-9"
          />
        </div>

        <Select value={category} onValueChange={(v) => { if (v !== null) onCategoryChange(v) }}>
          <SelectTrigger className="w-40 bg-white">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={(v) => { if (v !== null) onTypeChange(v) }}>
          <SelectTrigger className="w-32 bg-white">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={onReset} title="Limpar filtros">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
