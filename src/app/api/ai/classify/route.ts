import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES } from '@/lib/constants'

// Classificação de categorias por IA para importação de extratos.
// Boas práticas aplicadas:
// - A chave da IA fica só no servidor (nunca exposta ao cliente).
// - Requer sessão autenticada (Supabase auth).
// - Timeout curto + fallback silencioso: se a IA falhar, o cliente mantém
//   as categorias das regras locais (best-effort, nunca bloqueia o import).
// - Resposta estrita: a IA só pode escolher categorias da lista oficial.

export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 25000
const MAX_BATCH = 120 // linhas por request; cliente pagina acima disso

interface ClassifyItem {
  index: number
  text: string
  type: 'income' | 'expense' | 'investment'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_API_BASE
  const model = process.env.AI_MODEL || 'auto'
  if (!apiKey || !baseUrl) {
    return NextResponse.json({ configured: false, categories: {} })
  }

  let items: ClassifyItem[]
  try {
    const body = await req.json()
    items = Array.isArray(body.items) ? body.items.slice(0, MAX_BATCH) : []
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }
  if (items.length === 0) return NextResponse.json({ categories: {} })

  const prompt = `Você é um classificador de transações financeiras de extratos bancários brasileiros.
Para cada transação, escolha EXATAMENTE UMA categoria da lista permitida, considerando o tipo (receita/despesa/investimento).

Categorias permitidas:
${CATEGORIES.join(', ')}

Regras:
- Responda APENAS um objeto JSON válido, sem markdown, sem comentários.
- Formato: {"resultados":[{"index":<número inteiro da transação>,"categoria":"<categoria da lista>"}]}
- Se nada encaixar, use "Outros".
- Nunca invente categorias fora da lista.

Transações:
${items.map((i) => `${i.index}. [${i.type}] ${i.text}`).join('\n')}`

  try {
    const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Você classifica transações bancárias brasileiras respondendo apenas JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!resp.ok) {
      return NextResponse.json({ configured: true, categories: {}, fallback: true })
    }

    const data = await resp.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    // Tolera JSON envolvido em ```json ... ```
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ configured: true, categories: {}, fallback: true })

    const parsed = JSON.parse(jsonMatch[0])
    const categories: Record<number, string> = {}
    const valid = new Set(CATEGORIES)
    for (const r of parsed?.resultados ?? []) {
      if (typeof r?.index === 'number' && typeof r?.categoria === 'string' && valid.has(r.categoria)) {
        categories[r.index] = r.categoria
      }
    }
    return NextResponse.json({ configured: true, categories })
  } catch {
    // Timeout/erro de rede → cliente mantém categorias das regras locais
    return NextResponse.json({ configured: true, categories: {}, fallback: true })
  }
}
