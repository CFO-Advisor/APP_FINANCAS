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
  // A contrapartida é METADADO: a transferência pertence ao extrato de uma
  // conta (bank_id) e afeta só essa conta. O outro lado aparece no extrato
  // dele, com a linha dele — não é recalculado aqui.
  if (t.bank_id !== accountId) return null
  return { isInflow: t.transfer_dir === 'in', otherAccountId: t.transfer_bank_id ?? null }
}

/**
 * Soma os efeitos de transferência por conta (entradas e saídas separadas).
 * Usado para calcular saldo de conta bancária em dashboard, bancos e balanço.
 */
export function accumulateTransferEffects(
  rows: Pick<Transaction, 'bank_id' | 'transfer_bank_id' | 'transfer_dir' | 'amount' | 'type'>[],
): { inflow: Record<string, number>; outflow: Record<string, number> } {
  const inflow: Record<string, number> = {}
  const outflow: Record<string, number> = {}
  for (const t of rows) {
    if (t.type !== 'transfer') continue
    if (!t.bank_id) continue
    const target = t.transfer_dir === 'in' ? inflow : outflow
    target[t.bank_id] = (target[t.bank_id] ?? 0) + t.amount
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

// ── Conciliação (rotina posterior à importação) ─────────────────────────────
// Cada lado da transferência mora no extrato da sua conta. Conciliar é apenas
// RECONHECER que duas linhas de contas diferentes são o mesmo evento — o
// vínculo não altera saldo nenhum.

/** Linha mínima para o pareamento. */
export interface TransferRow {
  id: string
  bank_id: string | null
  transfer_bank_id: string | null
  transfer_dir: 'out' | 'in' | null
  amount: number
  date: string
}

/** Tolerância de datas: PIX cai no mesmo dia, TED/DOC pode virar o dia útil. */
export const PAIR_DATE_TOLERANCE_DAYS = 3

function daysApart(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY
  return Math.abs(da - db) / 86_400_000
}

/**
 * Candidatos a par de uma transferência: mesma quantia, contas diferentes,
 * **lados opostos** (uma saída de um lado é entrada do outro) e datas próximas.
 * Nunca casa a mesma conta consigo mesma.
 */
export function findTransferCandidates(row: TransferRow, all: TransferRow[]): TransferRow[] {
  if (!row.bank_id) return []
  const rowIn = row.transfer_dir === 'in'
  return all.filter((c) => {
    if (c.id === row.id) return false
    if (!c.bank_id || c.bank_id === row.bank_id) return false
    if (c.amount !== row.amount) return false
    if ((c.transfer_dir === 'in') === rowIn) return false
    if (daysApart(row.date, c.date) > PAIR_DATE_TOLERANCE_DAYS) return false
    return true
  })
}

/**
 * Pares inequívocos: cada linha tem exatamente um candidato e ambos apontam um
 * para o outro. Só o que é inequívoco entra como sugestão automática —
 * ambíguo vai para decisão do usuário (valores repetidos são comuns).
 */
export function suggestTransferPairs(
  rows: TransferRow[],
): { left: TransferRow; right: TransferRow }[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const pairs: { left: TransferRow; right: TransferRow }[] = []
  const used = new Set<string>()
  for (const row of rows) {
    if (used.has(row.id)) continue
    const cands = findTransferCandidates(row, rows)
    if (cands.length !== 1) continue
    const other = cands[0]
    if (used.has(other.id)) continue
    const back = findTransferCandidates(other, rows)
    if (back.length !== 1 || back[0].id !== row.id) continue
    if (!byId.has(other.id)) continue
    used.add(row.id)
    used.add(other.id)
    pairs.push({ left: row, right: other })
  }
  return pairs
}
