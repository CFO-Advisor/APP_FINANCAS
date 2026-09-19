-- Conciliação de fatura de cartão
--
-- O pagamento da fatura vive no extrato do banco; o valor devido vive na fatura
-- do cartão. Para reconhecer que um quitou a outra, o próprio lançamento do
-- pagamento guarda duas informações:
--
--   credit_card_id   → QUAL cartão a fatura pertence (coluna já existente)
--   paid_invoice_date → QUAL fatura foi quitada (data de emissão da fatura)
--
-- A fatura é virtual: não há tabela de faturas. Ela é identificada pelo par
-- (credit_card_id, date) dos registros de compra do cartão. Assim, o pagamento
-- aponta para a fatura pela mesma data usada nas compras daquele ciclo.
--
-- O vínculo é só reconhecimento: NÃO altera saldo nem total de despesa.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS paid_invoice_date date;

COMMENT ON COLUMN transactions.paid_invoice_date IS
  'Fatura de cartão quitada por este pagamento: data de emissão da fatura (mesma data usada nos registros de compra do ciclo). Só faz sentido quando credit_card_id está preenchido.';

-- A tela de conciliação filtra por pagamentos ainda sem vínculo.
CREATE INDEX IF NOT EXISTS transactions_paid_invoice_date_idx
  ON transactions (user_id, credit_card_id, paid_invoice_date)
  WHERE paid_invoice_date IS NOT NULL;
