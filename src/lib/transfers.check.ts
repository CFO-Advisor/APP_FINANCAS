// Self-check da leitura de transferências (direção + contrapartida opcional).
// Run: npx tsx src/lib/transfers.check.ts
//
// Contexto: transfer_dir é SEMPRE relativa ao bank_id ('out' = saiu daquela
// conta, 'in' = entrou). Com transfer_bank_id NULL a transferência afeta
// apenas a conta do extrato — é o caso da importação sem contrapartida.
import * as assert from 'node:assert'
import { transferEffect, transferSides } from './transfers'

const INTER = 'conta-inter'
const BTG = 'conta-btg'

// ── 1. Linha no modelo antigo (as duas pontas, dinheiro saindo da Inter) ────
const legado = { bank_id: INTER, transfer_bank_id: BTG, transfer_dir: 'out' as const }
assert.deepStrictEqual(
  transferEffect(legado, INTER),
  { isInflow: false, otherAccountId: BTG },
  'na conta de origem a transferência sai',
)
assert.deepStrictEqual(
  transferEffect(legado, BTG),
  { isInflow: true, otherAccountId: INTER },
  'na conta de destino a transferência entra',
)
assert.deepStrictEqual(
  transferSides(legado),
  { from: INTER, to: BTG },
  'ordem visual: sai da Inter, entra no BTG',
)

// ── 2. Pendente de SAÍDA (sem contrapartida): afeta só a conta do extrato ───
const pendenteSaida = { bank_id: INTER, transfer_bank_id: null, transfer_dir: 'out' as const }
assert.deepStrictEqual(
  transferEffect(pendenteSaida, INTER),
  { isInflow: false, otherAccountId: null },
  'pendente de saída desconta da conta do extrato',
)
assert.strictEqual(
  transferEffect(pendenteSaida, BTG),
  null,
  'sem contrapartida, NENHUMA outra conta é afetada (nada de adivinhar)',
)
assert.deepStrictEqual(
  transferSides(pendenteSaida),
  { from: INTER, to: null },
  'ordem visual: sai da Inter, destino desconhecido',
)

// ── 3. Pendente de ENTRADA: o caso que antes ficava com o sinal invertido ──
const pendenteEntrada = { bank_id: INTER, transfer_bank_id: null, transfer_dir: 'in' as const }
assert.deepStrictEqual(
  transferEffect(pendenteEntrada, INTER),
  { isInflow: true, otherAccountId: null },
  'pendente de entrada CREDITA a conta do extrato (era aqui que o saldo invertia)',
)
assert.strictEqual(transferEffect(pendenteEntrada, BTG), null, 'contrapartida desconhecida não é afetada')
assert.deepStrictEqual(
  transferSides(pendenteEntrada),
  { from: null, to: INTER },
  'ordem visual: origem desconhecida, entra na Inter',
)

// ── 4. Entrada com contrapartida conhecida ─────────────────────────────────
const entradaComPar = { bank_id: INTER, transfer_bank_id: BTG, transfer_dir: 'in' as const }
assert.deepStrictEqual(transferEffect(entradaComPar, INTER), { isInflow: true, otherAccountId: BTG })
assert.deepStrictEqual(transferEffect(entradaComPar, BTG), { isInflow: false, otherAccountId: INTER })

// ── 5. transfer_dir ausente (linhas antigas) é tratada como 'out' ──────────
const semDir = { bank_id: INTER, transfer_bank_id: BTG, transfer_dir: null }
assert.deepStrictEqual(
  transferEffect(semDir, INTER),
  { isInflow: false, otherAccountId: BTG },
  'sem transfer_dir assume saída (compatível com o modelo anterior)',
)

// ── 6. Conta que não participa da transferência devolve null ───────────────
assert.strictEqual(transferEffect(legado, 'conta-nubank'), null)

console.log('transfers.check: OK (direção de transferência e contrapartida pendente validadas)')
