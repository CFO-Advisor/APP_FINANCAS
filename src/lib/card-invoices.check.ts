// Self-check da conciliação de fatura de cartão.
// Run: npx tsx src/lib/card-invoices.check.ts
//
// O pagamento da fatura vive no extrato do banco; o valor devido vive na fatura
// do cartão. Conciliar = reconhecer que um quitou a outra, sem mexer em saldo.
// Os casos abaixo usam valores reais do extrato da Inter.
import * as assert from 'node:assert'
import {
  buildCardInvoices,
  findInvoiceCandidates,
  invoiceDueDate,
  invoiceStatus,
  isCardPayment,
  pendingPayments,
  suggestInvoiceMatches,
  type CardPaymentRow,
} from './card-invoices'
import type { CreditCard } from './types'

const CARTAO_INTER: CreditCard = {
  id: 'cartao-inter',
  user_id: 'celio',
  name: 'Inter',
  brand: 'mastercard' as CreditCard['brand'],
  color: '#f97316',
  credit_limit: 50_000,
  closing_day: 15,
  due_day: 20,
  created_at: '2026-01-01T00:00:00Z',
}

const CARTAO_NUBANK: CreditCard = { ...CARTAO_INTER, id: 'cartao-nubank', name: 'Nubank', closing_day: 5, due_day: 15 }

function tx(over: Partial<CardPaymentRow>): CardPaymentRow {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-03-15',
    amount: 0,
    description: '',
    type: 'expense',
    category: 'Compras',
    bank_id: null,
    credit_card_id: null,
    paid_invoice_date: null,
    ...over,
  }
}

// ── Vencimento ──────────────────────────────────────────────────────────────
// Fecha dia 15, vence dia 20: a fatura de 15/03 vence em 20/03 (mesmo mês).
assert.equal(invoiceDueDate('2026-03-15', 20), '2026-03-20', 'fecha 15/03 → vence 20/03')
// Fecha dia 5, vence dia 15: mesma regra.
assert.equal(invoiceDueDate('2026-03-05', 15), '2026-03-15', 'Nubank: fecha 05/03 → vence 15/03')
// Vencimento antes do fechamento só cabe no mês seguinte.
assert.equal(invoiceDueDate('2026-03-25', 20), '2026-04-20', 'fecha 25/03 → vence 20/04')

// ── Quem é pagamento de fatura ──────────────────────────────────────────────
assert.equal(isCardPayment({ type: 'credit_card_payment', category: 'Qualquer' }), true, 'tipo próprio conta')
assert.equal(isCardPayment({ type: 'expense', category: 'Fatura Cartão' }), true, 'categoria do extrato conta')
// O extrato da Inter traz "Cfo Advisor" marcado como Fatura Cartão, mas é ENTRADA:
// dinheiro que entrou não paga fatura.
assert.equal(isCardPayment({ type: 'income', category: 'Fatura Cartão' }), false, 'entrada não é pagamento')
assert.equal(isCardPayment({ type: 'transfer', category: 'Fatura Cartão' }), false, 'transferência não é pagamento')

// ── Status ─────────────────────────────────────────────────────────────────
assert.equal(invoiceStatus(9141.6, 9141.6), 'quitada', 'pago igual ao devido')
assert.equal(invoiceStatus(9141.6, 9141.6 - 0.03), 'quitada', 'arredondamento de centavos não invalida')
assert.equal(invoiceStatus(9141.6, 4000), 'parcial', 'pagou parte')
assert.equal(invoiceStatus(9141.6, 9500), 'excedente', 'pagou a mais')
assert.equal(invoiceStatus(9141.6, 0), 'aberta', 'nada pago')

// ── Fatura montada a partir das compras ────────────────────────────────────
const COMPRAS: CardPaymentRow[] = [
  tx({ date: '2026-03-15', amount: 6000, credit_card_id: CARTAO_INTER.id }),
  tx({ date: '2026-03-15', amount: 3141.6, credit_card_id: CARTAO_INTER.id }),
  tx({ date: '2026-02-15', amount: 10806.49, credit_card_id: CARTAO_INTER.id }),
]
const PAGAMENTO_MARCO = tx({
  date: '2026-03-20',
  amount: 9141.6,
  description: 'Pagamento Fatura - CELIO GADELHA DE OLIVEIRA',
  category: 'Fatura Cartão',
  bank_id: 'conta-inter',
})

