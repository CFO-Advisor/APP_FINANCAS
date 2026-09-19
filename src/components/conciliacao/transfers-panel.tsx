'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, ArrowRight, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { getActiveOwnerId } from '@/lib/active-owner'
import { formatCurrency } from '@/lib/csv-export'
import { findTransferCandidates, suggestTransferPairs, type TransferRow } from '@/lib/transfers'
import type { Bank } from '@/lib/types'

interface PendingRow extends TransferRow {
  description: string
}

export function TransfersPanel() {
  const [rows, setRows] = useState<PendingRow[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [choices, setChoices] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const ownerId = await getActiveOwnerId()
      const [txRes, banksRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id,date,amount,description,bank_id,transfer_bank_id,transfer_dir')
          .eq('user_id', ownerId)
          .eq('type', 'transfer')
          .order('date', { ascending: false }),
        supabase.from('banks').select('*').eq('user_id', ownerId).order('name'),
      ])
      if (txRes.error) throw txRes.error
      setRows((txRes.data ?? []) as PendingRow[])
      setBanks((banksRes.data ?? []) as Bank[])
    } catch {
      toast.error('Não foi possível carregar as transferências.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const bankName = (id: string | null) => (id ? banks.find((b) => b.id === id)?.name ?? '—' : '—')
  // Pendente = ainda sem a contrapartida identificada
  const pending = rows.filter((r) => r.transfer_bank_id === null && r.bank_id)
  const linked = rows.length - pending.length

  async function link(left: PendingRow, right: PendingRow) {
    const supabase = createClient()
    const ownerId = await getActiveOwnerId()
    // O vínculo é só reconhecimento: aponta cada lado para a conta do outro.
    // Não mexe em saldo (a contrapartida é metadado).
    const [a, b] = await Promise.all([
      supabase.from('transactions').update({ transfer_bank_id: right.bank_id }).eq('user_id', ownerId).eq('id', left.id),
      supabase.from('transactions').update({ transfer_bank_id: left.bank_id }).eq('user_id', ownerId).eq('id', right.id),
    ])
    if (a.error || b.error) throw a.error ?? b.error
  }

  async function linkOne(row: PendingRow, counterpartId: string) {
    const counterpart = rows.find((r) => r.id === counterpartId)
    if (!counterpart) return
    setBusy(true)
    try {
      await link(row, counterpart)
      toast.success('Transferência conciliada.')
      await load()
    } catch {
      toast.error('Falha ao conciliar. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function linkAllSuggestions() {
    const suggestions = suggestTransferPairs(pending)
    if (suggestions.length === 0) {
      toast.info('Nenhum par inequívoco encontrado — os casos abaixo precisam da sua decisão.')
      return
    }
    setBusy(true)
    try {
      for (const { left, right } of suggestions) {
        await link(left as PendingRow, right as PendingRow)
      }
      toast.success(`${suggestions.length} transferência(s) conciliada(s) automaticamente.`)
      await load()
    } catch {
      toast.error('Alguma conciliação falhou. Recarregue e tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          Transferências: <span className="font-semibold text-foreground">{rows.length}</span>
        </span>
        <span className="text-muted-foreground">
          Sem par: <span className="font-semibold text-destructive">{pending.length}</span>
        </span>
        <span className="text-muted-foreground">
          Já conciliadas: <span className="font-semibold text-emerald-600">{linked}</span>
        </span>
        <Button size="sm" variant="outline" className="ml-auto gap-1.5 text-xs" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        {pending.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={linkAllSuggestions} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Conciliar pares inequívocos
          </Button>
        )}
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              Nenhuma transferência pendente. Todos os lados já têm par reconhecido.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lados sem par ({pending.length})</CardTitle>
            <CardDescription>
              Cada linha é um lançamento que ainda não foi ligado ao lado correspondente no extrato da outra conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((row) => {
              const candidates = findTransferCandidates(row, rows)
              const auto = candidates.length === 1 ? candidates[0] : null
              const chosenId = choices[row.id] ?? auto?.id ?? ''
              const chosen = candidates.find((c) => c.id === chosenId) ?? null
              const dirIn = row.transfer_dir === 'in'
              return (
                <div key={row.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {new Date(row.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">{formatCurrency(row.amount)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {dirIn ? 'entrou em' : 'saiu de'} {bankName(row.bank_id)}
                    </span>
                    <span className="max-w-[240px] truncate text-xs text-muted-foreground/80">{row.description}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {candidates.length === 0 ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Sem par encontrado — o extrato da outra conta já foi importado?
                      </span>
                    ) : (
                      <>
                        <Select value={chosenId} onValueChange={(v) => v && setChoices((prev) => ({ ...prev, [row.id]: v }))}>
                          <SelectTrigger className="h-8 w-[320px] text-xs">
                            <span className="flex flex-1 truncate text-left text-xs">
                              {chosen
                                ? `${bankName(chosen.bank_id)} · ${chosen.transfer_dir === 'in' ? 'entrou' : 'saiu'} ${new Date(chosen.date + 'T00:00:00').toLocaleDateString('pt-BR')} · ${formatCurrency(chosen.amount)}`
                                : '— escolher contrapartida'}
                            </span>
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {candidates.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {bankName(c.bank_id)} · {c.transfer_dir === 'in' ? 'entrou' : 'saiu'}{' '}
                                {new Date(c.date + 'T00:00:00').toLocaleDateString('pt-BR')} · {formatCurrency(c.amount)}
                                {c.transfer_bank_id && c.transfer_bank_id !== row.bank_id ? ' (já vinculada)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          disabled={busy || !chosen}
                          onClick={() => chosen && void linkOne(row, chosen.id)}
                        >
                          Conciliar <ArrowRight className="h-3 w-3" />
                        </Button>
                        {auto && (
                          <span className="text-[0.7rem] text-emerald-600">par inequívoco sugerido</span>
                        )}
                        {candidates.length > 1 && (
                          <span className="text-[0.7rem] text-muted-foreground">
                            {candidates.length} candidatos — escolha qual é o par
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </>
  )
}
