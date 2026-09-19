// Deduplicação exata na importação.
//
// Objetivo: reimportar o mesmo extrato (ou importar um arquivo que se sobrepõe
// a um já importado) não pode duplicar lançamentos. É diferente da conciliação
// de transferências (que LIGA os dois lados de um mesmo evento): aqui a chave é
// exata e determinística — data, tipo, valor, descrição normalizada e a
// conta/cartão.
//
// A contagem é respeitada: se o extrato traz 3 lançamentos iguais e a base já
// tem 1, entram apenas 2 — repetição legítima no mesmo dia continua funcionando
// (ex.: três pagamentos iguais ao mesmo fornecedor no mesmo dia).

export interface ImportKeyRow {
  date: string
  type: string
  amount: number
  description: string
  bank_id?: string | null
  credit_card_id?: string | null
}

/** Chave exata de um lançamento importado. */
export function importRowKey(r: ImportKeyRow): string {
  const desc = (r.description ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  const account = r.credit_card_id ? `c:${r.credit_card_id}` : r.bank_id ? `b:${r.bank_id}` : 'x:'
  return `${r.date}|${r.type}|${Math.abs(r.amount).toFixed(2)}|${desc}|${account}`
}

/** Quantas vezes cada chave já existe na base. */
export function buildExistingIndex(rows: ImportKeyRow[]): Map<string, number> {
  const index = new Map<string, number>()
  for (const r of rows) {
    const k = importRowKey(r)
    index.set(k, (index.get(k) ?? 0) + 1)
  }
  return index
}

/**
 * Separa o que deve entrar do que já existe. Consome as ocorrências do índice
 * conforme caminha, para não descartar repetições legítimas.
 */
export function filterNewRows<T extends ImportKeyRow>(
  rows: T[],
  index: Map<string, number>,
): { fresh: T[]; duplicates: number } {
  const fresh: T[] = []
  let duplicates = 0
  for (const r of rows) {
    const k = importRowKey(r)
    const restantes = index.get(k) ?? 0
    if (restantes > 0) {
      index.set(k, restantes - 1)
      duplicates++
      continue
    }
    fresh.push(r)
  }
  return { fresh, duplicates }
}
