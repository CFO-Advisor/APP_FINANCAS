'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, Wallet, ArrowLeftRight, BookOpen, Info, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/csv-export'

// ── Tipos das views ────────────────────────────────────
interface DreMes { mes: string; receitas: number; despesas: number; resultado: number }
interface DreGrupo { grupo: string; despesas: number }
interface Balanco {
  ativo_caixa: number; ativo_bens: number; total_ativo: number
  passivo_faturas: number; passivo_parcelas: number; total_passivo: number
  patrimonio_liquido: number
}
interface Fechamento {
  pl_inicial: number | null; resultado_periodo: number | null
  pl_final_calculado: number | null; pl_final_esperado: number | null; diferenca: number | null
}
interface DfcMes { mes: string; operacional: number; investimentos: number; saldo_mes: number }
interface DiarioLinha {
  data: string; descricao: string; valor: number; tipo_app: string
  natureza: string; grupo: string; categoria: string | null; documento: string
}

const NATUREZA_LABEL: Record<string, string> = {
  RECEITA: 'Entrou',
  DESPESA: 'Saiu',
  ATIVO: 'Virou patrimônio',
  PASSIVO: 'A pagar',
  NEUTRO: 'Neutro',
}

function mesLabel(m: string) {
  const [ano, mm] = m.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(mm) - 1]}/${ano.slice(2)}`
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true)
  const [dre, setDre] = useState<DreMes[]>([])
  const [grupos, setGrupos] = useState<DreGrupo[]>([])
  const [bal, setBal] = useState<Balanco | null>(null)
  const [fech, setFech] = useState<Fechamento | null>(null)
  const [dfc, setDfc] = useState<DfcMes[]>([])
  const [diario, setDiario] = useState<DiarioLinha[]>([])

  useEffect(() => {
    let ignore = false
    async function load() {
      const supabase = createClient()
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        supabase.from('v_dre_mensal').select('*').order('mes'),
        supabase.from('v_dre_por_grupo').select('*').order('despesas', { ascending: false }),
        supabase.from('v_balanco').select('*').limit(1),
        supabase.from('v_balanco_fechamento').select('*').limit(1),
        supabase.from('v_dfc_mensal').select('*').order('mes'),
        supabase.from('v_diario').select('*').order('data', { ascending: false }).limit(300),
      ])
      if (ignore) return
      setDre((r1.data ?? []) as DreMes[])
      setGrupos((r2.data ?? []) as DreGrupo[])
      setBal(((r3.data ?? []) as Balanco[])[0] ?? null)
      setFech(((r4.data ?? []) as Fechamento[])[0] ?? null)
      setDfc((r5.data ?? []) as DfcMes[])
      setDiario((r6.data ?? []) as DiarioLinha[])
      setLoading(false)
    }
    load()
    return () => { ignore = true }
  }, [])

  const totReceitas = dre.reduce((s, m) => s + Number(m.receitas), 0)
  const totDespesas = dre.reduce((s, m) => s + Number(m.despesas), 0)
  const totResultado = dre.reduce((s, m) => s + Number(m.resultado), 0)
  const totOper = dfc.reduce((s, m) => s + Number(m.operacional), 0)
  const totInv = dfc.reduce((s, m) => s + Number(m.investimentos), 0)
  const totLiq = dfc.reduce((s, m) => s + Number(m.saldo_mes), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Entrou · saiu · sobrou · tenho · devo — leitura por competência (o mês da compra)
        </p>
      </div>

      {/* Aviso de transição */}
      <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          O <strong>Dashboard</strong> ainda usa o modelo antigo — a fatura do cartão aparece como despesa
          do mês do vencimento. <strong>Estes relatórios usam o modelo de competência</strong> (a despesa
          entra no mês da compra). A unificação sai na próxima publicação.
        </p>
      </div>

      {/* ── 1. MEU RESULTADO ── */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
          </span>
          <span className="font-semibold">Meu resultado</span>
          <span className="ml-auto text-sm text-muted-foreground">2026</span>
        </div>

        <div className="grid grid-cols-3 gap-px bg-border">
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Entrou</p>
            <p className="text-lg font-semibold text-emerald-500">{formatCurrency(totReceitas)}</p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Saiu</p>
            <p className="text-lg font-semibold text-rose-500">{formatCurrency(totDespesas)}</p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Sobrou</p>
            <p className={`text-lg font-semibold ${totResultado >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(totResultado)}
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {dre.map((m) => (
            <div key={m.mes} className="flex items-center gap-4 px-5 py-2.5 text-sm">
              <span className="w-16 text-muted-foreground">{mesLabel(m.mes)}</span>
              <span className="ml-auto w-28 text-right text-emerald-500">{formatCurrency(Number(m.receitas))}</span>
              <span className="w-28 text-right text-rose-500">{formatCurrency(Number(m.despesas))}</span>
              <span className={`w-28 text-right font-medium ${Number(m.resultado) >= 0 ? '' : 'text-rose-500'}`}>
                {formatCurrency(Number(m.resultado))}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-5 py-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Para onde foi o dinheiro (por grupo)</p>
          <div className="space-y-2">
            {grupos.slice(0, 8).map((g) => {
              const max = Number(grupos[0]?.despesas) || 1
              const pct = (Number(g.despesas) / max) * 100
              return (
                <div key={g.grupo} className="flex items-center gap-3 text-sm">
                  <span className="w-44 truncate text-muted-foreground">{g.grupo}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-28 text-right">{formatCurrency(Number(g.despesas))}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 2. MEU PATRIMÔNIO ── */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Wallet className="h-4 w-4" />
          </span>
          <span className="font-semibold">Meu patrimônio</span>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-3">
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Tenho</p>
            <p className="text-lg font-semibold">{formatCurrency(Number(bal?.total_ativo ?? 0))}</p>
            <p className="text-xs text-muted-foreground">
              caixa {formatCurrency(Number(bal?.ativo_caixa ?? 0))} · bens {formatCurrency(Number(bal?.ativo_bens ?? 0))}
            </p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Devo</p>
            <p className="text-lg font-semibold text-rose-500">{formatCurrency(Number(bal?.total_passivo ?? 0))}</p>
            <p className="text-xs text-muted-foreground">
              faturas {formatCurrency(Number(bal?.passivo_faturas ?? 0))} · parcelas {formatCurrency(Number(bal?.passivo_parcelas ?? 0))}
            </p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Meu patrimônio líquido</p>
            <p className="text-lg font-semibold text-primary">{formatCurrency(Number(bal?.patrimonio_liquido ?? 0))}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 border-t border-border px-5 py-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Teste de fechamento: patrimônio inicial + resultado do período = patrimônio final.
            {fech?.diferenca == null
              ? ' Ainda não roda — falta informar o patrimônio de abertura.'
              : ` Diferença: ${formatCurrency(Number(fech.diferenca))}.`}
          </p>
        </div>
      </section>

      {/* ── 3. FLUXO DE CAIXA ── */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ArrowLeftRight className="h-4 w-4" />
          </span>
          <span className="font-semibold">Fluxo de caixa</span>
          <span className="ml-auto text-sm text-muted-foreground">
            sobrou {formatCurrency(totLiq)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-border">
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Operacional</p>
            <p className="text-lg font-semibold">{formatCurrency(totOper)}</p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Investimentos e bens</p>
            <p className="text-lg font-semibold">{formatCurrency(totInv)}</p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Sobrou no período</p>
            <p className="text-lg font-semibold">{formatCurrency(totLiq)}</p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {dfc.map((m) => (
            <div key={m.mes} className="flex items-center gap-4 px-5 py-2.5 text-sm">
              <span className="w-16 text-muted-foreground">{mesLabel(m.mes)}</span>
              <span className="ml-auto w-28 text-right">{formatCurrency(Number(m.operacional))}</span>
              <span className="w-28 text-right">{formatCurrency(Number(m.investimentos))}</span>
              <span className="w-28 text-right font-medium">{formatCurrency(Number(m.saldo_mes))}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. DIÁRIO ── */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="font-semibold">Diário</span>
          <span className="ml-auto text-sm text-muted-foreground">{diario.length} lançamentos</span>
        </div>
        <div className="max-h-[36rem] overflow-y-auto divide-y divide-border">
          {diario.map((l, i) => (
            <div key={`${l.data}-${i}`} className="flex items-center gap-3 px-5 py-2 text-sm">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {l.data.split('-').reverse().join('/').slice(0, 5)}
              </span>
              <span className="min-w-0 flex-1 truncate">{l.descricao}</span>
              <span className="hidden w-36 truncate text-xs text-muted-foreground sm:block">{l.grupo}</span>
              <span className="w-24 shrink-0 rounded-full bg-muted px-2 py-0.5 text-center text-[10px] text-muted-foreground">
                {NATUREZA_LABEL[l.natureza] ?? l.natureza}
              </span>
              <span className="w-24 shrink-0 text-right font-medium">{formatCurrency(Number(l.valor))}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
