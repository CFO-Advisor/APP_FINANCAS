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
import { BankIcon } from '@/components/banks/bank-icon'
import { createClient } from '@/lib/supabase/client'
import { BANK_PRESETS, BANK_TYPE_LABELS } from '@/lib/constants'
import { toError } from '@/lib/utils'
import type { Bank, BankType } from '@/lib/types'

interface BankFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bank?: Bank | null
  onSuccess: () => void
}

const DEFAULT_COLOR = '#6366f1'

export function BankFormDialog({ open, onOpenChange, bank, onSuccess }: BankFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<BankType>('checking')
  const [initialBalance, setInitialBalance] = useState(0)
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [agency, setAgency] = useState('')
  const [accountNumber, setAccountNumber] = useState('')

  useEffect(() => {
    if (bank) {
      setName(bank.name)
      setType(bank.type)
      setInitialBalance(bank.initial_balance)
      setColor(bank.color)
      setAgency(bank.agency ?? '')
      setAccountNumber(bank.account_number ?? '')
    } else {
      setName('')
      setType('checking')
      setInitialBalance(0)
      setColor(DEFAULT_COLOR)
      setAgency('')
      setAccountNumber('')
    }
  }, [bank, open])

  function applyPreset(preset: typeof BANK_PRESETS[number]) {
    setName(preset.name)
    setColor(preset.color)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Informe o nome do banco.'); return }

    setLoading(true)
    const supabase = createClient()

    try {
      if (bank) {
        const { error } = await supabase
          .from('banks')
          .update({
            name: name.trim(),
            type,
            initial_balance: initialBalance,
            color,
            agency: agency.trim() || null,
            account_number: accountNumber.trim() || null,
          })
          .eq('id', bank.id)
        if (error) throw error
        toast.success('Banco atualizado!')
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        const { error } = await supabase.from('banks').insert({
          user_id: user.id,
          name: name.trim(),
          type,
          initial_balance: initialBalance,
          color,
          agency: agency.trim() || null,
          account_number: accountNumber.trim() || null,
        })
        if (error) throw error
        toast.success('Banco adicionado!')
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(toError(err))
      toast.error('Erro ao salvar banco.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bank ? 'Editar Banco' : 'Novo Banco'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Presets grid */}
          {!bank && (
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">Selecione ou personalize</Label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {BANK_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    title={preset.name}
                    onClick={() => applyPreset(preset)}
                    className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-all hover:bg-accent ${
                      name === preset.name ? 'ring-2 ring-primary ring-offset-1' : ''
                    }`}
                  >
                    <BankIcon name={preset.name} color={preset.color} size="sm" />
                    <span className="w-full truncate text-center text-[9px] text-muted-foreground">
                      {preset.initials}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name + color row */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="bank-name">Nome</Label>
              <Input
                id="bank-name"
                placeholder="Ex: Nubank, Itaú..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-color">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  id="bank-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                />
                <BankIcon name={name || '?'} color={color} size="sm" />
              </div>
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Tipo de conta</Label>
            <Select value={type} onValueChange={(v) => { if (v) setType(v as BankType) }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BANK_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agency + Account number */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="agency">Agência</Label>
              <Input
                id="agency"
                placeholder="Ex: 0001"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-number">Conta</Label>
              <Input
                id="account-number"
                placeholder="Ex: 12345-6"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                maxLength={20}
              />
            </div>
          </div>

          {/* Initial balance */}
          <div className="space-y-1.5">
            <Label htmlFor="initial-balance">Saldo inicial (R$)</Label>
            <Input
              id="initial-balance"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={initialBalance || ''}
              onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Para cartão de crédito, informe o valor da fatura atual como negativo.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {bank ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
