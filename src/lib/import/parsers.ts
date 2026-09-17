import * as XLSX from 'xlsx'
import type { TransactionType } from '@/lib/types'

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  type: TransactionType
  category: string
  error?: string
}

export interface CSVFieldMap {
  date: string
  description: string
  amount: string
  type?: string
}

// ── Number parsing ──────────────────────────────────────────────────────────

export function parseBRNumber(str: string): number {
  let s = str.trim().replace(/\s/g, '')
  if (!s) return NaN

  // Extratos em PDF costumam marcar débito como (1.234,56)
  let sign = 1
  if (s.startsWith('(') && s.endsWith(')')) { sign = -1; s = s.slice(1, -1) }

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  let normalized: string
  if (lastComma > lastDot) {
    // Brazilian: 1.234,56
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else {
    // US/ISO: 1,234.56 or plain 1234.56
    normalized = s.replace(/,/g, '')
  }
  const n = parseFloat(normalized)
  return isNaN(n) ? NaN : n * sign
}

// ── Date parsing ────────────────────────────────────────────────────────────

export function parseAnyDate(str: string): string | null {
  const s = str.trim()
  if (!s) return null

  // OFX YYYYMMDDHHMMSS[+-offset]
  const ofx = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (ofx) {
    const [, y, m, d] = ofx
    if (isValidDate(+y, +m, +d)) return `${y}-${m}-${d}`
  }

  // ISO yyyy-MM-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const [, y, m, d] = iso
    if (isValidDate(+y, +m, +d)) return `${y}-${m}-${d}`
  }

  // BR dd/MM/yyyy or dd/MM/yy
  const br = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (br) {
    const [, d, m, yy] = br
    let y = yy
    if (y.length === 2) y = (+y < 50 ? '20' : '19') + y
    const dd = d.padStart(2, '0')
    const mm = m.padStart(2, '0')
    if (isValidDate(+y, +mm, +dd)) return `${y}-${mm}-${dd}`
  }

  return null
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

// ── Delimiter detection ─────────────────────────────────────────────────────

export function detectDelimiter(content: string): string {
  const firstLines = content.split('\n').slice(0, 5).join('\n')
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestCount = 0
  for (const c of candidates) {
    const count = firstLines.split(c).length - 1
    if (count > bestCount) { bestCount = count; best = c }
  }
  return best
}

// ── CSV/TXT parsing ─────────────────────────────────────────────────────────

function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === delimiter && !inQuote) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

// Normaliza texto para comparação de nomes de coluna (minúsculo, sem acento)
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

// C6 Bank (e similares): valores em duas colunas separadas — Entrada(R$)
// (dinheiro entrando) e Saída(R$) (saindo). Normaliza para Data/Descrição/
// Valor com sinal (entrada +, saída −), mesma convenção do PDF/Inter.
function normalizeTwoAmountColumns(headers: string[], rows: Record<string, string>[]): { headers: string[]; rows: Record<string, string>[] } {
  const titleCol = headers.find((h) => norm(h).startsWith('titulo'))
  const descCol = headers.find((h) => norm(h).startsWith('descricao'))
  const entradaCol = headers.find((h) => norm(h).startsWith('entrada'))
  const saidaCol = headers.find((h) => norm(h).startsWith('saida'))
  const dateCol = headers.find((h) => norm(h).includes('data lancamento')) ?? headers.find((h) => matchHint(h, DATE_HINTS)) ?? headers[0] ?? 'Data'

  const newRows = rows.map((row) => {
    const titulo = titleCol ? (row[titleCol] ?? '') : ''
    const desc = descCol ? (row[descCol] ?? '') : ''
    // Título vem sempre preenchido; Descrição às vezes traz o favorecido/
    // estabelecimento. Combina quando a Descrição agrega informação.
    const description = desc && desc.toLowerCase() !== titulo.toLowerCase() ? `${titulo} - ${desc}` : titulo
    const entrada = parseBRNumber(entradaCol ? (row[entradaCol] ?? '') : '')
    const saida = parseBRNumber(saidaCol ? (row[saidaCol] ?? '') : '')
    const valor = !isNaN(entrada) && entrada > 0 ? entrada : !isNaN(saida) && saida > 0 ? -saida : 0
    return { Data: row[dateCol] ?? '', 'Descrição': description, Valor: String(valor) }
  })

  return { headers: ['Data', 'Descrição', 'Valor'], rows: newRows }
}

