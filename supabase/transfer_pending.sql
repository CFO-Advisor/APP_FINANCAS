-- ============================================================
-- Transferências com contrapartida OPCIONAL (importação)
--
-- Contexto: na importação de extrato a contrapartida nem sempre é
-- conhecida (e adivinhar gera saldo errado). Agora a transferência pode
-- ser gravada "de uma ponta só", refletindo exatamente o que o extrato diz.
--
-- Semântica de transfer_dir (SEMPRE relativa ao bank_id):
--   'out' = o dinheiro SAIU da conta em bank_id
--   'in'  = o dinheiro ENTROU na conta em bank_id
--
-- Efeito no saldo:
--   dir='out' → bank_id perde, transfer_bank_id (se houver) ganha
--   dir='in'  → bank_id ganha, transfer_bank_id (se houver) perde
--
-- transfer_bank_id NULL = contrapartida ainda desconhecida (pendente).
-- Nesse caso só a conta do extrato é afetada — exatamente o que se sabe.
--
-- IMPORTANTE: este arquivo NÃO mexe em views. A v_balanco é atualizada
-- separadamente (script que lê a definição atual e troca só os dois ramos
-- de transferência), porque a definição real é muito maior do que o
-- fragmento visível — reescrevê-la à mão destruiria a view.
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_dir text;

-- Backfill: as linhas existentes têm as duas pontas e seguem o modelo antigo
-- (bank_id = conta de origem) → direção 'out'.
UPDATE public.transactions
   SET transfer_dir = 'out'
 WHERE type = 'transfer'
   AND transfer_dir IS NULL;

-- Nova regra: transferência exige a conta do extrato e uma direção; a
-- contrapartida pode ficar pendente (NULL). Quando as duas pontas existem,
-- precisam ser contas diferentes.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_transfer_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transfer_check CHECK (
    type <> 'transfer' OR (
      bank_id IS NOT NULL
      AND (transfer_bank_id IS NULL OR bank_id <> transfer_bank_id)
      AND transfer_dir IN ('out', 'in')
    )
  );
