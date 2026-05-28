'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Banknote, BarChart2, Building2, Coins, Package, Wallet, Pencil, Loader2, type LucideIcon } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { MONTHS, CATEGORY_COLORS } from '@/lib/constants'
import { formatCurrency } from '@/lib/csv-export'
import { toError } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

interface GroupDef {
  label: string
  color: string
  icon: LucideIcon
  categories: string[]
}

const INVESTMENT_GROUP_DEFS: GroupDef[] = [
  {
    label: 'Aplicações Financeiras',
    color: '#43e97b',
    icon: Banknote,
    categories: ['Tesouro Direto', 'CDB', 'LCI/LCA', 'Poupança', 'Debêntures', 'Fundo RF'],
  },
  {
    label: 'Ações e FIIs',
    color: '#6c63ff',
    icon: BarChart2,
    categories: ['Ações', 'FIIs', 'ETFs', 'BDRs', 'Opções', 'Fundo Ações'],
  },
  {
    label: 'Imóveis',
    color: '#f7971e',
    icon: Building2,
    categories: ['Imóvel Residencial', 'Imóvel Comercial', 'Terreno', 'Reforma/Benfeitorias'],
  },
  {
    label: 'Cripto',
    color: '#fbbf24',
    icon: Coins,
    categories: ['Bitcoin', 'Ethereum', 'Altcoins', 'Stablecoins', 'DeFi'],
  },
  {
    label: 'Outros',
    color: '#38f9d7',
    icon: Package,
    categories: ['Previdência Privada', 'COE', 'Ouro', 'Câmbio', 'Consórcio', 'Startup/Equity'],
  },
]

