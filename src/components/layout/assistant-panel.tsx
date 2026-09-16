'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, X, SendHorizontal, Loader2, Bot, ChevronRight, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { extractStatementLines } from '@/lib/import/pdf'
import { AI_MODEL_KEY, addCustomCategory } from '@/lib/ai-config'
import { createClient } from '@/lib/supabase/client'
import { BANK_PRESETS } from '@/lib/constants'

// Painel do assistente de IA (retrátil, lado direito).
// Chat via /api/ai/assistant (chave/modelo ficam no servidor).
// Ações do agente:
// - navegar → router.push (whitelist validada no servidor)
// - abrir_transacao → navega p/ /transactions e publica evento que abre o
//   formulário pré-preenchido; o usuário confere e salva manualmente.

export const AI_PREFILL_EVENT = 'ai:prefill-transaction'
export const AI_PREFILL_STORAGE = 'ai_pending_prefill'
export const AI_MODEL_PREF_KEY = AI_MODEL_KEY
export const AI_OPEN_IMPORT_EVENT = 'ai:open-import'
export const AI_CATEGORY_CREATED_EVENT = 'ai:category-created'
export const AI_BANKS_CHANGED_EVENT = 'ai:banks-changed'
export const AI_CARDS_CHANGED_EVENT = 'ai:cards-changed'

// Arquivo pendente de importação (CSV/XLSX/OFX) escolhido no assistente.
// Vive em memória (o painel persiste entre rotas por estar no layout).
let pendingImportFile: File | null = null
export function consumePendingImportFile(): File | null {
  const f = pendingImportFile
  pendingImportFile = null
  return f
}

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

interface AiAction {
  acao: string
  href?: string
  payload?: Record<string, unknown>
  nome?: string
  tipo?: string
  saldo_inicial?: number
  bandeira?: string
  limite?: number
  dia_fechamento?: number
  dia_vencimento?: number
}

const SUGGESTIONS = [
  'Quero lançar uma despesa de R$ 50 de almoço',
  'Onde cadastro um cartão de crédito?',
  'Como importar um extrato do banco Inter?',
  'O que tem no meu balanço patrimonial?',
]