// Fatura de cartão (C6): compra vem com valor POSITIVO e pagamento/estorno
// negativo — o oposto da convenção do app (negativo = despesa). Normaliza
// para Data/Descrição/Valor invertendo o sinal e preservando a parcela.
function normalizeCardFatura(headers: string[], rows: Record<string, string>[]): { headers: string[]; rows: Record<string, string>[] } {
  const descCol = headers.find((h) => norm(h).startsWith('descricao'))
  const parcelaCol = headers.find((h) => norm(h).startsWith('parcela'))
  const dateCol = headers.find((h) => matchHint(h, DATE_HINTS)) ?? headers[0] ?? 'Data'
  // Valor em R$: o último 'valor' que não seja US$ nem cotação
  const valorCol = [...headers].reverse().find((h) => matchHint(h, AMT_HINTS) && !norm(h).match(/us\s*\$|usd/) && !norm(h).includes('cotacao'))

  const newRows = rows.map((row) => {
    const desc = descCol ? (row[descCol] ?? '') : ''
    const parcela = parcelaCol ? (row[parcelaCol] ?? '').trim() : ''
    const description = /^\d+\s*\/\s*\d+$/.test(parcela) ? `${desc} (${parcela})` : desc
    const brl = parseBRNumber(valorCol ? (row[valorCol] ?? '') : '')
    const valor = isNaN(brl) ? 0 : -brl
    return { Data: row[dateCol] ?? '', 'Descrição': description, Valor: String(valor) }
  })

  return { headers: ['Data', 'Descrição', 'Valor'], rows: newRows }
}

