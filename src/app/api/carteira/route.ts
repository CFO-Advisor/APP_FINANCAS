import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Painel somente-leitura: espelha a carteira do app "Investor".
// O token de integração nunca é devolvido ao cliente.
export const dynamic = 'force-dynamic'

const DEFAULT_CARTEIRA_API_URL = 'http://127.0.0.1:8080'
const UPSTREAM_TIMEOUT_MS = 8000

// Aceita apenas http(s) e devolve a base sem barra final; null se inválida.
function resolveBaseUrl(): string | null {
  const raw = (process.env.CARTEIRA_API_URL ?? DEFAULT_CARTEIRA_API_URL).trim()
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return raw.replace(/\/+$/, '')
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const token = process.env.CARTEIRA_INTEGRATION_TOKEN
  const baseUrl = resolveBaseUrl()

  // Sem token ou com URL inválida o recurso simplesmente não está configurado.
  if (!token || !baseUrl) {
    return NextResponse.json({ configured: false })
  }

  try {
    const response = await fetch(`${baseUrl}/api/integration/portfolio`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    if (!response.ok) {
      return NextResponse.json({
        configured: true,
        error: `Falha ao consultar a carteira (HTTP ${response.status}).`,
      })
    }

    const data = await response.json()
    return NextResponse.json({ configured: true, data })
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError'
    return NextResponse.json({
      configured: true,
      error: isTimeout
        ? 'Tempo esgotado ao consultar a carteira.'
        : 'Não foi possível conectar ao app Investor.',
    })
  }
}
