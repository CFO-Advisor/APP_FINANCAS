// Self-check da trava anti-duplicidade da importação.
// Run: npx tsx src/lib/import/dedup.check.ts
//
// Reimportar o mesmo extrato não pode duplicar — mas repetição legítima no
// mesmo dia (ex.: três pagamentos iguais ao mesmo fornecedor) precisa continuar
// funcionando. A contagem por chave é o que garante os dois casos.
import * as assert from 'node:assert'
import { importRowKey, buildExistingIndex, filterNewRows, type ImportKeyRow } from './dedup'

const CONTA_INTER = 'conta-inter'
const CONTA_BTG = 'conta-btg'

const ref: ImportKeyRow = {
  date: '2026-01-20',
  type: 'expense',
  amount: 100,
  description: 'Pix enviado - Celio Gadelha De Oliveira',
  bank_id: CONTA_INTER,
}

// ── 1. Chave: normaliza caixa e espaços, valor em módulo, conta separada ────
assert.strictEqual(
  importRowKey(ref),
  importRowKey({ ...ref, description: '  PIX ENVIADO -   CELIO GADELHA DE OLIVEIRA  ', amount: -100 }),
  'mesma linha escrita de formas diferentes tem a mesma chave',
)
assert.notStrictEqual(importRowKey(ref), importRowKey({ ...ref, bank_id: CONTA_BTG }), 'conta diferente é outro lançamento')
assert.notStrictEqual(importRowKey(ref), importRowKey({ ...ref, date: '2026-01-21' }), 'data diferente é outro lançamento')
assert.notStrictEqual(importRowKey(ref), importRowKey({ ...ref, amount: 101 }), 'valor diferente é outro lançamento')
assert.notStrictEqual(importRowKey(ref), importRowKey({ ...ref, type: 'income' }), 'tipo diferente é outro lançamento')
assert.notStrictEqual(
  importRowKey(ref),
  importRowKey({ ...ref, bank_id: null, credit_card_id: 'cartao-1' }),
  'banco e cartão não se misturam',
)

// ── 2. Reimportar o mesmo extrato: tudo ignorado ───────────────────────────
const extrato = [ref, { ...ref, date: '2026-02-05', amount: 250 }]
const base = buildExistingIndex(extrato)
const r2 = filterNewRows(extrato, base)
assert.strictEqual(r2.duplicates, 2, 'reimportar o mesmo extrato ignora tudo')
assert.strictEqual(r2.fresh.length, 0, 'nada entra na segunda vez')

// ── 3. Sobreposição parcial: só o que faltava entra ────────────────────────
const index3 = buildExistingIndex([ref])
const r3 = filterNewRows(extrato, index3)
assert.strictEqual(r3.duplicates, 1, 'só a linha que já existia é ignorada')
assert.strictEqual(r3.fresh.length, 1, 'a linha nova entra')
assert.strictEqual(r3.fresh[0].date, '2026-02-05')

// ── 4. Repetição legítima no mesmo dia (multiplicidade) ────────────────────
//    A base já tem 1 dos 3 pagamentos iguais ao Colégio → entram 2.
const colegio: ImportKeyRow = { date: '2026-08-16', type: 'expense', amount: 400, description: 'Colegio Lato Sensu', bank_id: CONTA_INTER }
const baseUm = buildExistingIndex([colegio])
const r4 = filterNewRows([colegio, colegio, colegio], baseUm)
assert.strictEqual(r4.fresh.length, 2, 'dois dos três entram (o que já existia é ignorado)')
assert.strictEqual(r4.duplicates, 1, 'apenas um é considerado duplicado')

//    Extrato com 3 e base vazia → entram os 3 (não descarta repetidos)
const r5 = filterNewRows([colegio, colegio, colegio], buildExistingIndex([]))
assert.strictEqual(r5.fresh.length, 3, 'repetição legítima entra inteira na primeira importação')
assert.strictEqual(r5.duplicates, 0)

//    Base com 3 e extrato com 1 → ignora o único (já existem três lá)
const r6 = filterNewRows([colegio], buildExistingIndex([colegio, colegio, colegio]))
assert.strictEqual(r6.fresh.length, 0, 'já existem três ocorrências na base')
assert.strictEqual(r6.duplicates, 1)

// ── 5. Índice não é mutado entre execuções de forma inesperada ─────────────
const index7 = buildExistingIndex([ref])
assert.strictEqual(index7.get(importRowKey(ref)), 1, 'índice conta a ocorrência existente')

console.log('dedup.check: OK (reimportação não duplica; repetição legítima preservada)')