export function parseCSVContent(content: string, delimiter?: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const delim = delimiter ?? detectDelimiter(content)

  // Alguns bancos (ex.: Inter PF) prefixam o arquivo com um preâmbulo
  // ("Extrato Conta Corrente", "Conta ;38343800", "Período ;...", "Saldo ;-...")
  // antes da linha de cabeçalho real. Procura, nas primeiras 15 linhas, a
  // primeira que pareça um header de verdade: ≥2 colunas batendo nos hints
  // de data E valor (as duas colunas obrigatórias do import).
  let headerIdx = 0
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = splitCSVLine(lines[i], delim).map((h) => h.replace(/^["']|["']$/g, '').trim()).filter(Boolean)
    if (cols.length < 2) continue
    const hasDate = cols.some((c) => matchHint(c, DATE_HINTS))
    const hasAmount = cols.some((c) => matchHint(c, AMT_HINTS))
    // C6 Bank: valores em colunas separadas "Entrada(R$)"/"Saída(R$)"
    const hasInOut = cols.some((c) => norm(c).startsWith('entrada')) && cols.some((c) => norm(c).startsWith('saida'))
    if ((hasDate && hasAmount) || (hasDate && hasInOut)) { headerIdx = i; break }
  }

  const headers = splitCSVLine(lines[headerIdx], delim).map((h) => h.replace(/^["']|["']$/g, '').trim())
  const rows: Record<string, string>[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i], delim)
    if (values.length < 2) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').replace(/^["']|["']$/g, '').trim() })
    rows.push(row)
  }

  // Header com Entrada/Saída separadas (C6) → normaliza para Valor com sinal
  if (headers.some((h) => norm(h).startsWith('entrada')) && headers.some((h) => norm(h).startsWith('saida'))) {
    return normalizeTwoAmountColumns(headers, rows)
  }

  // Fatura de cartão (C6): "Final do Cartão" + "Parcela" → compra positiva na
  // fatura é DESPESA; inverte o sinal para a convenção do app (negativo = saída)
  const isCardFatura = headers.some((h) => norm(h).includes('final do cartao')) && headers.some((h) => norm(h).startsWith('parcela'))
  if (isCardFatura) return normalizeCardFatura(headers, rows)

  return { headers, rows }
}

// ── Field name guessing ─────────────────────────────────────────────────────

const DATE_HINTS = ['data', 'date', 'dt', 'vencimento', 'competencia', 'lancamento']
const DESC_HINTS = ['descri', 'hist', 'memo', 'narr', 'detalhe', 'observ', 'descr', 'description', 'historico']
const AMT_HINTS = ['valor', 'amount', 'vlr', 'vl', 'quantia', 'total', 'debito', 'credito', 'value']
// Sinal de receita/despesa (ex.: Inter "tipoOperacao" = C/D) — mais confiável
// que o filtro genérico de "tipo" (ex.: "tipoTransacao" = PIX, IMPOSTO, JUROS).
const OP_HINTS = ['operacao', 'movimento', 'dc', 'd-c', 'sinal', 'fluxo']
const TYPE_HINTS = ['tipo', 'type', 'natureza', 'tp']

function matchHint(header: string, hints: string[]): boolean {
  const h = header.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  return hints.some((hint) => h.includes(hint))
}

export function guessFieldMap(headers: string[]): Partial<CSVFieldMap> {
  const map: Partial<CSVFieldMap> = {}
  // Coluna de operação (C/D) primeiro: é o sinal confiável de receita/despesa.
  // Senão o filtro genérico de "tipo" pega "tipoTransacao" (PIX/JUROS/…) e tudo
  // vira receita (bug dos extratos do Inter).
  for (const h of headers) {
    if (matchHint(h, OP_HINTS)) { map.type = h; break }
  }
  // Fatura em dólar (C6): ignora coluna US$/USD — o valor da base é em R$
  for (const h of headers) {
    if (!map.date && matchHint(h, DATE_HINTS)) map.date = h
    else if (!map.amount && matchHint(h, AMT_HINTS) && !norm(h).match(/us\s*\$|usd/)) map.amount = h
  }
  // Descrição: prioriza colunas "descri*" (Inter PF tem "Histórico"=tipo do
  // lançamento e "Descrição"=favorecido — esta última é a que interessa)
  for (const h of headers) {
    if (!map.description && /descri/.test(h.toLowerCase())) map.description = h
  }
  for (const h of headers) {
    if (!map.date && matchHint(h, DATE_HINTS)) map.date = h
    else if (!map.description && matchHint(h, DESC_HINTS)) map.description = h
    else if (!map.amount && matchHint(h, AMT_HINTS) && !norm(h).match(/us\s*\$|usd/)) map.amount = h
    else if (!map.type && matchHint(h, TYPE_HINTS)) map.type = h
  }
  return map
}

// ── Categorização automática por palavra-chave (best-effort) ────────────────
// Baseada em Histórico+Descrição do extrato (Inter e bancos BR em geral).
const CATEGORY_RULES: [RegExp, string][] = [
  [/\b(iof|imposto\b|impostos|tarifa|cip|cheque especial|juros|seguro conta)/i, 'Tarifas e Impostos'],
  [/\b(pix enviado|transferencia enviada|ted enviada|doc enviado)/i, 'Transferências Enviadas'],
  [/\b(pix recebido|transferencia recebida|ted recebida|deposito)/i, 'Transferências Recebidas'],
  [/\b(pagamento fatura|pgto\s+fat|pagto\s+fat|fatura cart[aã]o)/i, 'Pagamento de Cartão'],
  [/\b(salario|salario|proventos|folha)/i, 'Salário'],
  [/\b(boleto|codigo de barras| concessiona|energia|luz|agua|c[eo]p e[lr]|amazo ?nas energia)/i, 'Contas e Boletos'],
  [/\b(netflix|spotify|amazon prime|disney|hbo|max\b|youtube premium|icloud|google one|apple\.com)/i, 'Assinaturas'],
  [/\b(uber|99 pop|i food|ifood|rappi|posto|shell|petrobras|ipiranga|combustivel)/i, 'Transporte e Alimentação'],
  [/\b(estorno|reembolso|devolu)/i, 'Estornos'],
  [/\b(resgate|aporte|rendimento|cdb|tesouro|fundo de invest)/i, 'Investimentos'],
]

export function guessCategory(text: string): string {
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(text)) return cat
  }
  return 'Outros'
}

// ── CSV → ParsedTransaction ─────────────────────────────────────────────────

export function mapCSVRows(
  rows: Record<string, string>[],
  fieldMap: CSVFieldMap,
  defaultCategory = 'Outros',
): ParsedTransaction[] {
  return rows.map((row) => {
    const rawDate = row[fieldMap.date] ?? ''
    const rawDesc = row[fieldMap.description] ?? ''
    const rawAmt = row[fieldMap.amount] ?? ''
    const rawType = fieldMap.type ? (row[fieldMap.type] ?? '') : ''

    const date = parseAnyDate(rawDate)
    if (!date) return { date: '', description: rawDesc, amount: 0, type: 'expense', category: defaultCategory, error: `Data inválida: "${rawDate}"` }

    const amount = parseBRNumber(rawAmt)
    if (isNaN(amount)) return { date, description: rawDesc, amount: 0, type: 'expense', category: defaultCategory, error: `Valor inválido: "${rawAmt}"` }

    let type: TransactionType = amount < 0 ? 'expense' : 'income'
    if (rawType) {
      const t = rawType.toLowerCase()
      if (t.includes('debit') || t.includes('desp') || t.includes('saida') || t.includes('saída') || t === 'd') type = 'expense'
      else if (t.includes('credit') || t.includes('rec') || t.includes('entrada') || t === 'c') type = 'income'
    }

    // Fatura de cartão (C6): preserva a parcela na descrição (ex.: "(3/12)")
    let description = rawDesc || 'Sem descrição'
    const parcela = (row['Parcela'] ?? '').trim()
    if (parcela !== 'Única' && /^\d+\s*\/\s*\d+$/.test(parcela)) description = `${description} (${parcela})`

    return {
      date,
      description,
      amount: Math.abs(amount),
      type,
      category: guessCategory(Object.values(row).join(' ')),
    }
  })
}

// ── XLSX parsing ────────────────────────────────────────────────────────────

export function parseXLSXContent(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { headers: [], rows: [] }

  // raw:false converts everything to strings; dateNF formats date cells as dd/mm/yyyy
  const data = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
    dateNF: 'DD/MM/YYYY',
  })

  if (data.length === 0) return { headers: [], rows: [] }

  const headers = (data[0] as string[]).map((h) => String(h ?? '').trim()).filter(Boolean)
  const rows: Record<string, string>[] = []

  for (let i = 1; i < data.length; i++) {
    const rowArr = data[i] as string[]
    if (!rowArr || rowArr.every((v) => !v)) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = String(rowArr[idx] ?? '').trim() })
    rows.push(row)
  }

  return { headers, rows }
}

