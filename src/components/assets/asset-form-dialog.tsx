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
import { ASSET_GROUP_DEFS } from '@/lib/constants'
import { toError } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Asset, AssetGroupType } from '@/lib/types'

interface AssetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: Asset | null
  onSuccess: () => void
}

const emptyForm = {
  group_type: 'goods' as AssetGroupType,
  category: '',
  description: '',
  value: '',
  acquisition_date: '',
  notes: '',
}

export function AssetFormDialog({ open, onOpenChange, asset, onSuccess }: AssetFormDialogProps) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (asset) {
      setForm({
        group_type:       asset.group_type,
        category:         asset.category,
        description:      asset.description,
        value:            String(asset.value),
        acquisition_date: asset.acquisition_date ?? '',
        notes:            asset.notes ?? '',
      })
    } else {
      setForm({ ...emptyForm, category: ASSET_GROUP_DEFS[0].categories[0] })
    }
  }, [open, asset])

  const groupDef = ASSET_GROUP_DEFS.find((g) => g.key === form.group_type)!

  function handleGroupChange(key: AssetGroupType) {
    const def = ASSET_GROUP_DEFS.find((g) => g.key === key)!
    setForm((f) => ({ ...f, group_type: key, category: def.categories[0] }))
  }

  async function handleSubmit() {
    if (!form.description.trim()) { toast.error('Informe a descrição.'); return }
    if (!form.category)           { toast.error('Selecione uma categoria.'); return }
    if (!form.value || isNaN(Number(form.value)) || Number(form.value) < 0) {
      toast.error('Informe um valor válido.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const basePayload = {
      group_type:       form.group_type,
      category:         form.category,
      description:      form.description.trim(),
      value:            Number(form.value),
      acquisition_date: form.acquisition_date || null,
      notes:            form.notes.trim() || null,
    }

    try {
      if (asset) {
        const { error } = await supabase.from('assets').update(basePayload).eq('id', asset.id)
        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Usuário não autenticado.')
        const { error } = await supabase.from('assets').insert({ ...basePayload, user_id: user.id })
        if (error) throw error
      }
      toast.success(asset ? 'Bem/Direito atualizado.' : 'Bem/Direito adicionado.')
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(toError(err))
      toast.error('Erro ao salvar. Verifique os dados e tente novamente.')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{asset ? 'Editar' : 'Novo'} Bem / Direito</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Group selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Grupo *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ASSET_GROUP_DEFS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => handleGroupChange(g.key)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium transition-all',
                    form.group_type === g.key
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                  style={form.group_type === g.key ? { background: g.color + 'cc' } : undefined}
                >
                  <g.icon className="h-4 w-4 shrink-0" />
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Categoria *
            </label>
            <Select
              value={form.category}
              onValueChange={(v) => { if (v) setForm((f) => ({ ...f, category: v })) }}
            >
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
                form.group_type === 'goods'
                  ? 'Ex: Apartamento Rua das Flores, 302'
                  : 'Ex: FGTS empresa atual'
              }
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Value + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Valor Declarado (R$) *
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data de Aquisição
              </label>
              <Input
                type="date"
                value={form.acquisition_date}
                onChange={(e) => setForm((f) => ({ ...f, acquisition_date: e.target.value }))}
              />
            </div>
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
            {saving ? 'Salvando...' : asset ? 'Salvar Alterações' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
