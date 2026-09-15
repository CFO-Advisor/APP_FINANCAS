import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, TRANSFER_CATEGORY } from '@/lib/constants'

// Categorias que a IA pode devolver. Inclui "Transferência", que só deve ser
// usada quando a descrição apontar para o próprio titular (regra abaixo).
const AI_CATEGORIES = [...CATEGORIES, TRANSFER_CATEGORY]

// Classificação de categorias por IA para importação de extratos.
// Boas práticas aplicadas:
// - A chave da IA fica só no servidor (nunca exposta ao cliente).
// - Requer sessão autenticada (Supabase auth).
// - Timeout curto + fallback silencioso: se a IA falhar, o cliente mantém
//   as categorias das regras locais (best-effort, nunca bloqueia o import).
// - Resposta estrita: a IA só pode escolher categorias da lista oficial.

export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 60000
const MAX_BATCH = 120 // linhas por request; cliente pagina acima disso

interface ClassifyItem {
  index: number
  text: string
  type: 'income' | 'expense' | 'investment'
  amount?: number
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_API_BASE
  if (!apiKey || !baseUrl) {
    return NextResponse.json({ configured: false, categories: {} })
  }

  let items: ClassifyItem[]
  let model: string | undefined
  let holderNames: string[] = []
  let proLaboreMax = 10000
  const customRules: { match: string; category: string }[] = []
  // Categorias personalizadas do usuário (criadas no app, vivem no navegador)
  const customCategories: string[] = []
  try {
    const body = await req.json()
    items = Array.isArray(body.items) ? body.items.slice(0, MAX_BATCH) : []
    model = typeof body.model === 'string' ? body.model : undefined
    // Regras do titular (configuradas em Config. IA)
    if (Array.isArray(body.holderNames)) {
      holderNames = body.holderNames
        .filter((n: unknown) => typeof n === 'string' && n.trim().length > 2)
        .slice(0, 5)
        .map((n: string) => n.trim())
    }
    if (typeof body.proLaboreMax === 'number' && body.proLaboreMax > 0) proLaboreMax = body.proLaboreMax
    // Categorias personalizadas: texto curto e sem quebra de linha (evita
    // injeção no prompt); entram na lista permitida junto das oficiais.
    if (Array.isArray(body.customCategories)) {
      for (const raw of body.customCategories) {
        if (customCategories.length >= 60) break
        if (typeof raw !== 'string') continue
        const c = raw.trim()
        if (!c || c.length > 40 || /[\r\n]/.test(c) || customCategories.includes(c)) continue
        customCategories.push(c)
      }
    }
    // Regras por emissor: só aceita categoria da lista permitida e texto útil
    const allowedNow = [...new Set([...AI_CATEGORIES, ...customCategories])]
    if (Array.isArray(body.customRules)) {
      for (const raw of body.customRules) {
        if (customRules.length >= 30) break
        if (!raw || typeof raw.match !== 'string' || typeof raw.category !== 'string') continue
        const match = raw.match.trim()
        if (match.length < 2 || !allowedNow.includes(raw.category)) continue
        customRules.push({ match, category: raw.category })
      }
    }
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }
  if (items.length === 0) return NextResponse.json({ categories: {} })

  // Modelo: só aceita se estiver na whitelist do servidor (Config. IA)
  const { getAllowedModels } = await import('../models/route')
  const allowed = getAllowedModels()
  const chosen = allowed.find((m) => m.model === model)?.model
    ?? allowed[0].model
    ?? process.env.AI_MODEL
    ?? 'auto'

  // Regras personalizadas do titular: entradas/saídas com o próprio nome são
  // transferência entre contas; recebimentos da CFO Advisor são pró-labore
  // (valor pequeno) ou dividendos (valor grande).
  const titularRules = `
REGRAS DO TITULAR (aplicar ANTES das regras gerais, nesta ordem de prioridade):
1) Pagamento de fatura de cartão (descrição contém "pagamento fatura", "fatura cartão", "pgto fatura") → "Fatura Cartão".
2) RECEBIMENTO vindo de "CFO ADVISOR" (ou "CFO Advisor", "Cfoadvisor"):
   - valor <= R$ ${proLaboreMax.toFixed(2)} → "Pró-labore"
   - valor > R$ ${proLaboreMax.toFixed(2)} → "Dividendos"
${holderNames.length > 0 ? `3) Se a descrição citar o PRÓPRIO TITULAR (${holderNames.join(', ')}) → é movimentação entre contas do mesmo titular: use "Transferência" (vale para entrada E saída).
` : ''}Nunca use "Transferência" fora do caso 3. Em especial, "Pagamento Fatura - <nome do titular>" continua sendo "Fatura Cartão", NÃO transferência.`

  // Lista permitida desta chamada: oficiais + categorias do usuário
  const allowedCategories = [...new Set([...AI_CATEGORIES, ...customCategories])]

  // Regras do usuário (por emissor) têm prioridade máxima, pois são a
  // configuração explícita dele no Config. IA.
  const customRulesBlock = customRules.length > 0
    ? `\nREGRAS DO USUÁRIO (PRIORIDADE MÁXIMA — aplique antes de qualquer outra regra):\n${customRules.map((r, i) => `${i + 1}) Se a descrição contiver "${r.match}" → "${r.category}".`).join('\n')}\n`
    : ''

  const prompt = `Você é um classificador de transações financeiras de extratos bancários brasileiros.
Para cada transação, escolha EXATAMENTE UMA categoria da lista permitida, considerando o tipo (receita/despesa/investimento).

Categorias permitidas:
${allowedCategories.join(', ')}
${customRulesBlock}${titularRules}

Regras:
- Responda APENAS um objeto JSON válido, sem markdown, sem comentários.
- Formato: {"resultados":[{"index":<número inteiro da transação>,"categoria":"<categoria da lista>"}]}
- Se nada encaixar, use "Outros".
- Nunca invente categorias fora da lista.

Transações:
${items.map((i) => `${i.index}. [${i.type}] ${i.text}${typeof i.amount === 'number' ? ` | R$ ${i.amount.toFixed(2)}` : ''}`).join('\n')}`

  try {
    const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: chosen,
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
    const valid = new Set(allowedCategories)
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
