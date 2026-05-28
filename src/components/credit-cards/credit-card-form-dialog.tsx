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
import { CreditCardIcon } from './credit-card-icon'
import { createClient } from '@/lib/supabase/client'
import { CARD_BRAND_LABELS, CARD_BRAND_COLORS } from '@/lib/constants'
import { toError } from '@/lib/utils'
import type { CreditCard, CardBrand } from '@/lib/types'

interface CreditCardFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  card?: CreditCard | null
  onSuccess: () => void
}

const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1)

export function CreditCardFormDialog({ open, onOpenChange, card, onSuccess }: CreditCardFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [brand, setBrand] = useState<CardBrand>('outros')
  const [color, setColor] = useState('#6366f1')
  const [creditLimit, setCreditLimit] = useState(0)
  const [closingDay, setClosingDay] = useState(5)
  const [dueDay, setDueDay] = useState(15)

  useEffect(() => {
    if (card) {
      setName(card.name)
      setBrand(card.brand)
      setColor(card.color)
      setCreditLimit(card.credit_limit)
      setClosingDay(card.closing_day)
      setDueDay(card.due_day)
    } else {
      setName('')
      setBrand('outros')
      setColor('#6366f1')
      setCreditLimit(0)
      setClosingDay(5)
      setDueDay(15)
    }
  }, [card, open])

  function handleBrandChange(b: CardBrand) {
    setBrand(b)
    setColor(CARD_BRAND_COLORS[b])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Informe o nome do cartão.'); return }

    setLoading(true)
    const supabase = createClient()

    try {
      if (card) {
        const { error } = await supabase
          .from('credit_cards')
          .update({
            name: name.trim(),
            brand,
            color,
            credit_limit: creditLimit,
            closing_day: closingDay,
            due_day: dueDay,
          })
          .eq('id', card.id)
        if (error) throw error
        toast.success('Cartão atualizado!')
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        const { error } = await supabase.from('credit_cards').insert({
          user_id: user.id,
          name: name.trim(),
          brand,
          color,
          credit_limit: creditLimit,
          closing_day: closingDay,
          due_day: dueDay,
        })
        if (error) throw error
        toast.success('Cartão adicionado!')
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(toError(err))
      toast.error('Erro ao salvar cartão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{card ? 'Editar Cartão' : 'Novo Cartão de Crédito'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bandeira */}
          <div className="space-y-1.5">
            <Label>Bandeira</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(CARD_BRAND_LABELS) as [CardBrand, string][]).map(([b, label]) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => handleBrandChange(b)}
                  className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-all ${
                    brand === b ? 'border-primary bg-primary/10' : 'border-transparent bg-muted hover:bg-secondary'
                  }`}
                >
                  <CreditCardIcon brand={b} size="xs" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Nome + Cor */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="card-name">Nome do cartão</Label>
              <Input
                id="card-name"
                placeholder="Ex: Nubank Mastercard, Itaú Visa..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="card-color">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  id="card-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                />
                <CreditCardIcon brand={brand} color={color} size="sm" />
              </div>
            </div>
          </div>

          {/* Limite */}
          <div className="space-y-1.5">
            <Label htmlFor="credit-limit">Limite de crédito (R$)</Label>
            <Input
              id="credit-limit"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={creditLimit || ''}
              onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dia do fechamento</Label>
              <Select value={String(closingDay)} onValueChange={(v) => { if (v) setClosingDay(Number(v)) }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dia do vencimento</Label>
              <Select value={String(dueDay)} onValueChange={(v) => { if (v) setDueDay(Number(v)) }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Fechamento dia {closingDay} → vencimento dia {dueDay} do mês seguinte.
          </p>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {card ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
