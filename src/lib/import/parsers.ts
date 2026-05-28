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
  const s = str.trim().replace(/\s/g, '')
  if (!s) return NaN

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
  return parseFloat(normalized)
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
    let [, d, m, y] = br
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

export function parseCSVContent(content: string, delimiter?: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const delim = delimiter ?? detectDelimiter(content)
  const headers = splitCSVLine(lines[0], delim).map((h) => h.replace(/^["']|["']$/g, '').trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i], delim)
    if (values.length < 2) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').replace(/^["']|["']$/g, '').trim() })
    rows.push(row)
  }

  return { headers, rows }
}

// ── Field name guessing ─────────────────────────────────────────────────────

const DATE_HINTS = ['data', 'date', 'dt', 'vencimento', 'competencia', 'lancamento']
const DESC_HINTS = ['descri', 'hist', 'memo', 'narr', 'detalhe', 'observ', 'descr', 'description', 'historico']
const AMT_HINTS = ['valor', 'amount', 'vlr', 'vl', 'quantia', 'total', 'debito', 'credito', 'value']
const TYPE_HINTS = ['tipo', 'type', 'natureza', 'tp', 'movimento']

function matchHint(header: string, hints: string[]): boolean {
  const h = header.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  return hints.some((hint) => h.includes(hint))
}

export function guessFieldMap(headers: string[]): Partial<CSVFieldMap> {
  const map: Partial<CSVFieldMap> = {}
  for (const h of headers) {
    if (!map.date && matchHint(h, DATE_HINTS)) map.date = h
    else if (!map.description && matchHint(h, DESC_HINTS)) map.description = h
    else if (!map.amount && matchHint(h, AMT_HINTS)) map.amount = h
    else if (!map.type && matchHint(h, TYPE_HINTS)) map.type = h
  }
  return map
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

    return {
      date,
      description: rawDesc || 'Sem descrição',
      amount: Math.abs(amount),
      type,
      category: defaultCategory,
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