export function AssistantPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const runAction = useCallback((action: AiAction) => {
    if (action.acao === 'navegar' && action.href) {
      router.push(action.href)
    } else if (action.acao === 'abrir_transacao' && action.payload) {
      // Guarda o prefill e navega; a página de transações pega no mount.
      try { sessionStorage.setItem(AI_PREFILL_STORAGE, JSON.stringify(action.payload)) } catch { /* ignore */ }
      router.push('/transactions')
      window.dispatchEvent(new CustomEvent(AI_PREFILL_EVENT, { detail: action.payload }))
    } else if (action.acao === 'criar_categoria' && typeof action.nome === 'string') {
      // Categoria nova pedida explicitamente pelo usuário no chat. Grava no
      // localStorage (mesma estrutura da tela de Transações) e avisa a página
      // para atualizar a lista sem recarregar.
      const tipo = action.tipo === 'income' || action.tipo === 'investment' ? action.tipo : 'expense'
      const result = addCustomCategory(action.nome, tipo)
      if (result === 'created') {
        window.dispatchEvent(new CustomEvent(AI_CATEGORY_CREATED_EVENT, { detail: { name: action.nome, type: tipo } }))
        toast.success(`Categoria "${action.nome}" criada.`)
      } else if (result === 'exists') {
        toast.info(`A categoria "${action.nome}" já existe.`)
      } else {
        toast.error('Não consegui criar a categoria — nome inválido.')
      }
    } else if (action.acao === 'criar_banco' && typeof action.nome === 'string') {
      // Banco pedido explicitamente pelo usuário no chat. Insert direto via
      // Supabase (RLS garante que é conta do próprio usuário) + recarrega a
      // página de Bancos se estiver aberta.
      void (async () => {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) { toast.error('Não autenticado.'); return }
          const nome = action.nome as string
          const preset = BANK_PRESETS.find((b) => nome.toLowerCase().includes(b.name.toLowerCase()))
          const { error } = await supabase.from('banks').insert({
            user_id: user.id,
            name: nome,
            type: action.tipo === 'savings' || action.tipo === 'investment' || action.tipo === 'wallet' ? action.tipo : 'checking',
            initial_balance: typeof action.saldo_inicial === 'number' && action.saldo_inicial >= 0 ? action.saldo_inicial : 0,
            color: preset?.color ?? '#6366f1',
          })
          if (error) throw error
          window.dispatchEvent(new CustomEvent(AI_BANKS_CHANGED_EVENT))
          toast.success(`Banco "${nome}" cadastrado.`)
          router.push('/banks')
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Falha ao cadastrar o banco.')
        }
      })()
    } else if (action.acao === 'criar_cartao' && typeof action.nome === 'string') {
      // Cartão pedido explicitamente pelo usuário no chat. Mesmo padrão do
      // formulário de cartões (dias de fechamento/vencimento entre 1 e 28).
      void (async () => {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) { toast.error('Não autenticado.'); return }
          const nome = action.nome as string
          const bandeira = action.bandeira === 'visa' || action.bandeira === 'mastercard' || action.bandeira === 'elo' || action.bandeira === 'amex' || action.bandeira === 'hipercard' ? action.bandeira : 'outros'
          const { error } = await supabase.from('credit_cards').insert({
            user_id: user.id,
            name: nome,
            brand: bandeira,
            color: '#6366f1',
            credit_limit: typeof action.limite === 'number' && action.limite >= 0 ? action.limite : 0,
            closing_day: typeof action.dia_fechamento === 'number' ? action.dia_fechamento : 5,
            due_day: typeof action.dia_vencimento === 'number' ? action.dia_vencimento : 15,
          })
          if (error) throw error
          window.dispatchEvent(new CustomEvent(AI_CARDS_CHANGED_EVENT))
          toast.success(`Cartão "${nome}" cadastrado.`)
          router.push('/credit-cards')
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Falha ao cadastrar o cartão.')
        }
      })()
    }
  }, [router])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: typeof window !== 'undefined' ? localStorage.getItem(AI_MODEL_PREF_KEY) ?? undefined : undefined,
          messages: next.map((m) => (m.role === 'user' ? { role: m.role, content: m.content, page: pathname } : { role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.reply ?? '…' }])
      if (data.action) runAction(data.action)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha inesperada.'
      setMessages([...next, { role: 'assistant', content: `⚠️ ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  // Anexo: CSV/XLSX/OFX → abre o diálogo de importação na página de transações.
  // PDF/foto → IA extrai e classifica a transação e abre o formulário pré-preenchido.
  async function handleAttachment(f: File) {
    if (analyzing) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    try {
      if (['csv', 'txt', 'xlsx', 'xls', 'ofx'].includes(ext)) {
        pendingImportFile = f
        router.push('/transactions')
        window.dispatchEvent(new CustomEvent(AI_OPEN_IMPORT_EVENT))
        setMessages((prev) => [...prev, { role: 'assistant', content: `📎 Arquivo ${f.name} recebido — abrindo a importação de extrato…` }])
        return
      }
      // PDF ou imagem → análise por IA
      setAnalyzing(true)
      setMessages((prev) => [...prev, { role: 'assistant', content: `📎 Analisando ${f.name}…` }])
      let payload: Record<string, unknown>
      const model = typeof window !== 'undefined' ? localStorage.getItem(AI_MODEL_PREF_KEY) ?? undefined : undefined
      if (ext === 'pdf') {
        const buffer = await f.arrayBuffer()
        const lines = await extractStatementLines(buffer)
        const res = await fetch('/api/ai/document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: lines.join('\n'), model }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Falha na análise.')
        payload = data.payload
      } else if (f.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result))
          r.onerror = () => reject(new Error('Falha ao ler a imagem.'))
          r.readAsDataURL(f)
        })
        const res = await fetch('/api/ai/document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl.split(',')[1], mime: f.type, model }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Falha na análise.')
        payload = data.payload
      } else {
        throw new Error('Formato não suportado. Envie CSV, PDF ou foto.')
      }
      const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(payload.amount ?? 0))
      setMessages((prev) => [...prev, { role: 'assistant', content: `✅ Documento lido:\n• ${payload.description || '—'}\n• ${fmt}\n• Categoria: ${payload.category || 'a escolher'}\nAbrindo o formulário para você confirmar…` }])
      try { sessionStorage.setItem(AI_PREFILL_STORAGE, JSON.stringify(payload)) } catch { /* ignore */ }
      router.push('/transactions')
      window.dispatchEvent(new CustomEvent(AI_PREFILL_EVENT, { detail: payload }))
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Falha inesperada.'}` }])
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <>
      {/* Botão flutuante para abrir */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
          title="Assistente IA"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      {/* Painel retrátil */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[min(92vw,380px)] flex-col border-l border-border bg-sidebar shadow-2xl transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-none">Assistente IA</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">CFO Advisor Finanças</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="space-y-3 pt-6 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary/60" />
              <p className="text-sm text-muted-foreground">
                Pergunte qualquer coisa sobre o app, ou peça para lançar uma transação.
              </p>
              <div className="space-y-1.5 pt-2 text-left">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <ChevronRight className="h-3 w-3 shrink-0 text-primary/70" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'rounded-br-sm bg-primary text-primary-foreground'
                    : 'rounded-bl-sm bg-card text-card-foreground border border-border'
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border p-3">
          {analyzing && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Analisando documento…
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.ofx,.pdf,image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAttachment(f); e.target.value = '' }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={analyzing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              title="Anexar extrato CSV ou documento/foto de despesa"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              rows={1}
              placeholder="Ex.: lançar receita de R$ 5.000 de freelance"
              className="max-h-28 flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
            />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => send()} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Pode navegar e pré-preencher formulários. Transações são salvas só após sua confirmação.
          </p>
        </div>
      </aside>
    </>
  )
}
