'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { EXPENSE_CATEGORY_GROUPS } from '@/lib/constants'
import { toError } from '@/lib/utils'
import { format } from 'date-fns'
import type { CreditCard } from '@/lib/types'

interface CardChargeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: CreditCard
  onSuccess: () => void
}

export function CardChargeFormDialog({ open, onOpenChange, card, onSuccess }: CardChargeFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORY_GROUPS[0].categories[0])
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    if (!open) return
    setDescription('')
    setAmount('')
    setCategory(EXPENSE_CATEGORY_GROUPS[0].categories[0])
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { toast.error('Informe a descrição.'); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Informe um valor válido.'); return }

    setLoading(true)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        description: description.trim(),
        amount: amt,
        date,
        type: 'expense',
        category,
        credit_card_id: card.id,
        bank_id: null,
        status: 'pending',
      })

      if (error) throw error
      toast.success(`Lançado no ${card.name} — aguardando pagamento da fatura.`)
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(toError(err))
      toast.error('Erro ao salvar lançamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar no {card.name}</DialogTitle>
        </DialogHeader>

        <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          Este lançamento ficará <strong>pendente</strong> até o pagamento da fatura.
          Só então aparecerá nas categorias do Dashboard.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Descrição *
            </label>
            <Input
              placeholder="Ex: Restaurante, Uber, Compra online..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Valor (R$) *
              </label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Categoria *
            </label>
            <Select value={category} onValueChange={(v) => { if (v) setCategory(v) }}>
              <SelectTrigger>
                <span className="flex flex-1 text-left text-sm">{category}</span>
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {EXPENSE_CATEGORY_GROUPS.map((g, i) => (
                  <SelectGroup key={g.label}>
                    {i > 0 && <SelectSeparator />}
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Lançar no Cartão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
