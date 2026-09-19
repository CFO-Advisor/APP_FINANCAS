import type { Transaction } from './types'

// ── Transferências ──────────────────────────────────────────────────────────
// Semântica de `transfer_dir` (SEMPRE relativa ao `bank_id`):
//   'out' = o dinheiro SAIU da conta em bank_id
//   'in'  = o dinheiro ENTROU na conta em bank_id
//
// `transfer_bank_id` pode ser NULL: na importação a contrapartida nem sempre é
// conhecida, e adivinhar gera saldo errado. Sem contrapartida, a transferência
// afeta apenas a conta do extrato — exatamente o que se sabe com certeza.
//
// Toda leitura de transferência deve passar por aqui: é o único lugar que
// traduz a direção para efeito de saldo.

export interface TransferEffect {
  /** true se o dinheiro ENTROU nesta conta; false se saiu */
  isInflow: boolean
  /** A outra ponta da transferência (null = contrapartida não informada) */
  otherAccountId: string | null
}

export function transferEffect(
  t: Pick<Transaction, 'bank_id' | 'transfer_bank_id' | 'transfer_dir'>,
  accountId: string,
): TransferEffect | null {
  const dirIn = t.transfer_dir === 'in'
  if (t.bank_id === accountId) {
    return { isInflow: dirIn, otherAccountId: t.transfer_bank_id ?? null }
  }
  if (t.transfer_bank_id === accountId) {
    // A outra ponta recebe o efeito inverso
    return { isInflow: !dirIn, otherAccountId: t.bank_id }
  }
  return null
}

/**
 * Soma os efeitos de transferência por conta (entradas e saídas separadas).
 * Usado para calcular saldo de conta bancária em dashboard, bancos e balanço.
 */
export function accumulateTransferEffects(
  rows: Pick<Transaction, 'bank_id' | 'transfer_bank_id' | 'transfer_dir' | 'amount' | 'type' | 'credit_card_id'>[],
): { inflow: Record<string, number>; outflow: Record<string, number> } {
  const inflow: Record<string, number> = {}
  const outflow: Record<string, number> = {}
  for (const t of rows) {
    if (t.type !== 'transfer') continue
    const dirIn = t.transfer_dir === 'in'
    if (t.bank_id) {
      const target = dirIn ? inflow : outflow
      target[t.bank_id] = (target[t.bank_id] ?? 0) + t.amount
    }
    if (t.transfer_bank_id) {
      const target = dirIn ? outflow : inflow
      target[t.transfer_bank_id] = (target[t.transfer_bank_id] ?? 0) + t.amount
    }
  }
  return { inflow, outflow }
}

/**
 * Ordem visual de uma transferência: de qual conta o dinheiro saiu e para qual
 * entrou. Com contrapartida pendente, o lado desconhecido vem como null.
 */
export function transferSides(
  t: Pick<Transaction, 'bank_id' | 'transfer_bank_id' | 'transfer_dir'>,
): { from: string | null; to: string | null } {
  const dirIn = t.transfer_dir === 'in'
  return dirIn
    ? { from: t.transfer_bank_id ?? null, to: t.bank_id }
    : { from: t.bank_id, to: t.transfer_bank_id ?? null }
}
