import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lista de provedores/modelos de IA permitidos neste app.
// Boas práticas:
// - O usuário escolhe apenas entre opções da whitelist do servidor; a chave
//   de API nunca sai do servidor nem é configurável pelo cliente.
// - Formato do env AI_ALLOWED_MODELS:
//   Provedor|modelo|Label;Provedor2|modelo2|Label2

export const dynamic = 'force-dynamic'

export interface AllowedModel {
  provider: string
  model: string
  label: string
}

const DEFAULT_MODELS: AllowedModel[] = [
  { provider: 'omniroute', model: 'free-1m', label: 'OmniRoute — Free 1M (grátis, recomendado)' },
  { provider: 'omniroute', model: 'auto', label: 'OmniRoute — Automático' },
  { provider: 'omniroute', model: 'auto/best-coding', label: 'OmniRoute — Melhor para código' },
]

export function getAllowedModels(): AllowedModel[] {
  const raw = process.env.AI_ALLOWED_MODELS
  if (!raw) return DEFAULT_MODELS
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((m) => m.provider && m.model)) {
      return parsed.map((m) => ({ provider: m.provider, model: m.model, label: m.label ?? `${m.provider}/${m.model}` }))
    }
  } catch { /* fallback abaixo */ }
  // Formato simples: "Provedor|modelo|Label;..."
  const items = raw.split(';').map((s) => s.split('|').map((p) => p.trim())).filter((p) => p.length >= 2)
  if (items.length > 0) {
    return items.map(([provider, model, label]) => ({ provider, model, label: label ?? `${provider}/${model}` }))
  }
  return DEFAULT_MODELS
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const models = getAllowedModels()

  // ?test=1 → faz um ping de 1 token no modelo escolhido (?model=...)
  const url = new URL(req.url)
  if (url.searchParams.get('test')) {
    const requested = url.searchParams.get('model') ?? models[0].model
    const apiKey = process.env.AI_API_KEY
    const baseUrl = process.env.AI_API_BASE
    if (!apiKey || !baseUrl) {
      return NextResponse.json({ models, test: { ok: false, error: 'IA não configurada no servidor.' } })
    }
    try {
      const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: requested,
          messages: [{ role: 'user', content: 'Responda apenas: ok' }],
          max_tokens: 5,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!resp.ok) return NextResponse.json({ models, test: { ok: false, error: `HTTP ${resp.status}` } })
      const data = await resp.json()
      const content = data?.choices?.[0]?.message?.content ?? ''
      return NextResponse.json({ models, test: { ok: true, sample: String(content).slice(0, 40) } })
    } catch (e) {
      return NextResponse.json({ models, test: { ok: false, error: 'Falha de conexão com o provedor.' } })
    }
  }

  return NextResponse.json({ models })
}
