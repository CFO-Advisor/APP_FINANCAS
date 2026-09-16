import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllowedModels } from '../../ai/models/route'

// Assistente de IA do app: chat + ações controladas (navegar, abrir formulário
// pré-preenchido, responder perguntas sobre as páginas do app).
//
// Segurança:
// - Chave da IA só no servidor; cliente nunca a vê.
// - Requer sessão autenticada.
// - O agente NÃO grava nada no banco: só devolve "ações" que o cliente
//   executa via UI (navegação/abertura de formulário pré-preenchido) e o
//   usuário confirma visualmente. Insert/update continuam sendo feitos pelos
//   fluxos normais do app com RLS do Supabase.
// - Rotas permitidas: whitelist fixa (o agente não pode navegar fora do app).

export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 60000

// Whitelist de navegação — espelha a sidebar do app
export const APP_ROUTES: { href: string; label: string; description: string }[] = [
  { href: '/dashboard', label: 'Dashboard', description: 'Visão geral: saldos, receitas, despesas e gráficos do mês' },
  { href: '/transactions', label: 'Transações', description: 'Listar, criar, editar, importar e exportar transações (receitas, despesas, investimentos)' },
  { href: '/budget', label: 'Orçamento', description: 'Metas de gastos por categoria e acompanhamento' },
  { href: '/investments', label: 'Investimentos', description: 'Carteira de investimentos e posições (espelho do app Investor)' },
  { href: '/debts', label: 'Dívidas e Contas', description: 'Empréstimos, financiamentos, contas a pagar' },
  { href: '/assets', label: 'Bens e Direitos', description: 'Patrimônio: imóveis, veículos, direitos' },
  { href: '/balance', label: 'Balanço', description: 'Balanço patrimonial e evolução do patrimônio' },
  { href: '/banks', label: 'Bancos', description: 'Cadastro de contas bancárias' },
  { href: '/credit-cards', label: 'Cartões', description: 'Cadastro de cartões de crédito e faturas' },
  { href: '/calculadora', label: 'Calculadora', description: 'Calculadoras financeiras (juros, aportes, etc.)' },
]

