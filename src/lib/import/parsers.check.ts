// Self-check for the import parsers. Run: npx tsx src/lib/import/parsers.check.ts
import * as fs from 'fs'
import * as assert from 'node:assert'
import {
  parseCSVContent,
  guessFieldMap,
  mapCSVRows,
  parseBRNumber,
  parsePDFLines,
} from './parsers'

// ── 1. Inter bank CSV: debits (tipoOperacao=D) must import as expense ─────────
const interCsv = fs.readFileSync('/root/.openclaw/workspace/extrato-inter-90d.csv', 'utf8')
const { headers, rows } = parseCSVContent(interCsv)
const fieldMap = guessFieldMap(headers)
assert.deepEqual(
  { date: fieldMap.date, description: fieldMap.description, amount: fieldMap.amount, type: fieldMap.type },
  { date: 'dataEntrada', description: 'descricao', amount: 'valor', type: 'tipoOperacao' },
  `guessFieldMap deve apontar 'tipoOperacao' (C/D) como tipo, veio: ${JSON.stringify(fieldMap)}`,
)
const parsed = mapCSVRows(rows, fieldMap as any)
const expenses = parsed.filter((r) => r.type === 'expense')
assert.ok(expenses.length > 0, `deve haver despesas (D); veio: income=${parsed.filter(r=>r.type==='income').length} expense=0`)
const pixEnviado = parsed.find((r) => r.description.startsWith('PIX ENVIADO'))
assert.ok(pixEnviado && pixEnviado.type === 'expense', 'PIX ENVIADO deve ser despesa')

// ── 2. Numeric edge cases: parenthesized negative (BR bank PDFs) ──────────────
assert.equal(parseBRNumber('(1.234,56)'), -1234.56)
assert.equal(parseBRNumber('1.234,56'), 1234.56)
assert.equal(parseBRNumber('-700'), -700)

// ── 3. PDF text lines → transactions ─────────────────────────────────────────
const pdfLines = [
  '2026-08-01 PIX ENVIADO 700,00',
  '01/08/2026 TED RECEBIDO 5.000,00',
  '2026-08-05 IOF ADICIONAL (12,05)',
  'extrato gerado em 01/08/2026 pag 1', // sem valor → ignorada
]
const pdf = parsePDFLines(pdfLines)
assert.equal(pdf.length, 3, 'linhas sem valor devem ser ignoradas')
assert.ok(pdf.every((r) => !r.error), `sem erros, veio: ${JSON.stringify(pdf)}`)
assert.equal(pdf.filter((r) => r.type === 'expense').length, 1, 'IOF (12,05) é a única despesa (sinal negativo)')
assert.equal(pdf.find((r) => r.description.includes('TED'))?.type, 'income')

console.log('parsers.check OK ✓')