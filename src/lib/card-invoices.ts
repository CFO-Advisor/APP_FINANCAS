import type { CreditCard, Transaction } from './types'

/**
 * Conciliação de fatura de cartão.
 *
 * O pagamento da fatura aparece no extrato do BANCO (o dinheiro sai da conta);
 * o valor devido aparece na FATURA DO CARTÃO (a soma das compras do ciclo).
 * São dois registros em lugares diferentes — este módulo só reconhece que um
 * quitou o outro. Nada aqui altera saldo ou total: o vínculo é metadado.
 *
 * A fatura é "virtual": não existe tabela de faturas no app. Ela é identificada
 * pelo par (cartão, data da fatura) — a data dos registros de compra do cartão.
 */

/** Diferença aceitável entre pago e devido (arredondamento de centavos). */
export const INVOICE_AMOUNT_TOLERANCE = 0.05
/** Janela de dias entre o vencimento e o pagamento. */
export const INVOICE_DATE_TOLERANCE_DAYS = 10

export type InvoiceStatus = 'quitada' | 'parcial' | 'excedente' | 'aberta'

export interface CardInvoice {
  card_id: string
  /** Data de emissão da fatura (os registros do cartão entram por ela). */
  date: string
  /** Vencimento, derivado do due_day do cartão. */
  dueDate: string
  /** Valor devido: soma das compras do ciclo. */
  total: number
  expenseCount: number
  /** Pagamentos já vinculados a esta fatura (soma). */
  paid: number
  paymentIds: string[]
  /** pago − devido. Negativo = falta pagar; positivo = pagou a mais. */
  difference: number
  status: InvoiceStatus
}

/** Pagamento de fatura ainda sem cartão e/ou sem fatura reconhecida. */
export interface PendingPayment {
  id: string
  date: string
  amount: number
  description: string
  bank_id: string | null
  credit_card_id: string | null
  /** Fatura (data) a que foi vinculado, se já houver vínculo parcial. */
  paid_invoice_date: string | null
}

export type CardPaymentRow = Pick<
  Transaction,
  'id' | 'date' | 'amount' | 'description' | 'type' | 'category' | 'bank_id' | 'credit_card_id'
> & { paid_invoice_date?: string | null }

/**
 * Um lançamento é candidato a pagamento de fatura quando saiu dinheiro e ele
 * é do tipo próprio (`credit_card_payment`) ou veio do extrato já classificado
 * como "Fatura Cartão" — os dois jeitos coexistem na base hoje.
 * Entradas e transferências ficam de fora: pagar fatura é saída de caixa.
 */
export function isCardPayment(t: Pick<Transaction, 'type' | 'category'>): boolean {
  if (t.type === 'income' || t.type === 'transfer') return false
  return t.type === 'credit_card_payment' || t.category === 'Fatura Cartão'
}

/** Vencimento da fatura emitida em `invoiceDate` para um cartão com `dueDay`. */
export function invoiceDueDate(invoiceDate: string, dueDay: number): string {
  const [y, m, d] = invoiceDate.split('-').map(Number)
  // Vencimento normalmente cai no mesmo mês da emissão (fecha dia 15, vence dia
  // 20). Se o vencimento for antes do fechamento, ele é no mês seguinte.
  const rolls = dueDay < d
  // Date.UTC usa mês 0-indexado, então `m` já é o mês seguinte ao da emissão.
  const dueMonth = rolls ? m : m - 1
  const date = new Date(Date.UTC(y, dueMonth, dueDay))
  return date.toISOString().slice(0, 10)
}

export function invoiceStatus(due: number, paid: number, tolerance = INVOICE_AMOUNT_TOLERANCE): InvoiceStatus {
  if (paid <= 0) return 'aberta'
  if (Math.abs(paid - due) <= tolerance) return 'quitada'
  return paid < due ? 'parcial' : 'excedente'
}

/**
 * Faturas de um cartão, da mais recente para a mais antiga.
 * Só entram faturas que têm compras — o resto vem do próprio cartão.
 */
