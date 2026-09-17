import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi, DIRECT_CATALOG, readProviderKeys } from '@/lib/ai-provider'

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
  /** Modelo direto (fora do OmniRoute, usa chave propria). */
  direct?: boolean
  /** True quando o provedor direto ja tem chave configurada. */
  keyConfigured?: boolean
}

const DEFAULT_MODELS: AllowedModel[] = [
  { provider: 'omniroute', model: 'free-1m', label: 'OmniRoute — Free 1M (grátis, recomendado)' },
  { provider: 'omniroute', model: 'auto', label: 'OmniRoute — Automático' },
  { provider: 'omniroute', model: 'auto/best-coding', label: 'OmniRoute — Melhor para código' },
  // DeepSeek
  { provider: 'openrouter', model: 'openrouter/deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash — rápido e barato (1M ctx)' },
  { provider: 'openrouter', model: 'openrouter/deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro — raciocínio (1M ctx)' },
  { provider: 'openrouter', model: 'openrouter/deepseek/deepseek-chat', label: 'DeepSeek Chat (V3) — leve' },
  // OpenAI
  { provider: 'openai', model: 'openrouter/openai/gpt-4.1-nano', label: 'GPT-4.1 Nano — econômico' },
  { provider: 'openai', model: 'openrouter/openai/gpt-4o-mini', label: 'GPT-4o Mini — econômico' },
  { provider: 'openai', model: 'openrouter/openai/gpt-4.1', label: 'GPT-4.1 — textos longos (1M ctx)' },
  { provider: 'openai', model: 'openrouter/openai/gpt-4o', label: 'GPT-4o — visão (fotos de documentos)' },
  // Google
  { provider: 'google', model: 'openrouter/google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro — contexto 2M' },
  // Outros provedores
  { provider: 'moonshot', model: 'openrouter/moonshotai/kimi-k2.6', label: 'Kimi K2.6 — raciocínio' },
  { provider: 'zai', model: 'openrouter/z-ai/glm-5.2', label: 'GLM 5.2 — econômico' },
  { provider: 'meta', model: 'openrouter/meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B — rápido' },
  { provider: 'xai', model: 'openrouter/x-ai/grok-4.3', label: 'Grok 4.3 — geral' },
  { provider: 'anthropic', model: 'dva/claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — máxima precisão' },
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

  const keys = readProviderKeys()
  const directEntries = DIRECT_CATALOG.map((d) => ({
    provider: d.provider,
    model: d.model,
    label: `${d.label} - direto${keys[d.provider]?.apiKey ? '' : ' (configure a chave de API abaixo)'}`,
    direct: true,
    keyConfigured: !!keys[d.provider]?.apiKey,
  }))
  const models: AllowedModel[] = [...getAllowedModels(), ...directEntries]

  // ?test=1 → faz um ping de 1 token no modelo escolhido (?model=...)
  const url = new URL(req.url)
  if (url.searchParams.get('test')) {
    const requested = url.searchParams.get('model') ?? models[0].model
    try {
      const content = await callAi({
        model: requested,
        messages: [{ role: 'user', content: 'Responda apenas: ok' }],
        maxTokens: 5,
        temperature: 0,
        timeoutMs: 10000,
      })
      return NextResponse.json({ models, test: { ok: true, sample: String(content).slice(0, 40) } })
    } catch (e) {
      return NextResponse.json({ models, test: { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : 'Falha de conexao com o provedor.' } })
    }
  }

  return NextResponse.json({ models })
}
