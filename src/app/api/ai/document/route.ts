import { NextRequest, NextResponse } from 'next/server'
import { callAi } from '@/lib/ai-provider'
import { createClient } from '@/lib/supabase/server'
import { getAllowedModels, type AllowedModel } from '../models/route'
import { CATEGORIES } from '@/lib/constants'

// Análise de documentos (foto/PDF-texto) para extrair uma transação.
// - Foto: enviada como image data URL para modelo com visão.
// - PDF: o cliente extrai o texto (pdfjs) e envia como texto.
// Retorna um payload de pré-preenchimento (igual ao abrir_transacao do
// assistente). O usuário confirma no formulário — nada é salvo aqui.

export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 90000

const SYSTEM_PROMPT = `Você extrai dados de transação de documentos financeiros brasileiros (notas fiscais, recibos, comprovantes, extratos).
Analise o documento e devolva APENAS um objeto JSON válido, sem markdown, no formato:
{"description":"","amount":0,"category":"","date":"YYYY-MM-DD","type":"expense"}
Regras:
- amount: número em reais sem "R$", use ponto decimal (ex.: 123.45).
- category: escolha EXATAMENTE uma da lista: ${CATEGORIES.join(', ')}.
- date: YYYY-MM-DD do documento; se não houver, use "" (o app preenche hoje).
- type: "expense" (a menos que seja claramente um recibo de receita → "income").
- description: nome do estabelecimento/favorecido + referência curta.
- Se não houver valor identificável, devolva amount: 0.
Responda em português nas descrições.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const timeoutMs = TIMEOUT_MS

  let text = ''
  let imageBase64 = ''
  let mime = 'image/jpeg'
  let model: string | undefined
  try {
    const body = await req.json()
    text = typeof body.text === 'string' ? body.text.slice(0, 20000) : ''
    imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
    if (typeof body.mime === 'string' && body.mime.startsWith('image/')) mime = body.mime
    model = typeof body.model === 'string' ? body.model : undefined
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }
  if (!text && !imageBase64) return NextResponse.json({ error: 'Documento vazio.' }, { status: 400 })

  const allowed = getAllowedModels()
  const chosen = allowed.find((m: AllowedModel) => m.model === model)?.model ?? allowed[0].model

  const userContent: (Record<string, unknown>)[] = [{ type: 'text', text: 'Extraia a transação deste documento.' }]
  if (text) userContent.push({ type: 'text', text: `Texto extraído do documento:\n${text}` })
  if (imageBase64) {
    userContent.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } })
  }

  try {
    let content: string
    try {
      content = await callAi({
        model: chosen,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0,
        maxTokens: 600,
        timeoutMs,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erro desconhecido'
      const hint = msg.includes('402') ? ' (créditos insuficientes no provedor — troque o modelo em Config. IA)'
        : msg.includes('400') && chosen === 'free-1m' ? ' (este modelo pode não suportar imagens — troque em Config. IA)' : ''
      return NextResponse.json({ error: `Provedor respondeu ${msg}.${hint}`.slice(0, 300) }, { status: 502 })
    }
    const m = content.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ error: 'Não consegui extrair dados do documento.' }, { status: 422 })
    const parsed = JSON.parse(m[0])
    return NextResponse.json({
      payload: {
        type: parsed.type === 'income' ? 'income' : 'expense',
        description: typeof parsed.description === 'string' ? parsed.description : '',
        amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : 0,
        category: CATEGORIES.includes(parsed.category) ? parsed.category : '',
        date: typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : '',
      },
    })
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'Tempo esgotado analisando o documento.' : 'Falha ao contatar o provedor de IA.'
    return NextResponse.json({ error: msg }, { status: 504 })
  }
}
