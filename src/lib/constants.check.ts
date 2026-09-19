// Self-check da trava de sinal na classificação da importação.
// Run: npx tsx src/lib/constants.check.ts
//
// Contexto: a categoria sugerida (regra do Config. IA ou IA) sobrescrevia o
// tipo derivado do sinal do extrato. Uma linha negativa classificada como
// "Salário"/"Pró-labore"/"Dividendos" virava receita e o saldo importado não
// fechava com o extrato.
import * as assert from 'node:assert'
import { categoryToType, reconcileTypeWithStatement } from './constants'

// 1. O comportamento antigo (a causa do bug): categoria de receita → income
assert.strictEqual(categoryToType('Salário'), 'income', 'Salário é categoria de receita')
assert.strictEqual(categoryToType('Pró-labore'), 'income', 'Pró-labore é categoria de receita')
assert.strictEqual(categoryToType('Dividendos'), 'income', 'Dividendos é categoria de receita')

// 2. Saída no extrato nunca vira entrada, mesmo com categoria de receita
for (const cat of ['Salário', 'Pró-labore', 'Dividendos', 'Aluguel Recebido']) {
  assert.strictEqual(
    reconcileTypeWithStatement(cat, 'expense'),
    'expense',
    `saída no extrato + "${cat}" deve continuar despesa`,
  )
}

// 3. Entrada no extrato nunca vira saída
for (const cat of ['Alimentação', 'Supermercado', 'CDB', 'Ações']) {
  assert.strictEqual(
    reconcileTypeWithStatement(cat, 'income'),
    'income',
    `entrada no extrato + "${cat}" deve continuar receita`,
  )
}

// 4. Refino dentro da MESMA direção continua permitido
assert.strictEqual(
  reconcileTypeWithStatement('CDB', 'expense'),
  'investment',
  'despesa pode virar investimento (mesma direção)',
)
assert.strictEqual(
  reconcileTypeWithStatement('Ações', 'expense'),
  'investment',
  'despesa pode virar investimento (mesma direção)',
)

// 5. Transferência é neutra: não é entrada nem saída
assert.strictEqual(reconcileTypeWithStatement('Transferência', 'expense'), 'transfer')
assert.strictEqual(reconcileTypeWithStatement('Transferência', 'income'), 'transfer')

// 6. Linha sem direção confiável (PDF sem sinal) segue a categoria
assert.strictEqual(reconcileTypeWithStatement('Salário', 'transfer'), 'income')

console.log('constants.check: OK (trava de sinal da importação validada)')
