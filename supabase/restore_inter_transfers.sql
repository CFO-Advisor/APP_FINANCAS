-- Restaura as 7 transferências da Inter excluídas às 16:10, direto do histórico
-- de alterações (audit_log.old_data guarda a linha completa do momento da
-- exclusão). Cada uma é o lado da Inter (dinheiro que ENTROU) de uma
-- transferência enviada pelo BTG — o outro lado está no extrato do BTG e
-- continua lá. Nada mais é tocado.
--
-- Critério estrito: entre 16:10:00 e 16:11:00, DELETE em transactions,
-- conta = Inter, tipo = transfer. Isso isola exatamente as 7 linhas.
BEGIN;

-- Conferência antes
SELECT count(*) AS linhas_a_restaurar
FROM audit_log
WHERE action = 'DELETE' AND table_name = 'transactions'
  AND at >= '2026-09-19 16:10:00+00' AND at < '2026-09-19 16:11:00+00'
  AND old_data->>'bank_id' IN (SELECT id::text FROM banks WHERE name = 'Inter' AND user_id = '<CELIO_ID>'::uuid)
  AND old_data->>'type' = 'transfer';

INSERT INTO public.transactions
  (id, user_id, description, amount, date, type, category,
   credit_card_id, bank_id, transfer_bank_id, transfer_dir,
   purchase_date, created_by, created_at)
SELECT
  (old_data->>'id')::uuid,
  (old_data->>'user_id')::uuid,
  old_data->>'description',
  (old_data->>'amount')::numeric,
  (old_data->>'date')::date,
  old_data->>'type',
  old_data->>'category',
  NULLIF(old_data->>'credit_card_id', '')::uuid,
  NULLIF(old_data->>'bank_id', '')::uuid,
  NULLIF(old_data->>'transfer_bank_id', '')::uuid,
  COALESCE(old_data->>'transfer_dir', 'in'),
  NULLIF(old_data->>'purchase_date', '')::date,
  NULLIF(old_data->>'created_by', '')::uuid,
  COALESCE((old_data->>'created_at')::timestamptz, now())
FROM audit_log
WHERE action = 'DELETE' AND table_name = 'transactions'
  AND at >= '2026-09-19 16:10:00+00' AND at < '2026-09-19 16:11:00+00'
  AND old_data->>'bank_id' IN (SELECT id::text FROM banks WHERE name = 'Inter' AND user_id = '<CELIO_ID>'::uuid)
  AND old_data->>'type' = 'transfer'
ON CONFLICT (id) DO NOTHING;

COMMIT;
