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
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { DEBT_GROUP_DEFS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Debt, DebtGroupType, DebtStatus } from '@/lib/types'

interface DebtFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  debt: Debt | null
  onSuccess: () => void
}

const STATUS_OPTIONS: { value: DebtStatus; label: string }[] = [
  { value: 'active',  label: 'Ativo'   },
  { value: 'overdue', label: 'Vencido' },
  { value: 'paid',    label: 'Pago'    },
]

const emptyForm = {
  group_type: 'loans' as DebtGroupType,
  category: '',
  description: '',
  total_amount: '',
  monthly_amount: '',
  installments_total: '',
  installments_paid: '',
  due_day: '',
  start_date: '',
  status: 'active' as DebtStatus,
  notes: '',
}

export function DebtFormDialog({ open, onOpenChange, debt, onSuccess }: DebtFormDialogProps) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (debt) {
      setForm({
        group_type: debt.group_type,
        category: debt.category,
        description: debt.description,
        total_amount: String(debt.total_amount),
        monthly_amount: String(debt.monthly_amount),
        installments_total: debt.installments_total != null ? String(debt.installments_total) : '',
        installments_paid:  debt.installments_paid  != null ? String(debt.installments_paid)  : '',
        due_day:    debt.due_day   != null ? String(debt.due_day)   : '',
        start_date: debt.start_date ?? '',
        status: debt.status,
        notes:  debt.notes ?? '',
      })
    } else {
      setForm({ ...emptyForm, category: DEBT_GROUP_DEFS[0].categories[0] })
    }
  }, [open, debt])

  const groupDef = DEBT_GROUP_DEFS.find((g) => g.key === form.group_type)!

  function handleGroupChange(key: DebtGroupType) {
    const def = DEBT_GROUP_DEFS.find((g) => g.key === key)!
    setForm((f) => ({ ...f, group_type: key, category: def.categories[0] }))
  }

  async function handleSubmit() {
    if (!form.description.trim()) { toast.error('Informe a descrição.'); return }
    if (!form.category)           { toast.error('Selecione uma categoria.'); return }
    if (!form.monthly_amount || isNaN(Number(form.monthly_amount))) {
      toast.error('Informe o valor mensal.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const payload = {
      group_type:         form.group_type,
      category:           form.category,
      description:        form.description.trim(),
      total_amount:       Number(form.total_amount)       || 0,
      monthly_amount:     Number(form.monthly_amount)     || 0,
      installments_total: form.installments_total ? Number(form.installments_total) : null,
      installments_paid:  form.installments_paid  ? Number(form.installments_paid)  : null,
      due_day:            form.due_day   ? Number(form.due_day)   : null,
      start_date:         form.start_date || null,
      status:             form.status,
      notes:              form.notes.trim() || null,
    }

    const { error } = debt
      ? await supabase.from('debts').update(payload).eq('id', debt.id)
      : await supabase.from('debts').insert(payload)

    if (error) {
      toast.error('Erro ao salvar.')
      console.error(error)
    } else {
      toast.success(debt ? 'Dívida atualizada.' : 'Dívida adicionada.')
      onSuccess()
      onOpenChange(false)
    }
    setSaving(false)
  }

  const isLoan = form.group_type === 'loans'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{debt ? 'Editar' : 'Nova'} Dívida / Conta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Group selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Grupo *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DEBT_GROUP_DEFS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => handleGroupChange(g.key)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-all',
                    form.group_type === g.key
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                  style={form.group_type === g.key ? { background: g.color } : undefined}
                >
                  <g.icon className="h-4 w-4" />
                  <span className="text-center leading-tight">{g.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Categoria *
            </label>
            <Select value={form.category} onValueChange={(v) => { if (v) setForm((f) => ({ ...f, category: v })) }}>
              <SelectTrigger>
                <span className="flex flex-1 text-left text-sm">{form.category || 'Selecione'}</span>
              </SelectTrigger>
              <SelectContent>
                {groupDef.categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Descrição *
            </label>
            <Input
              placeholder={
                isLoan
                  ? 'Ex: Financiamento Carro Honda'
                  : form.group_type === 'bills'
                  ? 'Ex: Aluguel Apartamento Centro'
                  : 'Ex: Pensão alimentícia'
              }
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Amount fields */}
          <div className="grid grid-cols-2 gap-3">
            {isLoan && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Valor Total da Dívida
                </label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0,00"
                  value={form.total_amount}
                  onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isLoan ? 'Parcela Mensal *' : 'Valor Mensal *'}
              </label>
              <Input
                type="number" min="0" step="0.01" placeholder="0,00"
                value={form.monthly_amount}
                onChange={(e) => setForm((f) => ({ ...f, monthly_amount: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dia de Vencimento
              </label>
              <Input
                type="number" min="1" max="31" placeholder="Ex: 10"
                value={form.due_day}
                onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))}
              />
            </div>

            {isLoan && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total de Parcelas
                  </label>
                  <Input
                    type="number" min="1" placeholder="Ex: 60"
                    value={form.installments_total}
                    onChange={(e) => setForm((f) => ({ ...f, installments_total: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Parcelas Pagas
                  </label>
                  <Input
                    type="number" min="0" placeholder="Ex: 12"
                    value={form.installments_paid}
                    onChange={(e) => setForm((f) => ({ ...f, installments_paid: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Data de Início
                  </label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as DebtStatus }))}>
              <SelectTrigger>
                <span className="flex flex-1 text-left text-sm">
                  {STATUS_OPTIONS.find((s) => s.value === form.status)?.label}
                </span>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Observações
            </label>
            <Input
              placeholder="Opcional..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : debt ? 'Salvar Alterações' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
