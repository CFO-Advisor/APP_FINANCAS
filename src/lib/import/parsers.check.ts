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

// ── C6 Bank CSV: preâmbulo + Entrada/Saída separadas + decimais com ponto ────
const c6Csv = [
  'EXTRATO DE CONTA CORRENTE C6 BANK',
  '',
  'Agência: 1 / Conta: 40988759',
  'Extrato gerado em 16/09/2026 - as 00:24:30',
  '',
  'Extrato de 01/01/2026 a 31/08/2026',
  '',
  'Data Lançamento,Data Contábil,Título,Descrição,Entrada(R$),Saída(R$),Saldo do Dia(R$)',
  '03/01/2026,02/01/2026,IOF CHEQUE ESPECIAL,,0.00,1.77,-187.82',
  '07/01/2026,07/01/2026,Pix recebido de CELIO GADELHA DE OLIVEIRA,Pix recebido de CELIO GADELHA DE OLIVEIRA,200.00,0.00,12.18',
  '15/01/2026,15/01/2026,"SEGURO CONTA C6 ","Seguro Conta ",0.00,7.00,2572.26',
  '20/01/2026,20/01/2026,PGTO FAT CARTAO C6,Fatura de cartao,0.00,15979.47,0.00',
  '20/01/2026,20/01/2026,Pix recebido de Célio Gadelha De Oliveira,Pix recebido de Célio Gadelha De Oliveira,23437.13,0.00,0.00',
].join('\n')

const c6 = parseCSVContent(c6Csv)
const c6Map = guessFieldMap(c6.headers) as any
assert.deepEqual(
  { date: c6Map.date, description: c6Map.description, amount: c6Map.amount },
  { date: 'Data', description: 'Descrição', amount: 'Valor' },
  `normalização C6, veio: ${JSON.stringify(c6.headers)}`,
)
const c6Rows = mapCSVRows(c6.rows, c6Map)
assert.equal(c6Rows.length, 5, `5 linhas, veio: ${c6Rows.length}`)
assert.equal(c6Rows[0].type, 'expense')
assert.equal(c6Rows[0].amount, 1.77)
assert.ok(c6Rows[0].description.includes('IOF'), 'descrição do IOF')
assert.equal(c6Rows[1].type, 'income')
assert.equal(c6Rows[1].amount, 200)
assert.equal(c6Rows[2].category, 'Tarifas e Impostos', 'SEGURO CONTA → Tarifas')
assert.equal(c6Rows[3].category, 'Pagamento de Cartão', 'PGTO FAT → Pagamento de Cartão')
assert.equal(c6Rows[4].amount, 23437.13)
assert.equal(c6Rows[4].type, 'income')

console.log('parsers.check OK ✓')