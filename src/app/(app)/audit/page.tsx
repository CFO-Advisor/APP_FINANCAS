'use client'

import { useEffect, useState, useCallback } from 'react'
import { ScrollText, RefreshCw, Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { getActiveOwnerId } from '@/lib/active-owner'

const TABLE_LABELS: Record<string, string> = {
  transactions: 'Transação',
  banks: 'Banco/Conta',
  credit_cards: 'Cartão',
  debts: 'Dívida',
  assets: 'Bem/Direito',
  budgets: 'Orçamento',
  investment_settings: 'Config. Investimento',
}

const ACTION_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  INSERT: { label: 'Criação', variant: 'default' },
  UPDATE: { label: 'Alteração', variant: 'secondary' },
  DELETE: { label: 'Exclusão', variant: 'destructive' },
}

interface AuditEvent {
  id: string
  table_name: string
  record_id: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  actor_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  at: string
}

// Campos exibidos no diff (por tabela), com rótulos amigáveis
const DIFF_FIELDS: Record<string, [string, string][]> = {
  transactions: [
    ['description', 'Descrição'], ['amount', 'Valor'], ['date', 'Data'],
    ['type', 'Tipo'], ['category', 'Categoria'], ['bank_id', 'Conta'],
  ],
  banks: [['name', 'Nome'], ['type', 'Tipo'], ['initial_balance', 'Saldo inicial']],
  credit_cards: [['name', 'Nome'], ['credit_limit', 'Limite'], ['due_day', 'Dia venc.']],
  debts: [['description', 'Descrição'], ['amount', 'Valor'], ['status', 'Status']],
  assets: [['description', 'Descrição'], ['value', 'Valor']],
  budgets: [['category', 'Categoria'], ['amount', 'Valor']],
  investment_settings: [['group_key', 'Grupo'], ['initial_balance', 'Saldo inicial']],
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [names, setNames] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const ownerId = await getActiveOwnerId()
      let q = supabase
        .from('audit_log')
        .select('id,table_name,record_id,action,actor_id,old_data,new_data,at')
        .eq('user_id', ownerId)
        .order('at', { ascending: false })
        .limit(200)
      if (tableFilter !== 'all') q = q.eq('table_name', tableFilter)
      if (actionFilter !== 'all') q = q.eq('action', actionFilter)
      const { data, error } = await q
      if (error) throw error
      setEvents(data ?? [])

      // resolve nomes dos autores
      const ids = [...new Set((data ?? []).map((e) => e.actor_id).filter(Boolean) as string[])]
      if (ids.length > 0) {
        const res = await fetch('/api/users/lookup', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        if (res.ok) {
          const body = await res.json()
          const map: Record<string, string> = {}
          for (const [id, email] of Object.entries(body.emails ?? {})) {
            map[id] = String(email).split('@')[0].replace(/[._-]+/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())
          }
          setNames(map)
        }
      }
    } catch {
      toast.error('Erro ao carregar o histórico.')
    } finally {
      setLoading(false)
    }
  }, [tableFilter, actionFilter])

  useEffect(() => { void load() }, [load])

  function renderDiff(e: AuditEvent): string | null {
    const fields = DIFF_FIELDS[e.table_name]
    if (!fields) return null
    const parts: string[] = []
    for (const [key, label] of fields) {
      const oldV = e.old_data?.[key]
      const newV = e.new_data?.[key]
      if (e.action === 'INSERT' && newV != null && newV !== '') {
        parts.push(`${label}: ${String(newV)}`)
      } else if (e.action === 'UPDATE' && String(oldV) !== String(newV)) {
        parts.push(`${label}: ${oldV ?? '—'} → ${newV ?? '—'}`)
      } else if (e.action === 'DELETE' && oldV != null) {
        parts.push(`${label}: ${String(oldV)}`)
      }
    }
    return parts.length > 0 ? parts.slice(0, 4).join(' · ') : null
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ScrollText className="h-6 w-6" />
            Histórico de alterações
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro completo e inviolável: quem criou, alterou ou excluiu cada registro — com valores antes e depois.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={tableFilter} onValueChange={(v) => v && setTableFilter(v)}>
          <SelectTrigger className="h-9 w-[190px] text-xs"><SelectValue placeholder="Tudo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os dados</SelectItem>
            {Object.entries(TABLE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => v && setActionFilter(v)}>
          <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Tudo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todas as ações</SelectItem>
            <SelectItem value="INSERT" className="text-xs">Criações</SelectItem>
            <SelectItem value="UPDATE" className="text-xs">Alterações</SelectItem>
            <SelectItem value="DELETE" className="text-xs">Exclusões</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos (últimos 200)</CardTitle>
          <CardDescription>Ordenados do mais recente para o mais antigo.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum evento registrado ainda com esses filtros.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e) => {
                const meta = ACTION_META[e.action]
                const diff = renderDiff(e)
                return (
                  <li key={e.id} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 shrink-0">
                      {e.action === 'INSERT' && <Plus className="h-4 w-4 text-primary" />}
                      {e.action === 'UPDATE' && <Pencil className="h-4 w-4 text-muted-foreground" />}
                      {e.action === 'DELETE' && <Trash2 className="h-4 w-4 text-destructive" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{TABLE_LABELS[e.table_name] ?? e.table_name}</span>
                        <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          por <strong>{e.actor_id ? (names[e.actor_id] ?? 'usuário') : 'sistema'}</strong>
                        </span>
                      </p>
                      {diff && <p className="mt-0.5 text-xs text-muted-foreground">{diff}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        {new Date(e.at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
