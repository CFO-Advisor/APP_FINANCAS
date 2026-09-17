// Self-check for the import parsers. Run: npx tsx src/lib/import/parsers.check.ts
import * as fs from 'fs'
import * as assert from 'node:assert'
import {
  parseCSVContent,
  guessFieldMap,
  mapCSVRows,
  parseBRNumber,
  parsePDFLines,
  isInterCardFatura,
  parseInterCardFatura,
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

// ── C6 Fatura (cartão): ; delimitador, Valor R$ (não US$), parcelas ──────
const c6FaturaCsv = [
  'Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)',
  '27/09/2025;CELIO G DE OLIVEIRA;3008;Departamento / Desconto;APA;12/12;0;0;363.91',
  '20/08/2026;CELIO G DE OLIVEIRA;4442;-;"Inclusao de Pagamento    ";Única;0;0;-8710.81',
  '09/09/2026;CELIO G DE OLIVEIRA;5689;Empresa para empresa;APPLE STORE R610    28;Única;894.01;5.35;4784.74',
  '11/04/2026;MARIA NAZARE SILVA;4863;Vestuário / Roupas;CROCS;6/6;0;0;136.32',
].join('\n')

const c6f = parseCSVContent(c6FaturaCsv)
const c6fMap = guessFieldMap(c6f.headers) as any
assert.deepEqual(
  { date: c6fMap.date, description: c6fMap.description, amount: c6fMap.amount },
  { date: 'Data', description: 'Descrição', amount: 'Valor' },
  `normalização fatura C6, veio: ${JSON.stringify(c6f.headers)}`,
)
const c6fRows = mapCSVRows(c6f.rows, c6fMap)
assert.equal(c6fRows.length, 4)
assert.equal(c6fRows[0].amount, 363.91)
assert.equal(c6fRows[0].type, 'expense')
assert.ok(c6fRows[0].description.endsWith('(12/12)'), `parcela na descrição: ${c6fRows[0].description}`)
assert.equal(c6fRows[1].type, 'income', 'pagamento (negativo) vira receita → import p/ cartão ignora')
assert.equal(c6fRows[1].amount, 8710.81)
assert.equal(c6fRows[2].amount, 4784.74)
assert.ok(!c6fRows[2].description.includes('('), 'Única não adiciona parcela')
assert.equal(c6fRows[3].description, 'CROCS (6/6)')

assert.equal(c6fRows[3].description, 'CROCS (6/6)')

// ── Inter Fatura (cartão, PDF): datas por extenso, +pagamento, multilinha ──
const interFaturaLines = [
  'Resumo da fatura',
  'Total da sua fatura',
  'R$ 11.469,57',
  'Despesas da fatura',
  'CARTÃO 5364****6670',
  'Data Movimentação Beneficiário Valor',
  '13 de jun. 2026 A N B ALMEIDA ODONTOPE (Parcela 03 de 05) - R$ 300,00',
  '16 de ago. 2026 SABOR CASEIRO - R$ 90,00',
  '20 de ago. 2026 PAGTO DEBITO AUTOMATICO - + R$ 8.988,38',
  '09 de set. 2026 FYP*SHENZHENJINGANLANJ',
  'Valor e símbolo da moeda de origem: 4.000,00 CNY',
  'Valor em dólar americano: $ 604,94',
  'Cotação do dólar americano: R$ 5,3523',
  '- R$ 3.237,82',
  'Total CARTÃO 5364****6670 R$ 7.670,89',
  'Movimentação Valor',
  'JAComercioDe (Parcela 12 de 12) R$ 67,95',
]
assert.equal(isInterCardFatura(interFaturaLines), true, 'deve reconhecer fatura de cartão')
const interF = parseInterCardFatura(interFaturaLines)
assert.equal(interF.length, 4, `4 lançamentos, veio: ${interF.length}`)
assert.equal(interF[0].type, 'expense')
assert.equal(interF[0].amount, 300)
assert.equal(interF[0].date, '2026-06-13')
assert.ok(interF[0].description.includes('(Parcela 03 de 05)'), 'parcela mantida na descrição')
assert.equal(interF[1].type, 'expense')
assert.equal(interF[1].amount, 90)
assert.equal(interF[2].type, 'income', 'pagamento (+) vira receita → import p/ cartão ignora')
assert.equal(interF[2].amount, 8988.38)
assert.equal(interF[3].description, 'FYP*SHENZHENJINGANLANJ')
assert.equal(interF[3].amount, 3237.82)
assert.equal(interF[3].type, 'expense')
assert.equal(interF[3].date, '2026-09-09')
assert.ok(interF[3].error === undefined, 'multilinha fecha com o valor da linha seguinte')

console.log('parsers.check OK ✓')