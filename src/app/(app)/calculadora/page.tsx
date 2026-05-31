'use client'

import { useEffect, useState } from 'react'
import { Calculator, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/csv-export'
import {
  fetchSelicRate,
  fetchCdiRate,
  fetchInflationSeries,
  fetchExchangeRates,
  type FrankfurterResponse,
} from '@/lib/finance-api'

// ============ Helpers ============

function ResultCard({
  children,
  variant = 'green',
}: {
  children: React.ReactNode
  variant?: 'green' | 'blue' | 'violet' | 'amber'
}) {
  const classes = {
    green: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
    blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900',
    violet: 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900',
    amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900',
  }
  return (
    <div className={cn('rounded-lg border p-4 space-y-3', classes[variant])}>{children}</div>
  )
}

function ResultRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', accent)}>{value}</span>
    </div>
  )
}

const CURRENCIES = [
  { code: 'USD', label: 'Dólar americano (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'Libra esterlina (GBP)' },
  { code: 'ARS', label: 'Peso argentino (ARS)' },
  { code: 'JPY', label: 'Iene japonês (JPY)' },
  { code: 'CLP', label: 'Peso chileno (CLP)' },
  { code: 'PYG', label: 'Guarani paraguaio (PYG)' },
  { code: 'UYU', label: 'Peso uruguaio (UYU)' },
]

// ============ Amortization Functions ============

interface AmortRow {
  periodo: number
  prestacao: number
  juros: number
  amortizacao: number
  saldo: number
}

type AmortizationSystem = 'sac' | 'price' | 'sam' | 'american'

function calcSAC(pv: number, i: number, n: number): AmortRow[] {
  const amortConstante = pv / n
  const table: AmortRow[] = []
  let saldo = pv

  for (let t = 1; t <= n; t++) {
    const juros = saldo * i
    const prestacao = amortConstante + juros
    saldo -= amortConstante
    table.push({ periodo: t, prestacao, juros, amortizacao: amortConstante, saldo: Math.max(0, saldo) })
  }
  return table
}

function calcPRICE(pv: number, i: number, n: number): AmortRow[] {
  const pmt = pv * (i / (1 - Math.pow(1 + i, -n)))
  const table: AmortRow[] = []
  let saldo = pv

  for (let t = 1; t <= n; t++) {
    const juros = saldo * i
    const amortizacao = pmt - juros
    saldo -= amortizacao
    table.push({ periodo: t, prestacao: pmt, juros, amortizacao, saldo: Math.max(0, saldo) })
  }
  return table
}

function calcSAM(pv: number, i: number, n: number): AmortRow[] {
  const sacTable = calcSAC(pv, i, n)
  const priceTable = calcPRICE(pv, i, n)
  const table: AmortRow[] = []
  let saldo = pv

  for (let t = 1; t <= n; t++) {
    const prestacaoSAM = (sacTable[t - 1].prestacao + priceTable[t - 1].prestacao) / 2
    const juros = saldo * i
    const amortizacao = prestacaoSAM - juros
    saldo -= amortizacao
    table.push({ periodo: t, prestacao: prestacaoSAM, juros, amortizacao, saldo: Math.max(0, saldo) })
  }
  return table
}

function calcAmerican(pv: number, i: number, n: number): AmortRow[] {
  const table: AmortRow[] = []

  for (let t = 1; t <= n; t++) {
    if (t < n) {
      const juros = pv * i
      const prestacao = juros
      table.push({ periodo: t, prestacao, juros, amortizacao: 0, saldo: pv })
    } else {
      const juros = pv * i
      const prestacao = pv + juros
      table.push({ periodo: t, prestacao, juros, amortizacao: pv, saldo: 0 })
    }
  }
  return table
}

function calcAmort(system: AmortizationSystem, pv: number, i: number, n: number): AmortRow[] {
  switch (system) {
    case 'sac':
      return calcSAC(pv, i, n)
    case 'price':
      return calcPRICE(pv, i, n)
    case 'sam':
      return calcSAM(pv, i, n)
    case 'american':
      return calcAmerican(pv, i, n)
  }
}

// ============ Tab 1: Juros Simples ============

function JurosSimples() {
  const [principal, setPrincipal] = useState<string>('')
  const [taxa, setTaxa] = useState<string>('')
  const [periodo, setPeriodo] = useState<string>('')
  const [result, setResult] = useState<{ montante: number; juros: number } | null>(null)

  function calcular() {
    const P = parseFloat(principal)
    const i = parseFloat(taxa) / 100
    const t = parseFloat(periodo)
    if (isNaN(P) || isNaN(i) || isNaN(t) || P <= 0 || t <= 0) return
    const montante = P * (1 + i * t)
    setResult({ montante, juros: montante - P })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Juros Simples</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label htmlFor="principal-simples">Principal (R$)</Label>
              <Input
                id="principal-simples"
                type="number"
                placeholder="0,00"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="taxa-simples">Taxa (% ao mês)</Label>
              <Input
                id="taxa-simples"
                type="number"
                placeholder="0,00"
                step="0.01"
                value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="periodo-simples">Período (meses)</Label>
              <Input
                id="periodo-simples"
                type="number"
                placeholder="0"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              />
            </div>
            <Button onClick={calcular} className="w-full">
              Calcular
            </Button>
          </div>

          <div>
            {result ? (
              <ResultCard variant="green">
                <ResultRow
                  label="Montante Final"
                  value={formatCurrency(result.montante)}
                  accent="text-green-700 dark:text-green-400"
                />
                <ResultRow
                  label="Juros Totais"
                  value={formatCurrency(result.juros)}
                  accent="text-green-700 dark:text-green-400"
                />
              </ResultCard>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Preencha os valores e calcule
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Tab 2: Juros Compostos ============

function JurosCompostos() {
  const [principal, setPrincipal] = useState<string>('')
  const [taxa, setTaxa] = useState<string>('')
  const [periodo, setPeriodo] = useState<string>('')
  const [result, setResult] = useState<{
    montante: number
    juros: number
    table: Array<{ mes: number; montante: number; juros: number }>
  } | null>(null)

  function calcular() {
    const P = parseFloat(principal)
    const i = parseFloat(taxa) / 100
    const t = Math.min(Math.floor(parseFloat(periodo)), 24)
    if (isNaN(P) || isNaN(i) || isNaN(t) || P <= 0 || t <= 0) return
    const montante = P * Math.pow(1 + i, t)
    const table = Array.from({ length: t }, (_, idx) => {
      const m = idx + 1
      const mont = P * Math.pow(1 + i, m)
      return { mes: m, montante: mont, juros: mont - P }
    })
    setResult({ montante, juros: montante - P, table })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Juros Compostos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label htmlFor="principal-comp">Principal (R$)</Label>
              <Input
                id="principal-comp"
                type="number"
                placeholder="0,00"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="taxa-comp">Taxa (% ao mês)</Label>
              <Input
                id="taxa-comp"
                type="number"
                placeholder="0,00"
                step="0.01"
                value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="periodo-comp">Período (meses, máx. 24)</Label>
              <Input
                id="periodo-comp"
                type="number"
                placeholder="0"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              />
            </div>
            <Button onClick={calcular} className="w-full">
              Calcular
            </Button>
          </div>

          <div>
            {result ? (
              <div className="space-y-4">
                <ResultCard variant="green">
                  <ResultRow
                    label="Montante Final"
                    value={formatCurrency(result.montante)}
                    accent="text-green-700 dark:text-green-400"
                  />
                  <ResultRow
                    label="Juros Totais"
                    value={formatCurrency(result.juros)}
                    accent="text-green-700 dark:text-green-400"
                  />
                </ResultCard>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted border-b">
                        <tr>
                          <th className="px-3 py-2 text-left">Mês</th>
                          <th className="px-3 py-2 text-right">Montante</th>
                          <th className="px-3 py-2 text-right">Juros</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.table.map((row) => (
                          <tr key={row.mes} className="border-t hover:bg-muted/50">
                            <td className="px-3 py-2">{row.mes}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(row.montante)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(row.juros)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Preencha os valores e calcule
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Tab 3: SELIC / CDI ============

function SelicCdi() {
  const [principal, setPrincipal] = useState<string>('')
  const [periodo, setPeriodo] = useState<string>('')
  const [mode, setMode] = useState<'selic' | 'cdi'>('selic')
  const [pctCdi, setPctCdi] = useState<string>('100')
  const [selicRate, setSelicRate] = useState<number | null>(null)
  const [cdiRate, setCdiRate] = useState<number | null>(null)
  const [loadingRate, setLoadingRate] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)
  const [manualRate, setManualRate] = useState<string>('')
  const [result, setResult] = useState<{ montante: number; rendimento: number; taxaUsada: number } | null>(null)

  async function loadRates() {
    setLoadingRate(true)
    setRateError(null)
    const [selicRes, cdiRes] = await Promise.all([fetchSelicRate(), fetchCdiRate()])
    if (selicRes.ok) setSelicRate(selicRes.data)
    if (cdiRes.ok) setCdiRate(cdiRes.data)
    if (!selicRes.ok && !cdiRes.ok) setRateError(selicRes.error)
    setLoadingRate(false)
  }

  useEffect(() => {
    loadRates()
  }, [])

  const activeAnnualRate = (() => {
    const apiRate = mode === 'selic' ? selicRate : cdiRate
    if (apiRate !== null) return mode === 'cdi' ? apiRate * (parseFloat(pctCdi) / 100) : apiRate
    return parseFloat(manualRate) || null
  })()

  function calcular() {
    const P = parseFloat(principal)
    const t = parseFloat(periodo)
    if (!activeAnnualRate || isNaN(P) || isNaN(t) || P <= 0 || t <= 0) return
    const monthly = activeAnnualRate / 100 / 12
    const montante = P * Math.pow(1 + monthly, t)
    setResult({ montante, rendimento: montante - P, taxaUsada: activeAnnualRate })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SELIC / CDI</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {/* Rate display */}
            <div className="flex gap-2 flex-wrap">
              {loadingRate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando taxa...
                </div>
              )}
              {selicRate !== null && (
                <Badge variant="secondary">SELIC: {selicRate.toFixed(2)}% a.a.</Badge>
              )}
              {cdiRate !== null && (
                <Badge variant="secondary">CDI: {cdiRate.toFixed(2)}% a.a.</Badge>
              )}
            </div>

            {/* Error state */}
            {rateError && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{rateError}</p>
                <Label htmlFor="manual-rate">Taxa anual (%) - fallback</Label>
                <Input
                  id="manual-rate"
                  type="number"
                  placeholder="0,00"
                  step="0.01"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                />
              </div>
            )}

            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                variant={mode === 'selic' ? 'default' : 'outline'}
                onClick={() => setMode('selic')}
              >
                SELIC
              </Button>
              <Button variant={mode === 'cdi' ? 'default' : 'outline'} onClick={() => setMode('cdi')}>
                CDI
              </Button>
            </div>

            {/* CDI percentage (shown only in CDI mode) */}
            {mode === 'cdi' && (
              <div>
                <Label htmlFor="pct-cdi">% do CDI</Label>
                <Input
                  id="pct-cdi"
                  type="number"
                  placeholder="100"
                  step="0.1"
                  value={pctCdi}
                  onChange={(e) => setPctCdi(e.target.value)}
                />
              </div>
            )}

            <div>
              <Label htmlFor="principal-cdi">Principal (R$)</Label>
              <Input
                id="principal-cdi"
                type="number"
                placeholder="0,00"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="periodo-cdi">Período (meses)</Label>
              <Input
                id="periodo-cdi"
                type="number"
                placeholder="0"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              />
            </div>
            <Button onClick={calcular} className="w-full">
              Calcular
            </Button>
          </div>

          <div>
            {result ? (
              <ResultCard variant="green">
                <ResultRow
                  label="Montante Final"
                  value={formatCurrency(result.montante)}
                  accent="text-green-700 dark:text-green-400"
                />
                <ResultRow
                  label="Rendimento"
                  value={formatCurrency(result.rendimento)}
                  accent="text-green-700 dark:text-green-400"
                />
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {mode === 'cdi' ? 'Taxa CDI' : 'Taxa SELIC'} utilizada
                  </span>
                  <Badge>{result.taxaUsada.toFixed(2)}% a.a.</Badge>
                </div>
              </ResultCard>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Preencha os valores e calcule
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Tab 4: IPCA / IGP-M ============

function Inflacao() {
  const [valor, setValor] = useState<string>('')
  const [indice, setIndice] = useState<'ipca' | 'igpm'>('ipca')
  const [dataInicial, setDataInicial] = useState<string>('')
  const [dataFinal, setDataFinal] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ valorCorrigido: number; variacaoPct: number } | null>(null)

  async function calcular() {
    const V = parseFloat(valor)
    if (isNaN(V) || !dataInicial || !dataFinal) return
    setLoading(true)
    setError(null)

    function toBcbDate(monthInput: string) {
      const [y, m] = monthInput.split('-')
      return `01/${m}/${y}`
    }

    const code = indice === 'ipca' ? 433 : 189
    const res = await fetchInflationSeries(code, toBcbDate(dataInicial), toBcbDate(dataFinal))

    if (!res.ok) {
      setError(res.error)
      setLoading(false)
      return
    }

    if (res.data.length === 0) {
      setError('Nenhum dado encontrado para o período informado.')
      setLoading(false)
      return
    }

    const accumulated = res.data.reduce((acc, entry) => acc * (1 + parseFloat(entry.valor) / 100), 1)
    const valorCorrigido = V * accumulated
    setResult({ valorCorrigido, variacaoPct: (accumulated - 1) * 100 })
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Correção Monetária (IPCA / IGP-M)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label htmlFor="valor-inflacao">Valor (R$)</Label>
              <Input
                id="valor-inflacao"
                type="number"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={indice === 'ipca' ? 'default' : 'outline'}
                onClick={() => setIndice('ipca')}
              >
                IPCA
              </Button>
              <Button
                variant={indice === 'igpm' ? 'default' : 'outline'}
                onClick={() => setIndice('igpm')}
              >
                IGP-M
              </Button>
            </div>

            <div>
              <Label htmlFor="data-inicial">Mês/Ano Inicial</Label>
              <Input
                id="data-inicial"
                type="month"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="data-final">Mês/Ano Final</Label>
              <Input
                id="data-final"
                type="month"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={calcular} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Calculando...
                </>
              ) : (
                'Calcular'
              )}
            </Button>
          </div>

          <div>
            {result ? (
              <ResultCard variant="blue">
                <ResultRow
                  label="Valor Corrigido"
                  value={formatCurrency(result.valorCorrigido)}
                  accent="text-blue-700 dark:text-blue-400"
                />
                <ResultRow
                  label="Variação Acumulada"
                  value={`${result.variacaoPct.toFixed(2)}%`}
                  accent="text-blue-700 dark:text-blue-400"
                />
              </ResultCard>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Preencha os valores e calcule
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Tab 5: Câmbio ============

function Cambio() {
  const [valor, setValor] = useState<string>('')
  const [moeda, setMoeda] = useState<string>('USD')
  const [rates, setRates] = useState<FrankfurterResponse | null>(null)
  const [loadingRates, setLoadingRates] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)
  const [result, setResult] = useState<{ convertido: number; taxa: number } | null>(null)

  async function loadRates() {
    setLoadingRates(true)
    setRateError(null)
    const res = await fetchExchangeRates()
    if (res.ok) {
      setRates(res.data)
    } else {
      setRateError(res.error)
    }
    setLoadingRates(false)
  }

  useEffect(() => {
    loadRates()
  }, [])

  function converter() {
    const V = parseFloat(valor)
    if (isNaN(V) || !rates) return
    const taxa = rates.rates[moeda]
    if (!taxa) return
    setResult({ convertido: V * taxa, taxa })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Câmbio (BRL)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label htmlFor="valor-cambio">Valor (R$)</Label>
              <Input
                id="valor-cambio"
                type="number"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="moeda-select">Moeda</Label>
              <Select value={moeda} onValueChange={(value) => { if (value !== null) setMoeda(value) }}>
                <SelectTrigger id="moeda-select">
                  <span className="flex flex-1 text-left text-sm">
                    {CURRENCIES.find((c) => c.code === moeda)?.label || 'Selecionar'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingRates && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando cotações...
              </div>
            )}

            {rateError && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{rateError}</p>
                <Button variant="outline" size="sm" onClick={loadRates}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {rates && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Cotação em: {new Date(rates.date).toLocaleDateString('pt-BR')}
                </p>
                {rates.date === new Date().toISOString().split('T')[0] && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Taxas aproximadas (API indisponível)
                  </p>
                )}
              </div>
            )}

            <Button onClick={converter} disabled={!rates || loadingRates} className="w-full">
              Converter
            </Button>
          </div>

          <div>
            {result ? (
              <ResultCard variant="violet">
                <div className="space-y-2">
                  <ResultRow
                    label={`Taxa (1 BRL)`}
                    value={`${result.taxa.toFixed(4)} ${moeda}`}
                    accent="text-violet-700 dark:text-violet-400"
                  />
                  <div className="border-t pt-3">
                    <ResultRow
                      label="Valor convertido"
                      value={`${result.convertido.toFixed(2)} ${moeda}`}
                      accent="text-violet-700 dark:text-violet-400"
                    />
                  </div>
                </div>
              </ResultCard>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Preencha os valores e converta
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Tab 6: Financiamento ============

function Financiamento() {
  const [pv, setPv] = useState<string>('')
  const [taxa, setTaxa] = useState<string>('')
  const [prazo, setPrazo] = useState<string>('')
  const [sistema, setSistema] = useState<AmortizationSystem>('price')
  const [result, setResult] = useState<{ table: AmortRow[]; totalPago: number; totalJuros: number } | null>(null)

  function calcular() {
    const P = parseFloat(pv)
    const i = parseFloat(taxa) / 100
    const n = parseInt(prazo)
    if (isNaN(P) || isNaN(i) || isNaN(n) || P <= 0 || i <= 0 || n <= 0) return

    const table = calcAmort(sistema, P, i, n)
    const totalPago = table.reduce((sum, row) => sum + row.prestacao, 0)
    const totalJuros = table.reduce((sum, row) => sum + row.juros, 0)
    setResult({ table, totalPago, totalJuros })
  }

  const systemLabels: Record<AmortizationSystem, string> = {
    sac: 'SAC (Sistema de Amortização Constante)',
    price: 'PRICE (Sistema de Amortização Francês)',
    sam: 'SAM (Sistema de Amortização Misto)',
    american: 'Sistema Americano',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financiamento e Empréstimos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="pv-fin">Valor Financiado (R$)</Label>
              <Input
                id="pv-fin"
                type="number"
                placeholder="0,00"
                value={pv}
                onChange={(e) => setPv(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="taxa-fin">Taxa (% ao mês)</Label>
              <Input
                id="taxa-fin"
                type="number"
                placeholder="0,00"
                step="0.01"
                value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="prazo-fin">Prazo (meses)</Label>
              <Input
                id="prazo-fin"
                type="number"
                placeholder="0"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sistema-fin">Sistema de Amortização</Label>
              <Select value={sistema} onValueChange={(v) => { if (v !== null) setSistema(v as AmortizationSystem) }}>
                <SelectTrigger id="sistema-fin">
                  <span className="flex flex-1 text-left text-sm">
                    {sistema === 'sac' ? 'SAC' : sistema === 'price' ? 'PRICE' : sistema === 'sam' ? 'SAM' : 'Americano'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sac">SAC</SelectItem>
                  <SelectItem value="price">PRICE (Francês)</SelectItem>
                  <SelectItem value="sam">SAM (Misto)</SelectItem>
                  <SelectItem value="american">Americano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={calcular} className="w-full">
            Calcular
          </Button>

          {result && (
            <div className="space-y-4">
              <ResultCard variant="amber">
                <ResultRow
                  label="1ª Prestação"
                  value={formatCurrency(result.table[0].prestacao)}
                  accent="text-amber-700 dark:text-amber-400"
                />
                <ResultRow
                  label="Última Prestação"
                  value={formatCurrency(result.table[result.table.length - 1].prestacao)}
                  accent="text-amber-700 dark:text-amber-400"
                />
                <div className="border-t pt-3">
                  <ResultRow
                    label="Total Pago"
                    value={formatCurrency(result.totalPago)}
                    accent="text-amber-700 dark:text-amber-400"
                  />
                  <ResultRow
                    label="Total de Juros"
                    value={formatCurrency(result.totalJuros)}
                    accent="text-amber-700 dark:text-amber-400"
                  />
                </div>
              </ResultCard>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted border-b">
                      <tr>
                        <th className="px-3 py-2 text-left">Período</th>
                        <th className="px-3 py-2 text-right">Prestação</th>
                        <th className="px-3 py-2 text-right">Juros</th>
                        <th className="px-3 py-2 text-right">Amortização</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.table.map((row) => (
                        <tr key={row.periodo} className="border-t hover:bg-muted/50">
                          <td className="px-3 py-2">{row.periodo}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.prestacao)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.juros)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.amortizacao)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Tab 7: Comparativo ============

function Comparativo() {
  const [pv, setPv] = useState<string>('')
  const [taxa, setTaxa] = useState<string>('')
  const [prazo, setPrazo] = useState<string>('')
  const [result, setResult] = useState<{ sac: AmortRow[]; price: AmortRow[]; sam: AmortRow[] } | null>(null)

  function calcular() {
    const P = parseFloat(pv)
    const i = parseFloat(taxa) / 100
    const n = parseInt(prazo)
    if (isNaN(P) || isNaN(i) || isNaN(n) || P <= 0 || i <= 0 || n <= 0) return

    setResult({
      sac: calcSAC(P, i, n),
      price: calcPRICE(P, i, n),
      sam: calcSAM(P, i, n),
    })
  }

  const getMetrics = (table: AmortRow[]) => ({
    first: table[0].prestacao,
    last: table[table.length - 1].prestacao,
    totalPago: table.reduce((sum, row) => sum + row.prestacao, 0),
    totalJuros: table.reduce((sum, row) => sum + row.juros, 0),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativo de Sistemas de Amortização</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="pv-comp">Valor Financiado (R$)</Label>
              <Input
                id="pv-comp"
                type="number"
                placeholder="0,00"
                value={pv}
                onChange={(e) => setPv(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="taxa-comp">Taxa (% ao mês)</Label>
              <Input
                id="taxa-comp"
                type="number"
                placeholder="0,00"
                step="0.01"
                value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="prazo-comp">Prazo (meses)</Label>
              <Input
                id="prazo-comp"
                type="number"
                placeholder="0"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={calcular} className="w-full">
            Comparar
          </Button>

          {result && (
            <div className="grid gap-6 lg:grid-cols-3">
              {(() => {
                const sacMetrics = getMetrics(result.sac)
                const priceMetrics = getMetrics(result.price)
                const samMetrics = getMetrics(result.sam)
                const minTotal = Math.min(sacMetrics.totalJuros, priceMetrics.totalJuros, samMetrics.totalJuros)

                return (
                  <>
                    <ResultCard variant="green">
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">SAC</p>
                        <ResultRow
                          label="1ª Prestação"
                          value={formatCurrency(sacMetrics.first)}
                          accent="text-green-700 dark:text-green-400"
                        />
                        <ResultRow
                          label="Última Prestação"
                          value={formatCurrency(sacMetrics.last)}
                          accent="text-green-700 dark:text-green-400"
                        />
                        <div className="border-t pt-2">
                          <ResultRow
                            label="Total Pago"
                            value={formatCurrency(sacMetrics.totalPago)}
                            accent="text-green-700 dark:text-green-400"
                          />
                          <ResultRow
                            label="Juros"
                            value={formatCurrency(sacMetrics.totalJuros)}
                            accent={minTotal === sacMetrics.totalJuros ? 'text-green-600 dark:text-green-300 font-bold' : 'text-green-700 dark:text-green-400'}
                          />
                        </div>
                        {minTotal === sacMetrics.totalJuros && (
                          <Badge className="mt-2 w-full justify-center bg-green-600">Menor custo</Badge>
                        )}
                      </div>
                    </ResultCard>

                    <ResultCard variant="blue">
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">PRICE (Francês)</p>
                        <ResultRow
                          label="1ª Prestação"
                          value={formatCurrency(priceMetrics.first)}
                          accent="text-blue-700 dark:text-blue-400"
                        />
                        <ResultRow
                          label="Última Prestação"
                          value={formatCurrency(priceMetrics.last)}
                          accent="text-blue-700 dark:text-blue-400"
                        />
                        <div className="border-t pt-2">
                          <ResultRow
                            label="Total Pago"
                            value={formatCurrency(priceMetrics.totalPago)}
                            accent="text-blue-700 dark:text-blue-400"
                          />
                          <ResultRow
                            label="Juros"
                            value={formatCurrency(priceMetrics.totalJuros)}
                            accent={minTotal === priceMetrics.totalJuros ? 'text-blue-600 dark:text-blue-300 font-bold' : 'text-blue-700 dark:text-blue-400'}
                          />
                        </div>
                        {minTotal === priceMetrics.totalJuros && (
                          <Badge className="mt-2 w-full justify-center bg-blue-600">Menor custo</Badge>
                        )}
                      </div>
                    </ResultCard>

                    <ResultCard variant="violet">
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">SAM (Misto)</p>
                        <ResultRow
                          label="1ª Prestação"
                          value={formatCurrency(samMetrics.first)}
                          accent="text-violet-700 dark:text-violet-400"
                        />
                        <ResultRow
                          label="Última Prestação"
                          value={formatCurrency(samMetrics.last)}
                          accent="text-violet-700 dark:text-violet-400"
                        />
                        <div className="border-t pt-2">
                          <ResultRow
                            label="Total Pago"
                            value={formatCurrency(samMetrics.totalPago)}
                            accent="text-violet-700 dark:text-violet-400"
                          />
                          <ResultRow
                            label="Juros"
                            value={formatCurrency(samMetrics.totalJuros)}
                            accent={minTotal === samMetrics.totalJuros ? 'text-violet-600 dark:text-violet-300 font-bold' : 'text-violet-700 dark:text-violet-400'}
                          />
                        </div>
                        {minTotal === samMetrics.totalJuros && (
                          <Badge className="mt-2 w-full justify-center bg-violet-600">Menor custo</Badge>
                        )}
                      </div>
                    </ResultCard>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Main Page ============

export default function CalculadoraPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Calculadora Financeira
        </h1>
        <p className="text-sm text-muted-foreground">
          Calcule juros, rendimentos, correção monetária, conversões de câmbio, empréstimos e financiamentos
        </p>
      </div>

      <Tabs defaultValue="juros-simples">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start h-auto py-1 gap-1 lg:w-fit">
          <TabsTrigger value="juros-simples" className="flex-shrink-0 whitespace-nowrap">
            Juros Simples
          </TabsTrigger>
          <TabsTrigger value="juros-compostos" className="flex-shrink-0 whitespace-nowrap">
            Juros Compostos
          </TabsTrigger>
          <TabsTrigger value="selic-cdi" className="flex-shrink-0 whitespace-nowrap">
            SELIC / CDI
          </TabsTrigger>
          <TabsTrigger value="inflacao" className="flex-shrink-0 whitespace-nowrap">
            Inflação
          </TabsTrigger>
          <TabsTrigger value="cambio" className="flex-shrink-0 whitespace-nowrap">
            Câmbio
          </TabsTrigger>
          <TabsTrigger value="financiamento" className="flex-shrink-0 whitespace-nowrap">
            Financiamento
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="flex-shrink-0 whitespace-nowrap">
            Comparativo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="juros-simples">
          <JurosSimples />
        </TabsContent>
        <TabsContent value="juros-compostos">
          <JurosCompostos />
        </TabsContent>
        <TabsContent value="selic-cdi">
          <SelicCdi />
        </TabsContent>
        <TabsContent value="inflacao">
          <Inflacao />
        </TabsContent>
        <TabsContent value="cambio">
          <Cambio />
        </TabsContent>
        <TabsContent value="financiamento">
          <Financiamento />
        </TabsContent>
        <TabsContent value="comparativo">
          <Comparativo />
        </TabsContent>
      </Tabs>
    </div>
  )
}
