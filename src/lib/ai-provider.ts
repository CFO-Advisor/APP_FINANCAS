// Roteamento de IA: provedores diretos (com chave própria configurada pelo
// usuário em Config. IA) e fallback para o gateway OmniRoute (env
// AI_API_BASE/AI_API_KEY). As chaves ficam SOMENTE no servidor
// (.ai-keys.json, fora do git, permissão 600) e nunca são devolvidas
// inteiras ao cliente — só versões mascaradas.

import * as fs from 'fs'
import * as path from 'path'

export const PROVIDER_META: Record<string, { label: string; url: string; format: 'openai' | 'anthropic' }> = {
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', format: 'openai' },
  deepseek: { label: 'DeepSeek', url: 'https://api.deepseek.com/chat/completions', format: 'openai' },
  moonshot: { label: 'Moonshot (Kimi)', url: 'https://api.moonshot.cn/v1/chat/completions', format: 'openai' },
  xai: { label: 'xAI (Grok)', url: 'https://api.x.ai/v1/chat/completions', format: 'openai' },
  google: { label: 'Google (Gemini)', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', format: 'openai' },
  zai: { label: 'Z.ai (GLM)', url: 'https://api.z.ai/api/paas/v4/chat/completions', format: 'openai' },
  anthropic: { label: 'Anthropic (Claude)', url: 'https://api.anthropic.com/v1/messages', format: 'anthropic' },
}

// Modelos mais recentes por provedor direto (nomes nativos de cada API).
// A disponibilidade real depende da conta/chave do usuário no provedor.
export const DIRECT_CATALOG: { provider: string; model: string; label: string }[] = [
  { provider: 'openai', model: 'gpt-5.4', label: 'GPT-5.4 — mais recente da OpenAI' },
  { provider: 'openai', model: 'gpt-5.3-codex', label: 'GPT-5.3 Codex — código' },
  { provider: 'anthropic', model: 'claude-sonnet-5', label: 'Claude Sonnet 5 — máxima precisão' },
  { provider: 'google', model: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro — contexto 2M' },
  { provider: 'deepseek', model: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro — raciocínio' },
  { provider: 'deepseek', model: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash — rápido/barato' },
  { provider: 'moonshot', model: 'kimi-k3', label: 'Kimi K3 — raciocínio' },
  { provider: 'zai', model: 'glm-5.3', label: 'GLM 5.3 — econômico' },
  { provider: 'xai', model: 'grok-4.5', label: 'Grok 4.5 — geral' },
]

const KEYS_FILE = path.join(process.cwd(), '.ai-keys.json')

export interface ProviderKeyConfig { apiKey: string; models: string[] }
export type ProviderKeys = Record<string, ProviderKeyConfig>

export function readProviderKeys(): ProviderKeys {
  try {
    const raw = fs.readFileSync(KEYS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeProviderKeys(keys: ProviderKeys): void {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 })
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

export interface AiTarget { provider: string; url: string; apiKey: string; format: 'openai' | 'anthropic' }

/** Provedor direto com chave configurada que atende este modelo; null → OmniRoute. */
export function resolveAiTarget(model: string): AiTarget | null {
  const keys = readProviderKeys()
  for (const [provider, cfg] of Object.entries(keys)) {
    if (!cfg?.apiKey) continue
    if ((cfg.models ?? []).includes(model)) {
      const meta = PROVIDER_META[provider]
      if (!meta) continue
      return { provider, url: meta.url, apiKey: cfg.apiKey, format: meta.format }
    }
  }
  return null
}

// Converte mensagens no formato OpenAI (system/user, content string ou array
// com image_url data-URL) para o formato de messages da Anthropic.
function toAnthropicBody(model: string, messages: any[], maxTokens: number, temperature?: number) {
  let system = ''
  const out: any[] = []
  for (const m of messages) {
    if (m?.role === 'system') {
      system += (system ? '\n' : '') + (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
      continue
    }
    let content = m.content
    if (Array.isArray(content)) {
      content = content.map((part: any) => {
        if (part?.type === 'text') return { type: 'text', text: part.text }
        if (part?.type === 'image_url') {
          const url: string = part.image_url?.url ?? ''
          const match = url.match(/^data:(.+?);base64,([\s\S]+)$/)
          if (match) return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }
          return { type: 'image', source: { type: 'url', url } }
        }
        return part
      })
    }
    out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content })
  }
  return { model, max_tokens: maxTokens, temperature, system: system || undefined, messages: out }
}

export interface CallAiOptions {
  model: string
  messages: unknown
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}

/** Chama a IA roteando para o provedor direto (se houver chave configurada
 *  para o modelo) ou para o gateway OmniRoute. Retorna o texto da resposta;
 *  lança Error com o detalhe HTTP em falha. */
export async function callAi(opts: CallAiOptions): Promise<string> {
  const direct = resolveAiTarget(opts.model)
  let url: string
  let headers: Record<string, string>
  let body: unknown
  const maxTokens = opts.maxTokens ?? 1024

  if (direct) {
    const meta = PROVIDER_META[direct.provider]
    if (meta.format === 'anthropic') {
      url = meta.url
      headers = { 'Content-Type': 'application/json', 'x-api-key': direct.apiKey, 'anthropic-version': '2023-06-01' }
      body = toAnthropicBody(opts.model, opts.messages as any[], maxTokens, opts.temperature)
    } else {
      url = meta.url
      headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${direct.apiKey}` }
      body = { model: opts.model, messages: opts.messages, max_tokens: maxTokens, temperature: opts.temperature }
    }
  } else {
    const apiKey = process.env.AI_API_KEY
    const baseUrl = process.env.AI_API_BASE
    if (!apiKey || !baseUrl) throw new Error('IA não configurada no servidor.')
    url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
    body = { model: opts.model, messages: opts.messages, max_tokens: maxTokens, temperature: opts.temperature }
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  })
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new Error(`HTTP ${resp.status}${detail ? ` — ${detail.slice(0, 160)}` : ''}`)
  }
  const data = await resp.json()
  if (direct?.format === 'anthropic') {
    return (data?.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
  }
  return data?.choices?.[0]?.message?.content ?? ''
}
