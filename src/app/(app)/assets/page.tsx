'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AssetFormDialog } from '@/components/assets/asset-form-dialog'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/csv-export'
import { ASSET_GROUP_DEFS } from '@/lib/constants'
import type { Asset } from '@/lib/types'

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Asset | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('group_type')
      .order('created_at', { ascending: false })
    if (!error) setAssets((data ?? []) as Asset[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('assets').delete().eq('id', deleteTarget.id)
    if (error) toast.error('Erro ao excluir.')
    else { toast.success('Registro excluído.'); fetchAssets() }
    setDeleting(false)
    setDeleteTarget(null)
  }

  const goodsTotal  = assets.filter((a) => a.group_type === 'goods').reduce((s, a) => s + a.value, 0)
  const rightsTotal = assets.filter((a) => a.group_type === 'rights').reduce((s, a) => s + a.value, 0)
  const totalGeral  = goodsTotal + rightsTotal

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bens e Direitos</h1>
          <p className="text-sm text-muted-foreground">
            {assets.length} item{assets.length !== 1 ? 'ns' : ''} cadastrado{assets.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Bem / Direito
        </Button>
      </div>

      {/* KPI cards */}
      {!loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Geral',  value: totalGeral,  color: '#7c6eff', icon: null },
            { label: 'Bens',         value: goodsTotal,  color: '#fbbf24', icon: ASSET_GROUP_DEFS[0].icon },
            { label: 'Direitos',     value: rightsTotal, color: '#38f9d7', icon: ASSET_GROUP_DEFS[1].icon },
          ].map(({ label, value, color, icon: Icon }) => (
            <div
              key={label}
              className="relative overflow-hidden rounded-xl border border-border bg-card px-5 pb-5 pt-5"
            >
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full opacity-[0.12] blur-2xl"
                style={{ background: color }}
              />
              {Icon && (
                <div
                  className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: color + '22', color }}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
              )}
              {!Icon && (
                <div
                  className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold"
                  style={{ background: color + '22', color }}
                >
                  Σ
                </div>
              )}
              <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </p>
              <p className="text-[1.75rem] font-bold leading-none tabular-nums" style={{ color }}>
                {formatCurrency(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Group sections */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-5">
          {ASSET_GROUP_DEFS.map((group) => {
            const groupAssets = assets.filter((a) => a.group_type === group.key)
            const groupTotal  = groupAssets.reduce((s, a) => s + a.value, 0)

            return (
              <Card key={group.key} className="shadow-sm">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="flex items-center gap-3 text-base font-semibold">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: group.color + '22', color: group.color }}
                    >
                      <group.icon className="h-4 w-4" />
                    </span>
                    {group.label}
                    <span className="ml-auto text-sm font-normal" style={{ color: group.color }}>
                      {formatCurrency(groupTotal)}
                    </span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="px-4 pb-4">
                  {groupAssets.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Nenhum {group.key === 'goods' ? 'bem' : 'direito'} cadastrado.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {groupAssets.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 py-3">
                          {/* Category + description */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                                style={{ background: group.color + '20', color: group.color }}
                              >
                                {item.category}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-medium leading-snug">{item.description}</p>
                            {item.acquisition_date && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Adquirido em{' '}
                                {format(new Date(item.acquisition_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            )}
                            {item.notes && (
                              <p className="mt-0.5 text-xs text-muted-foreground italic">{item.notes}</p>
                            )}
                          </div>

                          {/* Value */}
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums" style={{ color: group.color }}>
                              {formatCurrency(item.value)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                              onClick={() => { setEditTarget(item); setDialogOpen(true) }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Form dialog */}
      <AssetFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditTarget(null) }}
        asset={editTarget}
        onSuccess={fetchAssets}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir registro</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir <strong>&quot;{deleteTarget?.description}&quot;</strong>?{' '}
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