const SYSTEM_PROMPT = `Você é o assistente financeiro do app CFO Advisor Finanças Pessoais.
Ajuda o usuário a usar o app, responde perguntas financeiras e pré-preenche formulários.
Data de hoje: ${new Date().toISOString().slice(0, 10)} (use esta data quando o usuário disser "hoje").

Você PODE responder com:
1. Mensagem em texto (markdown simples) para o usuário.
2. Ações no app, APENAS no formato de objeto JSON:
{"acao":"navegar","href":"/rota"}
{"acao":"abrir_transacao","payload":{"type":"expense|income|investment","description":"","amount":0,"category":"","date":"YYYY-MM-DD","bank":"nome do banco cadastrado do usuário, se ele pediu"}}
{"acao":"criar_categoria","nome":"<nome da categoria>","tipo":"expense|income|investment"}

Regras:
- Para "levar o usuário a uma tela", use acao navegar com href da lista de rotas válidas abaixo. NUNCA invente hrefs.
- Para "criar/lançar uma transação", use acao abrir_transacao com os campos que você souber (deixe os outros em branco/0). Se o usuário mencionar o banco, preencha "bank" com EXATAMENTE o nome de um dos bancos cadastrados listados abaixo (ou vazio se não souber). O app abrirá o formulário pré-preenchido para o usuário confirmar — você não salva nada diretamente.
- Para "criar uma categoria nova", use acao criar_categoria SOMENTE quando o usuário pedir explicitamente; infera o tipo (receita → income, investimento → investment, caso contrário expense) e use nome curto (máx. 40 caracteres). Confirme o resultado em texto depois.
- Categorias válidas: use as categorias padrão do app (Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Salário, Imposto, Outros, etc.).
- Amount é número decimal em reais, sem "R$".
- Responda SEMPRE em português brasileiro, direto e útil.
- Se pedir algo fora do app (assuntos não relacionados a finanças/app), responda com educação e reoriente para o uso do app.

Rotas válidas:
${APP_ROUTES.map((r) => `${r.href} — ${r.label}: ${r.description}`).join('\n')}`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  // contexto da página ativa, enviado pelo cliente (não confiável, só informativo)
  page?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_API_BASE
  if (!apiKey || !baseUrl) {
    return NextResponse.json({ error: 'IA não configurada no servidor.' }, { status: 503 })
  }

  let messages: ChatMessage[]
  let model: string | undefined
  try {
    const body = await req.json()
    messages = Array.isArray(body.messages) ? body.messages.slice(-24) : []
    model = typeof body.model === 'string' ? body.model : undefined
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }
  if (messages.length === 0) return NextResponse.json({ error: 'Sem mensagens.' }, { status: 400 })

  // Modelo: só aceita se estiver na whitelist
  const allowed = getAllowedModels()
  const chosen = allowed.find((m) => m.model === model)?.model ?? allowed[0].model

  const llmMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role,
      content: m.page ? `[página ativa: ${m.page}]\n${m.content}` : m.content,
    })),
  ]

  // Bancos cadastrados do usuário (para o agente preencher "bank" corretamente)
  try {
    const { data: banks } = await supabase.from('banks').select('name').order('name')
    if (banks && banks.length > 0) {
      llmMessages[0] = {
        ...llmMessages[0],
        content: `${llmMessages[0].content}\n\nBancos cadastrados do usuário: ${banks.map((b) => b.name).join(', ')}`,
      }
    }
  } catch { /* sem bancos → agente deixa "bank" vazio */ }

  try {
    const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: chosen,
        messages: llmMessages,
        temperature: 0.4,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!resp.ok) {
      return NextResponse.json({ error: `Provedor de IA respondeu HTTP ${resp.status}.` }, { status: 502 })
    }
    const data = await resp.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''

    // Extrai ação JSON se existir. O modelo pode devolver o JSON dentro de
    // blocos ```json ...``` e o objeto tem aninhamento (payload) — usa um
    // scanner de chaves balanceadas em vez de regex guloso.
    let action: Record<string, unknown> | null = null
    let actionSpan: [number, number] | null = null
    function tryParseAction(jsonStr: string): Record<string, unknown> | null {
      try {
        const parsed = JSON.parse(jsonStr)
        if (parsed?.acao === 'navegar' && APP_ROUTES.some((r) => r.href === parsed.href)) return parsed
        if (parsed?.acao === 'abrir_transacao' && parsed.payload && typeof parsed.payload === 'object') return parsed
        if (parsed?.acao === 'criar_categoria') {
          const nome = typeof parsed.nome === 'string' ? parsed.nome.trim() : ''
          const tipo = parsed.tipo === 'income' || parsed.tipo === 'investment' ? parsed.tipo : 'expense'
          if (nome && nome.length <= 40 && !/[\r\n]/.test(nome)) {
            return { acao: 'criar_categoria', nome, tipo }
          }
        }
      } catch { /* não é a ação */ }
      return null
    }
    for (let i = content.indexOf('{'); i !== -1; i = content.indexOf('{', i + 1)) {
      let depth = 0
      let inStr = false
      for (let j = i; j < content.length; j++) {
        const ch = content[j]
        if (inStr) {
          if (ch === '\\') j++
          else if (ch === '"') inStr = false
          continue
        }
        if (ch === '"') inStr = true
        else if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) {
            const candidate = tryParseAction(content.slice(i, j + 1))
            if (candidate) {
              action = candidate
              actionSpan = [i, j + 1]
            }
            i = j // continua procurando a partir do fim deste bloco
            break
          }
        }
      }
    }
    const cleanText = actionSpan ? (content.slice(0, actionSpan[0]) + content.slice(actionSpan[1])).replace(/```[a-z]*\s*|```/g, '').trim() : content.trim()

    return NextResponse.json({ reply: cleanText || (action ? 'Certo, abrindo…' : '…'), action, model: chosen })
  } catch {
    return NextResponse.json({ error: 'Tempo esgotado ou falha ao contatar o provedor de IA.' }, { status: 504 })
  }
}
