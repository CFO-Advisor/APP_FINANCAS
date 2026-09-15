'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2, ShieldCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AI_MODEL_KEY,
  DEFAULT_PROL_ABORE_MAX,
  readAiPrefs,
  saveHolderNames,
  saveProLaboreMax,
} from '@/lib/ai-config'

// Configuração de IA: o usuário escolhe provedor/modelo entre opções da
// whitelist do servidor (/api/ai/models). A chave de API NUNCA aparece aqui —
// fica apenas no servidor (.env.local). A preferência é salva no localStorage
// e enviada nas chamadas ao assistente.

const MODEL_PREF_KEY = AI_MODEL_KEY

interface AllowedModel {
  provider: string
  model: string
  label: string
}

export default function AiSettingsPage() {
  const [models, setModels] = useState<AllowedModel[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  // Regras de classificação do titular (aplicadas pela IA na importação)
  const [holderInput, setHolderInput] = useState('')
  const [proLaboreMax, setProLaboreMax] = useState<number>(DEFAULT_PROL_ABORE_MAX)

  useEffect(() => {
    const prefs = readAiPrefs()
    setHolderInput(prefs.holderNames.join(', '))
    setProLaboreMax(prefs.proLaboreMax)
    load()
  }, [])

  function saveRules() {
    const names = holderInput.split(',').map((n) => n.trim()).filter(Boolean)
    saveHolderNames(names)
    const max = Number.isFinite(proLaboreMax) && proLaboreMax > 0 ? proLaboreMax : DEFAULT_PROL_ABORE_MAX
    saveProLaboreMax(max)
    setProLaboreMax(max)
    toast.success('Regras de classificação salvas.')
  }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/models')
      if (!res.ok) throw new Error('Falha ao carregar modelos.')
      const data = await res.json()
      setModels(data.models ?? [])
      const saved = typeof window !== 'undefined' ? localStorage.getItem(MODEL_PREF_KEY) : null
      const valid = saved && data.models?.some((m: AllowedModel) => m.model === saved)
      setSelected(valid ? saved : data.models?.[0]?.model ?? '')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  function save(model: string | null) {
    if (!model) return
    setSelected(model)
    try { localStorage.setItem(MODEL_PREF_KEY, model) } catch { /* ignore */ }
    setTestResult(null)
  }

  async function testConnection() {
    if (!selected) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/ai/models?test=1&model=${encodeURIComponent(selected)}`)
      const data = await res.json()
      if (data.test?.ok) {
        setTestResult({ ok: true, message: `Conexão OK — resposta: "${data.test.sample}"` })
      } else {
        setTestResult({ ok: false, message: data.test?.error ?? 'Falha no teste.' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Falha de rede ao testar.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações de IA</h1>
          <p className="text-sm text-muted-foreground">Provedor e modelo usados pelo assistente e pela classificação de transações.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelo de IA</CardTitle>
          <CardDescription>
            Escolha entre os modelos disponibilizados pelo administrador do servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando modelos…
            </div>
          ) : models.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum modelo configurado no servidor.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Provedor / Modelo</Label>
                <Select value={selected} onValueChange={save}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar modelo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={`${m.provider}/${m.model}`} value={m.model}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={testConnection} disabled={testing || !selected}>
                  {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Testar conexão
                </Button>
                <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar lista
                </Button>
              </div>
              {testResult && (
                <p className={`text-xs ${testResult.ok ? 'text-emerald-600' : 'text-destructive'}`}>
                  {testResult.ok ? '✅ ' : '⚠️ '}{testResult.message}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras de classificação</CardTitle>
          <CardDescription>
            Ensinam a IA a reconhecer transferências entre suas contas e recebimentos da sua empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome(s) do titular da conta</Label>
            <Input
              placeholder="Ex.: Celio Gadelha de Oliveira (separe por vírgula)"
              value={holderInput}
              onChange={(e) => setHolderInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Entrada ou saída com esses nomes é tratada como <strong>Transferência</strong> (movimentação entre contas do mesmo titular).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Valor máximo de pró-labore (R$)</Label>
            <Input
              type="number"
              min={0}
              step={100}
              value={proLaboreMax}
              onChange={(e) => setProLaboreMax(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Recebimentos da <strong>CFO Advisor</strong> até esse valor entram como <strong>Pró-labore</strong>; acima dele, como <strong>Dividendos</strong>.
            </p>
          </div>

          <Button size="sm" onClick={saveRules}>Salvar regras</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• As <strong>chaves de API ficam apenas no servidor</strong> — nunca no navegador.</p>
          <p>• Somente modelos da <strong>lista autorizada</strong> podem ser usados.</p>
          <p>• O assistente <strong>não salva nem altera dados</strong> por conta própria: navega e pré-preenche formulários, e você confirma.</p>
          <p>• Todas as chamadas exigem <strong>sessão autenticada</strong>.</p>
        </CardContent>
      </Card>
    </div>
  )
}
