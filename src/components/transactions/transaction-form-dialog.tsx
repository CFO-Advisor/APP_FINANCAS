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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES } from '@/lib/constants'
import type { Transaction, TransactionFormData, TransactionType, Category } from '@/lib/types'
import { format } from 'date-fns'

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  onSuccess: () => void
}

const defaultForm: TransactionFormData = {
  description: '',
  amount: 0,
  date: format(new Date(), 'yyyy-MM-dd'),
  type: 'expense',
  category: 'Outros',
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: TransactionFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<TransactionFormData>(defaultForm)

  useEffect(() => {
    if (transaction) {
      setForm({
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date,
        type: transaction.type,
        category: transaction.category,
      })
    } else {
      setForm(defaultForm)
    }
  }, [transaction, open])

  function updateField<K extends keyof TransactionFormData>(
    key: K,
    value: TransactionFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.description.trim()) {
      toast.error('Informe uma descrição.')
      return
    }

    if (!form.amount || form.amount <= 0) {
      toast.error('Informe um valor válido.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      if (transaction) {
        const { error } = await supabase
          .from('transactions')
          .update({
            description: form.description.trim(),
            amount: form.amount,
            date: form.date,
            type: form.type,
            category: form.category,
          })
          .eq('id', transaction.id)

        if (error) throw error
        toast.success('Transação atualizada!')
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) throw new Error('Not authenticated')

        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          description: form.description.trim(),
          amount: form.amount,
          date: form.date,
          type: form.type,
          category: form.category,
        })

        if (error) throw error
        toast.success('Transação adicionada!')
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar transação.')
    } finally {
      setLoading(false)
    }
  }

  const isEditing = !!transaction

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateField('type', 'expense')}
              className={`rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                form.type === 'expense'
                  ? 'border-red-500 bg-red-50 text-red-600'
                  : 'border-transparent bg-slate-100 text-muted-foreground hover:bg-slate-200'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => updateField('type', 'income')}
              className={`rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                form.type === 'income'
                  ? 'border-green-500 bg-green-50 text-green-600'
                  : 'border-transparent bg-slate-100 text-muted-foreground hover:bg-slate-200'
              }`}
            >
              Receita
            </button>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Almoço, Salário..."
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              required
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={form.amount || ''}
              onChange={(e) => updateField('amount', parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => updateField('date', e.target.value)}
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(v) => { if (v !== null) updateField('category', v as Category) }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={form.type === 'income' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
