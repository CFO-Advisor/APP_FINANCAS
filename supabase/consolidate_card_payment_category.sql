-- Consolida a categoria do pagamento de fatura no nome canônico do titular.
--
-- O app escrevia TRÊS nomes para a mesma coisa:
--   'Pagamento de Fatura'  → o formulário (tipo "Pg. Fatura")
--   'Fatura Cartão'        → a importação de extrato
--   'Pagamento de Cartão'  → o parser
-- A conciliação de fatura passa a reconhecer o pagamento por UMA categoria:
-- 'Pagamento de Fatura'. Tudo converge para ela.
--
-- Fora da mudança: os lançamentos "Cfo Advisor", que são renda da empresa
-- (pró-labore / dividendos) — recebimento não paga fatura de cartão.

-- 1) Pagamentos de fatura vindos do extrato
UPDATE transactions
SET category = 'Pagamento de Fatura'
WHERE category IN ('Fatura Cartão', 'Pagamento de Cartão')
  AND type <> 'income'
  AND description NOT ILIKE '%cfo advisor%';

-- 2) Entrada da empresa: é renda, não fatura.
--    Limiar do titular: valor <= R$ 10.000 → pró-labore.
UPDATE transactions
SET category = 'Pró-labore'
WHERE category IN ('Fatura Cartão', 'Pagamento de Cartão')
  AND type = 'income'
  AND description ILIKE '%cfo advisor%';
