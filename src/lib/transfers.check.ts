// Self-check da leitura de transferências.
// Run: npx tsx src/lib/transfers.check.ts
//
// Modelo: a transferência pertence ao extrato de UMA conta (bank_id) e afeta
// SÓ essa conta. transfer_dir é a direção relativa a ela ('out' = saiu,
// 'in' = entrou). transfer_bank_id é METADADO (conciliação/relatório) e não
// altera saldo — cada lado aparece no extrato da sua própria conta.
import * as assert from 'node:assert'
import {
  transferEffect,
  transferSides,
  accumulateTransferEffects,
  findTransferCandidates,
  suggestTransferPairs,
  type TransferRow,
} from './transfers'

const INTER = 'conta-inter'
const BTG = 'conta-btg'
const NUBANK = 'conta-nubank'

// ── 1. Saída com contrapartida conhecida ───────────────────────────────────
const saida = { bank_id: INTER, transfer_bank_id: BTG, transfer_dir: 'out' as const, amount: 100, type: 'transfer' as const }
assert.deepStrictEqual(
  transferEffect(saida, INTER),
  { isInflow: false, otherAccountId: BTG },
  'na conta do extrato a saída desconta',
)
assert.strictEqual(
  transferEffect(saida, BTG),
  null,
  'a contrapartida NÃO é afetada (metadado) — o lado dela vem do extrato dela',
)
assert.deepStrictEqual(transferSides(saida), { from: INTER, to: BTG }, 'exibição: sai da Inter, entra no BTG')

// ── 2. Saída sem contrapartida (importação com pendência) ──────────────────
const pendenteSaida = { bank_id: INTER, transfer_bank_id: null, transfer_dir: 'out' as const, amount: 100, type: 'transfer' as const }
assert.deepStrictEqual(transferEffect(pendenteSaida, INTER), { isInflow: false, otherAccountId: null })
assert.deepStrictEqual(transferSides(pendenteSaida), { from: INTER, to: null }, 'destino desconhecido na exibição')

// ── 3. Entrada (o caso que antes invertia o sinal) ────────────────────────
const entrada = { bank_id: INTER, transfer_bank_id: null, transfer_dir: 'in' as const, amount: 100, type: 'transfer' as const }
assert.deepStrictEqual(
  transferEffect(entrada, INTER),
  { isInflow: true, otherAccountId: null },
  'entrada CREDITA a conta do extrato',
)
assert.deepStrictEqual(transferSides(entrada), { from: null, to: INTER })

// ── 4. transfer_dir ausente → tratada como saída (linhas antigas) ──────────
const semDir = { bank_id: INTER, transfer_bank_id: BTG, transfer_dir: null, amount: 100, type: 'transfer' as const }
assert.deepStrictEqual(transferEffect(semDir, INTER), { isInflow: false, otherAccountId: BTG })

// ── 5. Sem duplicação: os dois lados do mesmo evento somam em contas diferentes
//    Inter debitada, Nubank creditada — nunca a mesma conta duas vezes ──────
const ladoInter = { bank_id: INTER, transfer_bank_id: NUBANK, transfer_dir: 'out' as const, amount: 403.33, type: 'transfer' as const }
const ladoNubank = { bank_id: NUBANK, transfer_bank_id: INTER, transfer_dir: 'in' as const, amount: 403.33, type: 'transfer' as const }
const acc = accumulateTransferEffects([ladoInter, ladoNubank])
assert.strictEqual(acc.outflow[INTER], 403.33, 'Inter registra a saída uma única vez')
assert.strictEqual(acc.inflow[NUBANK], 403.33, 'Nubank registra a entrada uma única vez')
assert.strictEqual(acc.inflow[INTER], undefined, 'a Inter não recebe crédito pelo lado da contrapartida')
assert.strictEqual(acc.outflow[NUBANK], undefined, 'o Nubank não recebe débito pelo lado da contrapartida')

// ── 6. Conta sem participação devolve null ────────────────────────────────
assert.strictEqual(transferEffect(saida, NUBANK), null)

// ── 7. Conciliação: pareamento dos dois lados ────────────────────────────
const parInter: TransferRow = {
  id: 'i1', bank_id: INTER, transfer_bank_id: null, transfer_dir: 'out', amount: 403.33, date: '2026-01-02',
}
const parNubank: TransferRow = {
  id: 'n1', bank_id: NUBANK, transfer_bank_id: null, transfer_dir: 'in', amount: 403.33, date: '2026-01-02',
}

assert.deepStrictEqual(
  findTransferCandidates(parInter, [parInter, parNubank]).map((c) => c.id),
  ['n1'],
  'casa a saída da Inter com a entrada no Nubank',
)

assert.strictEqual(
  findTransferCandidates(parInter, [parInter, { ...parNubank, id: 'n2', transfer_dir: 'out' }]).length,
  0,
  'mesmo sentido NÃO é par (saída com saída)',
)
assert.strictEqual(
  findTransferCandidates(parInter, [parInter, { ...parNubank, amount: 500 }]).length,
  0,
  'valor diferente NÃO é par',
)
assert.strictEqual(
  findTransferCandidates(parInter, [parInter, { ...parNubank, date: '2026-01-06' }]).length,
  0,
  '4 dias de diferença passa da tolerância de 3 dias',
)
assert.strictEqual(
  findTransferCandidates(parInter, [parInter, { ...parNubank, date: '2026-01-05' }]).length,
  1,
  '3 dias de diferença ainda é par (TED/DOC pode virar o dia)',
)
assert.strictEqual(
  findTransferCandidates(parInter, [parInter, { ...parNubank, bank_id: INTER }]).length,
  0,
  'mesma conta NÃO é par',
)

// Par inequívoco → sugere | dois candidatos iguais → NÃO sugere (ambíguo)
assert.strictEqual(suggestTransferPairs([parInter, parNubank]).length, 1, 'sugere o par inequívoco')
assert.strictEqual(
  suggestTransferPairs([parInter, parNubank, { ...parNubank, id: 'n3' }]).length,
  0,
  'com dois candidatos iguais (valores repetidos no mesmo dia) NÃO sugere sozinho',
)
assert.strictEqual(
  suggestTransferPairs([parInter, { ...parNubank, amount: 500 }]).length,
  0,
  'sem candidato não há sugestão',
)

console.log('transfers.check: OK (cada lado no seu extrato, sem duplicar efeito + pareamento da conciliação)')
