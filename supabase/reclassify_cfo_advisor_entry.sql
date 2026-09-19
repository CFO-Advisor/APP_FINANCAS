-- Reclassifica a saída "Cfo Advisor" de 08/04/2026 (R$ 4.130,03).
--
-- Ficou com a categoria 'Fatura Cartão' da importação, mas é dinheiro saindo
-- para a CFO Advisor — não é pagamento de cartão. O titular já classifica
-- lançamentos "Cfo Advisor" como 'Pró-labore' mesmo quando são saída (há um de
-- R$ 1.586,00 em 05/02/2026 no mesmo padrão), então este segue a mesma regra.

UPDATE transactions
SET category = 'Pró-labore'
WHERE category = 'Fatura Cartão'
  AND type = 'expense'
  AND description ILIKE '%cfo advisor%';