export default function InvestmentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [initialBalances, setInitialBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(currentYear)

  // Initial balance edit dialog
  const [editingGroup, setEditingGroup] = useState<GroupDef | null>(null)
  const [editValue, setEditValue] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  const selectedMonthLabel = MONTHS.find((m) => m.value === month)?.label ?? ''

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    const [txRes, settingsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('type', 'investment')
        .lte('date', endDate),
      supabase.from('investment_settings').select('*'),
    ])

    setTransactions((txRes.data as Transaction[]) ?? [])

    const balMap: Record<string, number> = {}
    for (const s of (settingsRes.data ?? []) as { group_key: string; initial_balance: number }[]) {
      balMap[s.group_key] = s.initial_balance
    }
    setInitialBalances(balMap)
    setLoading(false)
  }, [month, year])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function openEdit(group: GroupDef) {
    setEditingGroup(group)
    setEditValue(initialBalances[group.label] ?? 0)
  }

  async function handleSaveInitialBalance() {
    if (!editingGroup) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('investment_settings').upsert(
        { user_id: user.id, group_key: editingGroup.label, initial_balance: editValue },
        { onConflict: 'user_id,group_key' }
      )
      if (error) throw error

      setInitialBalances((prev) => ({ ...prev, [editingGroup.label]: editValue }))
      toast.success('Saldo inicial salvo.')
      setEditingGroup(null)
    } catch (err) {
      console.error(toError(err))
      toast.error('Erro ao salvar saldo inicial.')
    } finally {
      setSaving(false)
    }
  }

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    }
    return map
  }, [transactions])

  const groupTotals = useMemo(
    () =>
      INVESTMENT_GROUP_DEFS.map((g) => {
        const txTotal = g.categories.reduce((sum, cat) => sum + (categoryTotals[cat] ?? 0), 0)
        const initial = initialBalances[g.label] ?? 0
        return { ...g, txTotal, initial, total: txTotal + initial }
      }),
    [categoryTotals, initialBalances]
  )

  const grandTotal = useMemo(
    () => groupTotals.reduce((sum, g) => sum + g.total, 0),
    [groupTotals]
  )
  const grandInitial = useMemo(
    () => groupTotals.reduce((sum, g) => sum + g.initial, 0),
    [groupTotals]
  )
  const grandTx = useMemo(
    () => groupTotals.reduce((sum, g) => sum + g.txTotal, 0),
    [groupTotals]
  )

  const donutData = useMemo(
    () =>
      groupTotals
        .filter((g) => g.total > 0)
        .map((g) => ({ name: g.label, value: g.total, color: g.color })),
    [groupTotals]
  )

  const categoryBreakdown = useMemo(
    () =>
      Object.entries(categoryTotals)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] ?? '#8892a4' })),
    [categoryTotals]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investimentos</h1>
          <p className="text-sm text-muted-foreground">
            Acumulado até {selectedMonthLabel} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => { if (v) setMonth(Number(v)) }}>
            <SelectTrigger className="w-36 bg-card">
              <span className="flex flex-1 text-left text-sm">{selectedMonthLabel}</span>
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => { if (v) setYear(Number(v)) }}>
            <SelectTrigger className="w-24 bg-card">
              <span className="flex flex-1 text-left text-sm">{year}</span>
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-lg border bg-card shadow-sm" />
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg border bg-card shadow-sm" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Total investido — card de destaque */}
          <Card className="relative overflow-hidden border-border shadow-sm">
            <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: '#a78bfa' }} />
            <Wallet
              className="absolute right-6 top-1/2 -translate-y-1/2 h-14 w-14 opacity-[0.07]"
              style={{ color: '#a78bfa' }}
            />
            <CardContent className="px-6 py-5">
              <p className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Total Investido
              </p>
              <p className="text-[2rem] font-bold leading-none" style={{ color: '#a78bfa' }}>
                {formatCurrency(grandTotal)}
              </p>
              {grandTotal > 0 && (
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  {grandInitial > 0 && (
                    <span>Saldo inicial: <span className="font-medium text-foreground">{formatCurrency(grandInitial)}</span></span>
                  )}
                  {grandTx > 0 && (
                    <span>Transações: <span className="font-medium text-foreground">{formatCurrency(grandTx)}</span></span>
                  )}
                </div>
              )}
              {grandTotal === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum investimento registrado. Adicione transações do tipo Investimento ou configure os saldos iniciais nos grupos abaixo.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cards por grupo */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {groupTotals.map((g) => {
              const pct = grandTotal > 0 ? (g.total / grandTotal) * 100 : 0
              return (
                <Card key={g.label} className="relative overflow-hidden border-border shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: g.color }} />
                  <g.icon
                    className="absolute right-3 top-4 h-7 w-7 opacity-[0.12]"
                    style={{ color: g.color }}
                  />
                  <CardContent className="px-4 pb-4 pt-5">
                    <p className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground leading-tight pr-6">
                      {g.label}
                    </p>
                    <p className="text-lg font-bold leading-none" style={{ color: g.color }}>
                      {formatCurrency(g.total)}
                    </p>
                    {grandTotal > 0 && (
                      <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                        {pct.toFixed(1)}% do total
                      </p>
                    )}
                    {g.initial > 0 && (
                      <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                        Inicial: {formatCurrency(g.initial)}
                      </p>
                    )}
                    <button
                      onClick={() => openEdit(g)}
                      className="mt-2 flex items-center gap-1 text-[0.68rem] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      Saldo inicial
                    </button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Gráfico + detalhamento */}
          {grandTotal > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Donut — distribuição por grupo */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2 pt-5">
                  <CardTitle className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Distribuição por Grupo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={72}
                        outerRadius={105}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {donutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]
                          return (
                            <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
                              <p className="text-xs text-muted-foreground">{d.name}</p>
                              <p className="font-semibold" style={{ color: (d.payload as { color: string }).color }}>
                                {formatCurrency(d.value as number)}
                              </p>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-1 flex flex-col gap-2">
                    {donutData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: d.color }}
                          />
                          <span className="text-muted-foreground">{d.name}</span>
                        </span>
                        <span className="font-semibold tabular-nums" style={{ color: d.color }}>
                          {formatCurrency(d.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Detalhamento por categoria (transações) */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2 pt-5">
                  <CardTitle className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Detalhamento por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma transação de investimento registrada até este período.
                    </p>
                  ) : (
                    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                      {categoryBreakdown.map((cat) => {
                        const pct = grandTx > 0 ? (cat.value / grandTx) * 100 : 0
                        return (
                          <div key={cat.name}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: cat.color }}
                                />
                                <span className="text-foreground">{cat.name}</span>
                              </span>
                              <span className="font-semibold tabular-nums" style={{ color: cat.color }}>
                                {formatCurrency(cat.value)}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: cat.color }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Dialog — editar saldo inicial */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => { if (!open) setEditingGroup(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Saldo Inicial</DialogTitle>
          </DialogHeader>
          {editingGroup && (
            <>
              <p className="text-sm text-muted-foreground">
                Informe o valor já investido em{' '}
                <strong style={{ color: editingGroup.color }}>{editingGroup.label}</strong>{' '}
                antes de começar a usar o app. Será somado às suas transações.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="initial-balance">Valor (R$)</Label>
                <Input
                  id="initial-balance"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={editValue || ''}
                  onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveInitialBalance() }}
                  autoFocus
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveInitialBalance} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
