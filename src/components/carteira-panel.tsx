'use client'

import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface CarteiraPosition {
  symbol: string
  name?: string | null
  class?: string | null
  quantity?: number | null
  avg_price?: number | null
  last_price?: number | null
  market_value?: number | null
  cost_value?: number | null
  profit?: number | null
  profit_pct?: number | null
}

interface CarteiraSummary {
  total_market_value?: number | null
  total_cost_value?: number | null
  total_profit?: number | null
  total_profit_pct?: number | null
  positions_count?: number | null
  updated_at?: string | null
}

interface CarteiraData {
  generated_at?: string | null
  owner?: { email?: string | null } | null
  summary?: CarteiraSummary | null
  positions?: CarteiraPosition[] | null
}

type CarteiraResponse =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; data: CarteiraData }

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qtyFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 })

const CLASS_LABELS: Record<string, string> = {
  STOCK: 'Ação',
  FII: 'FII',
  ETF: 'ETF',
  BDR: 'BDR',
  CRYPTO: 'Cripto',
  FIXED_INCOME: 'Renda Fixa',
  FUND: 'Fundo',
  REIT: 'REIT',
  OPTION: 'Opção',
  OTHER: 'Outro',
}

function formatCurrency(value: number | null | undefined): string {
  return brl.format(value ?? 0)
}

function formatPercent(value: number | null | undefined): string {
  const v = value ?? 0
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

function profitColor(value: number): string {
  if (value > 0) return 'text-emerald-500'
  if (value < 0) return 'text-red-500'
  return 'text-muted-foreground'
}

function classLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return CLASS_LABELS[value] ?? value
}

export function CarteiraPanel() {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<CarteiraResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchCarteira() {
      try {
        const response = await fetch('/api/carteira', { cache: 'no-store' })
        const payload = (await response.json()) as CarteiraResponse
        if (cancelled) return
        setResult(payload)
      } catch {
        if (cancelled) return
        setResult({ configured: true, error: 'Não foi possível carregar a carteira.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCarteira()
    return () => {
      cancelled = true
    }
  }, [])

  const data = result && result.configured && 'data' in result ? result.data : null
  const summary = data?.summary ?? null
  const positions = data?.positions ?? []

  const totalMarketValue = summary?.total_market_value ?? 0
  const totalCostValue = summary?.total_cost_value ?? 0
  const totalProfit = summary?.total_profit ?? 0
  const totalProfitPct = summary?.total_profit_pct ?? 0

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2 pt-5">
        <CardTitle className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5 shrink-0" />
          Investimentos (Investor)
        </CardTitle>
        <CardDescription className="text-xs">
          Dados somente-leitura, sincronizados do app Investor. Não editável por aqui.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/40" />
              ))}
            </div>
            <div className="h-24 animate-pulse rounded-lg border bg-muted/40" />
            <p className="text-xs text-muted-foreground">Carregando…</p>
          </div>
        ) : !result || result.configured === false ? (
          <p className="text-sm text-muted-foreground">
            Integração com o app Investor não configurada.
          </p>
        ) : 'error' in result ? (
          <p className="text-sm text-muted-foreground">{result.error}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Patrimônio
                </p>
                <p className="mt-1 text-lg font-bold leading-none text-foreground tabular-nums">
                  {formatCurrency(totalMarketValue)}
                </p>
              </div>
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Custo
                </p>
                <p className="mt-1 text-lg font-bold leading-none text-foreground tabular-nums">
                  {formatCurrency(totalCostValue)}
                </p>
              </div>
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Resultado
                </p>
                <p
                  className={`mt-1 text-lg font-bold leading-none tabular-nums ${profitColor(totalProfit)}`}
                >
                  {formatCurrency(totalProfit)}
                  <span className="ml-2 text-sm font-medium">{formatPercent(totalProfitPct)}</span>
                </p>
              </div>
            </div>

            {positions.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhuma posição ainda.</p>
            ) : (
              <div className="mt-4 max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="py-2 text-left font-bold">Ativo</th>
                      <th className="py-2 text-left font-bold">Classe</th>
                      <th className="py-2 text-right font-bold">Quantidade</th>
                      <th className="py-2 text-right font-bold">Preço médio</th>
                      <th className="py-2 text-right font-bold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position, index) => {
                      const value = position.market_value ?? position.cost_value ?? 0
                      return (
                        <tr
                          key={`${position.symbol}-${index}`}
                          className="border-b last:border-0"
                        >
                          <td className="py-2 pr-3">
                            <span className="font-semibold text-foreground">{position.symbol}</span>
                            {position.name && (
                              <span className="block text-xs text-muted-foreground">
                                {position.name}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {classLabel(position.class)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                            {qtyFormat.format(position.quantity ?? 0)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                            {formatCurrency(position.avg_price)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-foreground">
                            {formatCurrency(value)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