export function buildCardInvoices(
  card: CreditCard,
  transactions: CardPaymentRow[],
): CardInvoice[] {
  const cardTx = transactions.filter((t) => t.credit_card_id === card.id)
  // Um pagamento de fatura que veio do extrato está tipado como 'expense' com a
  // categoria "Fatura Cartão" — se entrasse aqui, inflaria o valor devido da
  // própria fatura que ele quita.
  const expenses = cardTx.filter((t) => t.type === 'expense' && !isCardPayment(t))
  const payments = cardTx.filter((t) => isCardPayment(t))

  const dates = [...new Set(expenses.map((t) => t.date))].sort().reverse()

  return dates.map((date) => {
    const list = expenses.filter((t) => t.date === date)
    const total = round(list.reduce((s, t) => s + Number(t.amount), 0))
    const linked = payments.filter((p) => p.paid_invoice_date === date)
    const paid = round(linked.reduce((s, p) => s + Number(p.amount), 0))
    return {
      card_id: card.id,
      date,
      dueDate: invoiceDueDate(date, card.due_day),
      total,
      expenseCount: list.length,
      paid,
      paymentIds: linked.map((p) => p.id),
      difference: round(paid - total),
      status: invoiceStatus(total, paid),
    }
  })
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  return Math.abs(Math.round((da - db) / 86_400_000))
}

/**
 * Pagamentos que ainda não foram atribuídos a uma fatura (falta cartão, falta
 * fatura, ou o valor não bate com nenhuma). É a fila de trabalho da tela.
 */
export function pendingPayments(transactions: CardPaymentRow[]): PendingPayment[] {
  return transactions
    .filter((t) => isCardPayment(t) && (!t.credit_card_id || !t.paid_invoice_date))
    .map((t) => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount),
      description: t.description,
      bank_id: t.bank_id ?? null,
      credit_card_id: t.credit_card_id ?? null,
      paid_invoice_date: t.paid_invoice_date ?? null,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export interface InvoiceMatch {
  payment: PendingPayment
  invoice: CardInvoice
}

/**
 * Candidatas para um pagamento: faturas do cartão cujo valor devido bate com o
 * pago e cujo vencimento está perto da data do pagamento.
 * Quando o pagamento já aponta um cartão, só esse cartão é considerado.
 */
export function findInvoiceCandidates(
  payment: PendingPayment,
  invoices: CardInvoice[],
): CardInvoice[] {
  return invoices
    .filter((inv) => !payment.credit_card_id || inv.card_id === payment.credit_card_id)
    .filter((inv) => Math.abs(inv.total - payment.amount) <= INVOICE_AMOUNT_TOLERANCE)
    .filter((inv) => daysBetween(inv.dueDate, payment.date) <= INVOICE_DATE_TOLERANCE_DAYS)
    .sort((a, b) => daysBetween(a.dueDate, payment.date) - daysBetween(b.dueDate, payment.date))
}

/**
 * Pares inequívocos: o pagamento tem exatamente UMA fatura candidata e essa
 * fatura não é disputada por outro pagamento. Ambíguo fica para decisão manual.
 */
export function suggestInvoiceMatches(
  payments: PendingPayment[],
  invoices: CardInvoice[],
): InvoiceMatch[] {
  const pool = payments.filter((p) => !p.paid_invoice_date)
  const matches: InvoiceMatch[] = []
  const takenInvoices = new Set<string>()
  const takenPayments = new Set<string>()

  // Uma fatura só pode ser quitada por um pagamento (salvo pagamento parcial,
  // que é decisão manual). Só sugere quando o par é único e simétrico.
  const counts = new Map<string, number>()
  for (const p of pool) {
    for (const inv of findInvoiceCandidates(p, invoices)) {
      const key = `${inv.card_id}|${inv.date}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  for (const p of pool) {
    const cands = findInvoiceCandidates(p, invoices).filter(
      (inv) => counts.get(`${inv.card_id}|${inv.date}`) === 1,
    )
    if (cands.length !== 1) continue
    const inv = cands[0]
    const key = `${inv.card_id}|${inv.date}`
    if (takenInvoices.has(key) || takenPayments.has(p.id)) continue
    takenInvoices.add(key)
    takenPayments.add(p.id)
    matches.push({ payment: p, invoice: inv })
  }
  return matches
}