// ── OFX parsing ─────────────────────────────────────────────────────────────

function extractOFXTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\r\n]*)`, 'i')
  return block.match(re)?.[1]?.trim() ?? ''
}

export function parseOFXContent(content: string, defaultCategory = 'Outros'): ParsedTransaction[] {
  // Extract all <STMTTRN>...</STMTTRN> blocks (SGML or XML style)
  const blockRe = /<STMTTRN[^>]*>([\s\S]*?)<\/STMTTRN>/gi
  const results: ParsedTransaction[] = []

  let match: RegExpExecArray | null
  while ((match = blockRe.exec(content)) !== null) {
    const block = match[1]
    const rawAmt = extractOFXTag(block, 'TRNAMT')
    const rawDate = extractOFXTag(block, 'DTPOSTED')
    const memo = extractOFXTag(block, 'MEMO') || extractOFXTag(block, 'NAME') || 'Sem descrição'
    const trnType = extractOFXTag(block, 'TRNTYPE').toUpperCase()

    const date = parseAnyDate(rawDate)
    if (!date) {
      results.push({ date: '', description: memo, amount: 0, type: 'expense', category: defaultCategory, error: `Data inválida: "${rawDate}"` })
      continue
    }

    const amount = parseBRNumber(rawAmt)
    if (isNaN(amount)) {
      results.push({ date, description: memo, amount: 0, type: 'expense', category: defaultCategory, error: `Valor inválido: "${rawAmt}"` })
      continue
    }

    let type: TransactionType
    if (trnType === 'CREDIT' || trnType === 'DEP' || trnType === 'INT' || trnType === 'DIV') {
      type = 'income'
    } else if (trnType === 'DEBIT' || trnType === 'POS' || trnType === 'ATM' || trnType === 'PAYMENT' || trnType === 'XFER') {
      type = 'expense'
    } else {
      type = amount < 0 ? 'expense' : 'income'
    }

    results.push({ date, description: memo, amount: Math.abs(amount), type, category: defaultCategory })
  }

  // Fallback: SGML without closing tags
  if (results.length === 0) {
    const sgmlBlockRe = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi
    while ((match = sgmlBlockRe.exec(content)) !== null) {
      const block = match[1]
      if (!block.includes('TRNAMT')) continue

      const rawAmt = extractOFXTag(block, 'TRNAMT')
      const rawDate = extractOFXTag(block, 'DTPOSTED')
      const memo = extractOFXTag(block, 'MEMO') || extractOFXTag(block, 'NAME') || 'Sem descrição'
      const trnType = extractOFXTag(block, 'TRNTYPE').toUpperCase()

      const date = parseAnyDate(rawDate)
      if (!date) {
        results.push({ date: '', description: memo, amount: 0, type: 'expense', category: defaultCategory, error: `Data inválida: "${rawDate}"` })
        continue
      }

      const amount = parseBRNumber(rawAmt)
      if (isNaN(amount)) {
        results.push({ date, description: memo, amount: 0, type: 'expense', category: defaultCategory, error: `Valor inválido: "${rawAmt}"` })
        continue
      }

      let type: TransactionType
      if (trnType === 'CREDIT' || trnType === 'DEP' || trnType === 'INT' || trnType === 'DIV') {
        type = 'income'
      } else {
        type = amount < 0 ? 'expense' : 'income'
      }

      results.push({ date, description: memo, amount: Math.abs(amount), type, category: defaultCategory })
    }
  }

  return results
}

// ── PDF parsing (texto extraído por pdfjs — melhor esforço) ─────────────────

export function parsePDFLines(lines: string[], defaultCategory = 'Outros'): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const tokens = line.split(/\s+/)

    // Data: primeiro token que pareça data
    let date = ''
    let dateIdx = -1
    for (let i = 0; i < tokens.length; i++) {
      const d = parseAnyDate(tokens[i])
      if (d) { date = d; dateIdx = i; break }
    }
    if (!date) continue

    // Valor: último token numérico que não seja a data. Ignora inteiros puros
    // (nº de página, doc, etc.) — valor de extrato tem casas decimais ("," ou ".").
    let amountS = NaN
    let amtIdx = -1
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (i === dateIdx) continue
      const t = tokens[i]
      if (!t.includes(',') && !t.includes('.')) continue
      const v = parseBRNumber(t)
      if (!isNaN(v) && v !== 0) { amountS = v; amtIdx = i; break }
    }
    if (isNaN(amountS)) continue

    const description = tokens.filter((_, i) => i !== dateIdx && i !== amtIdx).join(' ').trim() || 'Sem descrição'

    results.push({
      date,
      description,
      amount: Math.abs(amountS),
      type: amountS < 0 ? 'expense' : 'income',
      category: defaultCategory,
    })
  }

  return results
}

// ── Fatura de cartão Inter (PDF) ─────────────────────────────────────
// Linhas no formato "13 de jun. 2026 BENEFICIÁRIO (Parcela 03 de 05) - R$ 300,00",
// pagamentos com "+ R$" (quitação da fatura anterior) e lançamentos internacio-
// nais multilinha (o valor em R$ vem em linha própria após a descrição).

const INTER_MONTH_ABBR: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

// Reconhece o formato de fatura de cartão (datas por extenso "13 de jun. 2026")
export function isInterCardFatura(lines: string[]): boolean {
  return lines.some((l) => /^\d{1,2} de [a-zç]{3}\.? \d{4} /i.test(l.trim()))
}

export function parseInterCardFatura(lines: string[]): ParsedTransaction[] {
  const out: ParsedTransaction[] = []
  let pending: { date: string; description: string } | null = null

  const flushPending = () => {
    if (pending) {
      out.push({
        date: pending.date,
        description: pending.description,
        amount: 0,
        type: 'expense',
        category: guessCategory(pending.description),
        error: 'Valor não encontrado no lançamento.',
      })
      pending = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Linha só de valor — fecha um lançamento internacional: "- R$ 3.237,82"
    const valueOnly = line.match(/^([+\-])\s*R\$\s*([\d.]+,\d{2})$/)
    if (valueOnly) {
      if (pending) {
        const amount = Math.abs(parseBRNumber(valueOnly[2]))
        out.push({
          date: pending.date,
          description: pending.description,
          amount,
          type: valueOnly[1] === '-' ? 'expense' : 'income',
          category: guessCategory(pending.description),
        })
        pending = null
      }
      continue
    }

    const m = line.match(/^(\d{1,2}) de ([a-zç]{3})\.? (\d{4}) (.+)$/i)
    if (!m) continue
    const month = INTER_MONTH_ABBR[m[2].toLowerCase()]
    if (!month) continue
    const date = `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`
    const tail = m[4].trim()
    const valueMatch = tail.match(/([+\-])\s*R\$\s*([\d.]+,\d{2})$/)
    if (!valueMatch) {
      // Descrição agora; valor vem na(s) linha(s) seguinte(s)
      flushPending()
      pending = { date, description: tail }
      continue
    }
    flushPending()
    const amount = parseBRNumber(valueMatch[2])
    const description = tail.slice(0, valueMatch.index).trim().replace(/[-\s]+$/, '') || 'Sem descrição'
    out.push({
      date,
      description,
      amount: Math.abs(amount),
      type: valueMatch[1] === '-' ? 'expense' : 'income',
      category: guessCategory(description),
    })
  }
  flushPending()
  return out
}
