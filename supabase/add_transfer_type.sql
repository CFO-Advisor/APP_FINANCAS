-- Tipo 'transfer': movimentação entre contas do MESMO titular.
-- Não é receita, despesa nem investimento — fica fora de todos os totais.
-- bank_id          = conta de ORIGEM
-- transfer_bank_id = conta de DESTINO

-- 1) Libera o novo tipo na constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income', 'expense', 'investment', 'credit_card_payment', 'transfer'));

-- 2) Coluna da conta de destino
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_bank_id uuid
  REFERENCES public.banks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_transfer_bank_id_idx
  ON public.transactions(transfer_bank_id)
  WHERE transfer_bank_id IS NOT NULL;

-- 3) Regra de negócio no banco: transferência exige as duas contas e
--    elas precisam ser diferentes (não faz sentido transferir para si mesma).
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_transfer_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transfer_check
  CHECK (
    type <> 'transfer'
    OR (bank_id IS NOT NULL AND transfer_bank_id IS NOT NULL AND bank_id <> transfer_bank_id)
  );
