'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { EXPENSE_CATEGORY_GROUPS, INCOME_CATEGORY_GROUPS } from '@/lib/constants'
import { toError } from '@/lib/utils'
import type { Budget } from '@/lib/types'

interface BudgetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  budget?: Budget | null
  month: number
  year: number
  onSuccess: () => void
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  month,
  year,
  onSuccess,
}: BudgetFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [category, setCategory] = useState('Alimentação')
  const [amount, setAmount] = useState(0)

  const activeGroups = type === 'expense' ? EXPENSE_CATEGORY_GROUPS : INCOME_CATEGORY_GROUPS

  useEffect(() => {
    if (budget) {
      setType(budget.type === 'investment' || budget.type === 'credit_card_payment' ? 'expense' : budget.type)
      setCategory(budget.category)
      setAmount(budget.amount)
    } else {
      setType('expense')
      setCategory(EXPENSE_CATEGORY_GROUPS[0].categories[0])
      setAmount(0)
    }
  }, [budget, open])

  function handleTypeChange(newType: 'expense' | 'income') {
    const groups = newType === 'expense' ? EXPENSE_CATEGORY_GROUPS : INCOME_CATEGORY_GROUPS
    setType(newType)
    setCategory(groups[0].categories[0])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!amount || amount <= 0) {
      toast.error('Informe um valor válido.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      if (budget) {
        const { error } = await supabase
          .from('budgets')
          .update({ category, type, amount })
          .eq('id', budget.id)
        if (error) throw error
        toast.success('Orçamento atualizado!')
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { error } = await supabase.from('budgets').upsert(
          { user_id: user.id, month, year, category, type, amount },
          { onConflict: 'user_id,month,year,category' }
        )
        if (error) throw error
        toast.success('Orçamento salvo!')
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(toError(err))
      toast.error('Erro ao salvar orçamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                type === 'income'
                  ? 'border-green-500 bg-green-50 text-green-600'
                  : 'border-transparent bg-muted text-muted-foreground hover:bg-secondary'
              }`}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                type === 'expense'
                  ? 'border-red-500 bg-red-50 text-red-600'
                  : 'border-transparent bg-muted text-muted-foreground hover:bg-secondary'
              }`}
            >
              Despesa
            </button>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => { if (v) setCategory(v) }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeGroups.map((group, i) => (
                  <SelectGroup key={group.label}>
                    {i > 0 && <SelectSeparator />}
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor orçado */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor Orçado (R$)</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={type === 'income' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {budget ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