const faturas = buildCardInvoices(CARTAO_INTER, [...COMPRAS, PAGAMENTO_MARCO])
assert.equal(faturas.length, 2, 'duas faturas: 15/03 e 15/02')
assert.equal(faturas[0].date, '2026-03-15', 'mais recente primeiro')
assert.equal(faturas[0].total, 9141.6, 'valor devido da fatura de março')
assert.equal(faturas[0].expenseCount, 2, 'duas compras compõem a fatura')
assert.equal(faturas[0].paid, 0, 'pagamento ainda não vinculado não conta como pago')
assert.equal(faturas[0].status, 'aberta', 'fatura sem vínculo aparece aberta')
assert.equal(faturas[1].total, 10806.49, 'valor devido da fatura de fevereiro')

// ── Fila de pagamentos pendentes ───────────────────────────────────────────
const pendentes = pendingPayments([...COMPRAS, PAGAMENTO_MARCO])
assert.equal(pendentes.length, 1, 'só o pagamento entra na fila')
assert.equal(pendentes[0].amount, 9141.6, 'valor preservado')
assert.equal(pendentes[0].paid_invoice_date, null, 'sem fatura vinculada')

// ── Sugestão inequívoca ────────────────────────────────────────────────────
const sugestoes = suggestInvoiceMatches(pendentes, faturas)
assert.equal(sugestoes.length, 1, 'par único é sugerido')
assert.equal(sugestoes[0].invoice.date, '2026-03-15', 'casou com a fatura de março')
assert.equal(sugestoes[0].payment.date, '2026-03-20', 'pagamento no vencimento')

// ── Ambiguidade vai para decisão manual ────────────────────────────────────
const duasIguais = [
  tx({ id: 'p1', date: '2026-03-20', amount: 9141.6, category: 'Fatura Cartão' }),
  tx({ id: 'p2', date: '2026-03-21', amount: 9141.6, category: 'Fatura Cartão' }),
]
const filaAmbigua = pendingPayments(duasIguais)
assert.equal(filaAmbigua.length, 2, 'dois pagamentos na fila')
// Cada um vê a fatura como candidata (valor e data batem)...
assert.equal(findInvoiceCandidates(filaAmbigua[0], faturas).length, 1, 'fatura é candidata')
assert.equal(findInvoiceCandidates(filaAmbigua[1], faturas).length, 1, 'fatura é candidata')
// ...mas nenhum é sugerido: a fatura está disputada por dois pagamentos.
assert.equal(suggestInvoiceMatches(filaAmbigua, faturas).length, 0, 'disputa não é sugerida automaticamente')

// ── Valor diferente não casa (pagamento parcial) ───────────────────────────
const parcial = pendingPayments([tx({ date: '2026-03-20', amount: 4000, category: 'Fatura Cartão' })])
assert.equal(findInvoiceCandidates(parcial[0], faturas).length, 0, 'valor diferente não é par')
assert.equal(suggestInvoiceMatches(parcial, faturas).length, 0, 'parcial fica para decisão manual')

// ── Fatura de outro cartão não casa ────────────────────────────────────────
const faturasNubank = buildCardInvoices(CARTAO_NUBANK, [
  tx({ date: '2026-03-05', amount: 9141.6, credit_card_id: CARTAO_NUBANK.id }),
])
const comCartao = pendingPayments([
  tx({ date: '2026-03-20', amount: 9141.6, category: 'Fatura Cartão', credit_card_id: CARTAO_INTER.id }),
])
assert.equal(
  findInvoiceCandidates(comCartao[0], faturasNubank).length,
  0,
  'pagamento do cartão Inter não casa com fatura do Nubank',
)

// ── Pagamento já vinculado sai da fila e passa a contar como pago ──────────
const vinculado = tx({
  date: '2026-03-20',
  amount: 9141.6,
  category: 'Fatura Cartão',
  credit_card_id: CARTAO_INTER.id,
  paid_invoice_date: '2026-03-15',
})
assert.equal(pendingPayments([vinculado]).length, 0, 'vinculado não fica pendente')
const faturasComPagamento = buildCardInvoices(CARTAO_INTER, [...COMPRAS, vinculado])
assert.equal(faturasComPagamento[0].paid, 9141.6, 'vinculado conta como pago')
assert.equal(faturasComPagamento[0].difference, 0, 'devido = pago')
assert.equal(faturasComPagamento[0].status, 'quitada', 'fatura quitada')

// ── Fatura sem pagamento algum continua aberta ─────────────────────────────
const fev = faturasComPagamento.find((f) => f.date === '2026-02-15')!
assert.equal(fev.status, 'aberta', 'fevereiro segue em aberto')
assert.equal(fev.dueDate, '2026-02-20', 'vencimento de fevereiro')

console.log('card-invoices.check: OK (vencimento, status, fila, sugestão única e ambiguidade preservada)')
