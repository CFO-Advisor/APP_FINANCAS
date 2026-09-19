'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, ArrowRight, Wand2, CreditCard as CreditCardIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { getActiveOwnerId } from '@/lib/active-owner'
import { formatCurrency } from '@/lib/csv-export'
import {
  buildCardInvoices,
  findInvoiceCandidates,
  pendingPayments,
  suggestInvoiceMatches,
  type CardInvoice,
  type CardPaymentRow,
} from '@/lib/card-invoices'
import type { Bank, CreditCard } from '@/lib/types'

const STATUS_LABEL: Record<CardInvoice['status'], string> = {
  quitada: 'Quitada',
  parcial: 'Parcial',
  excedente: 'Pago a mais',
  aberta: 'Em aberto',
}

const STATUS_CLASS: Record<CardInvoice['status'], string> = {
  quitada: 'bg-emerald-500/10 text-emerald-600',
  parcial: 'bg-amber-500/10 text-amber-600',
  excedente: 'bg-sky-500/10 text-sky-600',
  aberta: 'bg-muted text-muted-foreground',
}

const invoiceKey = (inv: CardInvoice) => `${inv.card_id}|${inv.date}`

export function CardInvoicesPanel() {
  const [txs, setTxs] = useState<CardPaymentRow[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [choices, setChoices] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const ownerId = await getActiveOwnerId()
      const [txRes, cardsRes, banksRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id,date,amount,description,type,category,bank_id,credit_card_id,paid_invoice_date')
          .eq('user_id', ownerId)
          .order('date', { ascending: false }),
        supabase.from('credit_cards').select('*').eq('user_id', ownerId).order('name'),
        supabase.from('banks').select('*').eq('user_id', ownerId).order('name'),
      ])
      if (txRes.error) throw txRes.error
      setTxs((txRes.data ?? []) as CardPaymentRow[])
      setCards((cardsRes.data ?? []) as CreditCard[])
      setBanks((banksRes.data ?? []) as Bank[])
    } catch {
      toast.error('Não foi possível carregar as faturas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const cardName = (id: string | null) => (id ? cards.find((c) => c.id === id)?.name ?? '—' : '—')
  const bankName = (id: string | null) => (id ? banks.find((b) => b.id === id)?.name ?? '—' : '—')

  // Faturas de todos os cartões, da mais recente para a mais antiga.
  const invoices = useMemo(
    () =>
      cards
        .flatMap((c) => buildCardInvoices(c, txs))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [cards, txs],
  )
  const pending = useMemo(() => pendingPayments(txs), [txs])
  const quitadas = invoices.filter((i) => i.status === 'quitada').length
  // Só faz sentido conciliar contra faturas que já existem na base.
  const semFatura = cards.filter((c) => !invoices.some((i) => i.card_id === c.id))

  const byKey = useMemo(() => new Map(invoices.map((i) => [invoiceKey(i), i])), [invoices])

  /** Vínculo: o pagamento passa a apontar para o cartão e para a fatura quitada. */
  async function linkPayment(paymentId: string, invoice: CardInvoice) {
    const supabase = createClient()
    const ownerId = await getActiveOwnerId()
    const { error } = await supabase
      .from('transactions')
      .update({ credit_card_id: invoice.card_id, paid_invoice_date: invoice.date })
      .eq('user_id', ownerId)
      .eq('id', paymentId)
    if (error) throw error
  }

  async function linkOne(paymentId: string, key: string) {
    const invoice = byKey.get(key)
    if (!invoice) return
    setBusy(true)
    try {
      await linkPayment(paymentId, invoice)
      toast.success(`Pagamento vinculado à fatura de ${new Date(invoice.date + 'T00:00:00').toLocaleDateString('pt-BR')}.`)
      await load()
    } catch {
      toast.error('Falha ao conciliar. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function linkAllSuggestions() {
    const suggestions = suggestInvoiceMatches(pending, invoices)
    if (suggestions.length === 0) {
      toast.info('Nenhum par inequívoco encontrado — os casos abaixo precisam da sua decisão.')
      return
    }
    setBusy(true)
    try {
      for (const { payment, invoice } of suggestions) {
        await linkPayment(payment.id, invoice)
      }
      toast.success(`${suggestions.length} pagamento(s) conciliado(s) automaticamente.`)
      await load()
    } catch {
      toast.error('Alguma conciliação falhou. Recarregue e tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          Pagamentos na fila: <span className="font-semibold text-destructive">{pending.length}</span>
        </span>
        <span className="text-muted-foreground">
          Faturas na base: <span className="font-semibold text-foreground">{invoices.length}</span>
        </span>
        <span className="text-muted-foreground">
          Quitadas: <span className="font-semibold text-emerald-600">{quitadas}</span>
        </span>
        <Button size="sm" variant="outline" className="ml-auto gap-1.5 text-xs" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        {pending.length > 0 && invoices.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={linkAllSuggestions} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Conciliar pares inequívocos
          </Button>
        )}
      </div>

      {invoices.length === 0 && (
        <Card className="mb-4">
          <CardContent className="flex items-start gap-3 py-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Nenhuma fatura na base ainda</p>
              <p className="mt-1 text-muted-foreground">
                O valor devido vem das compras do cartão. Importe o arquivo da fatura (C6, Inter, Nubank)
                para o app saber quanto era devido — depois os pagamentos abaixo se encaixam sozinhos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pagamentos do extrato aguardando vínculo ─────────────────────── */}
      {pending.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Pagamentos no extrato ({pending.length})</CardTitle>
            <CardDescription>
              Saídas de caixa que quitam fatura. Vincule cada uma à fatura correspondente —
              o vínculo não altera saldo nem total de despesa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((p) => {
              const candidates = findInvoiceCandidates(p, invoices)
              // Sem candidato por valor/data, a escolha manual entre todas as
              // faturas continua possível (pagamento parcial, atraso, etc.).
              const options = candidates.length > 0 ? candidates : invoices
              const autoKey = candidates.length === 1 ? invoiceKey(candidates[0]) : ''
              const chosenKey = choices[p.id] ?? autoKey
              const chosen = byKey.get(chosenKey) ?? null
              return (
                <div key={p.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">{formatCurrency(p.amount)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      saiu de {bankName(p.bank_id)}
                    </span>
                    <span className="max-w-[260px] truncate text-xs text-muted-foreground/80">{p.description}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {invoices.length === 0 ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Sem fatura na base para comparar — importe o arquivo da fatura.
                      </span>
                    ) : (
                      <>
                        <Select
                          value={chosenKey}
                          onValueChange={(v) => v && setChoices((prev) => ({ ...prev, [p.id]: v }))}
                        >
                          <SelectTrigger className="h-8 w-[380px] text-xs">
                            <span className="flex flex-1 truncate text-left text-xs">
                              {chosen
                                ? `${cardName(chosen.card_id)} · fatura ${new Date(chosen.date + 'T00:00:00').toLocaleDateString('pt-BR')} · devido ${formatCurrency(chosen.total)}`
                                : '— escolher a fatura quitada'}
                            </span>
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {options.map((inv) => (
                              <SelectItem key={invoiceKey(inv)} value={invoiceKey(inv)} className="text-xs">
                                {cardName(inv.card_id)} · fatura {new Date(inv.date + 'T00:00:00').toLocaleDateString('pt-BR')} ·
                                {' '}vence {new Date(inv.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')} ·
                                {' '}devido {formatCurrency(inv.total)}
                                {inv.status !== 'aberta' ? ` (${STATUS_LABEL[inv.status].toLowerCase()})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          disabled={busy || !chosen}
                          onClick={() => chosen && void linkOne(p.id, chosenKey)}
                        >
                          Vincular <ArrowRight className="h-3 w-3" />
                        </Button>
                        {autoKey && <span className="text-[0.7rem] text-emerald-600">par inequívoco sugerido</span>}
                        {!autoKey && candidates.length === 0 && (
                          <span className="text-[0.7rem] text-muted-foreground">
                            Nenhuma fatura bate com este valor — escolha manualmente se for pagamento parcial.
                          </span>
                        )}
                        {candidates.length > 1 && (
                          <span className="text-[0.7rem] text-muted-foreground">
                            {candidates.length} faturas com o mesmo valor — escolha qual foi quitada
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Faturas por cartão ───────────────────────────────────────────── */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCardIcon className="h-4 w-4" />
              Faturas por cartão
            </CardTitle>
            <CardDescription>
              Valor devido = compras do ciclo. O status compara com o que já foi pago.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cards
              .filter((c) => invoices.some((i) => i.card_id === c.id))
              .map((c) => (
                <div key={c.id}>
                  <p className="mb-2 text-sm font-medium">{c.name}</p>
                  <div className="space-y-2">
                    {invoices
                      .filter((i) => i.card_id === c.id)
                      .map((inv) => (
                        <div
                          key={invoiceKey(inv)}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border px-3 py-2 text-xs"
                        >
                          <span className="text-muted-foreground">
                            Fatura de{' '}
                            <span className="font-medium text-foreground">
                              {new Date(inv.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            vence {new Date(inv.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-muted-foreground">
                            devido <span className="font-semibold tabular-nums text-foreground">{formatCurrency(inv.total)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            pago <span className="font-semibold tabular-nums text-foreground">{formatCurrency(inv.paid)}</span>
                          </span>
                          {inv.status !== 'quitada' && inv.paid > 0 && (
                            <span className="text-muted-foreground">
                              diferença{' '}
                              <span className="font-semibold tabular-nums text-destructive">
                                {formatCurrency(Math.abs(inv.difference))}
                              </span>
                            </span>
                          )}
                          <span className={`ml-auto rounded-full px-2 py-0.5 font-medium ${STATUS_CLASS[inv.status]}`}>
                            {STATUS_LABEL[inv.status]}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            {semFatura.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sem fatura importada: {semFatura.map((c) => c.name).join(', ')}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {pending.length === 0 && invoices.length > 0 && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              Todos os pagamentos de fatura do extrato já estão vinculados.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
