import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PROVIDER_META, readProviderKeys, writeProviderKeys, maskKey } from '@/lib/ai-provider'

// Chaves de API para modelos FORA do OmniRoute. Ficam somente no servidor
// (.ai-keys.json) e nunca são devolvidas inteiras ao cliente — apenas
// mascaradas. Todas as operações exigem sessão autenticada.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const keys = readProviderKeys()
  const providers = Object.entries(keys).map(([provider, cfg]) => ({
    provider,
    label: PROVIDER_META[provider]?.label ?? provider,
    models: cfg.models ?? [],
    apiKeyMasked: maskKey(cfg.apiKey ?? ''),
  }))
  const supported = Object.entries(PROVIDER_META).map(([id, m]) => ({ id, label: m.label }))
  return NextResponse.json({ providers, supported })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const provider = typeof body.provider === 'string' ? body.provider : ''
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    if (!PROVIDER_META[provider]) return NextResponse.json({ error: 'Provedor não suportado.' }, { status: 400 })
    if (!apiKey || apiKey.length < 8) return NextResponse.json({ error: 'Chave de API inválida.' }, { status: 400 })
    const models = Array.isArray(body.models)
      ? body.models.filter((m: unknown) => typeof m === 'string' && m.trim()).map((m: string) => m.trim()).slice(0, 20)
      : []
    if (models.length === 0) return NextResponse.json({ error: 'Informe ao menos um modelo para este provedor.' }, { status: 400 })

    const keys = readProviderKeys()
    keys[provider] = { apiKey, models }
    writeProviderKeys(keys)
    return NextResponse.json({ ok: true, provider, apiKeyMasked: maskKey(apiKey), models })
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const url = new URL(req.url)
  const provider = url.searchParams.get('provider') ?? ''
  if (!PROVIDER_META[provider]) return NextResponse.json({ error: 'Provedor não suportado.' }, { status: 400 })
  const keys = readProviderKeys()
  delete keys[provider]
  writeProviderKeys(keys)
  return NextResponse.json({ ok: true })
}
