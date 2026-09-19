-- ============================================================
-- 1) v_balanco: a contrapartida deixa de afetar saldo
--    Em vez de mexer no CASE (que o Postgres quebra em várias linhas),
--    restringe-se o WHERE da subconsulta: só as linhas cujo bank_id é a
--    conta entram. O lado da contrapartida contribui 0 por não casar.
-- ============================================================
DO $$
DECLARE
  def text;
BEGIN
  def := pg_get_viewdef('public.v_balanco'::regclass, true);

  IF position('WHERE t.bank_id = b.id OR t.transfer_bank_id = b.id)' in def) = 0 THEN
    RAISE EXCEPTION 'Padrao do WHERE nao encontrado na v_balanco';
  END IF;

  def := replace(
    def,
    'WHERE t.bank_id = b.id OR t.transfer_bank_id = b.id)',
    'WHERE t.bank_id = b.id)'
  );

  EXECUTE 'CREATE OR REPLACE VIEW public.v_balanco AS ' || def;
  RAISE NOTICE 'v_balanco: transferencia agora conta so na conta do extrato';
END $$;

-- ============================================================
-- 2) Restaura o lado da Inter das 2 transferências para o Nubank
--
--    Correção de um erro anterior: essas 2 linhas foram removidas como
--    "duplicadas" quando o modelo ainda somava as duas pontas. No modelo
--    correto (contrapartida é metadado), CADA extrato tem o seu lado — a
--    Inter debita, o Nubank credita. A contrapartida agora aponta para o
--    Nubank (a contrapartida real, revelada pelo extrato do Nubank).
-- ============================================================
INSERT INTO public.transactions
  (user_id, description, amount, date, type, category, bank_id, transfer_bank_id, transfer_dir)
SELECT
  '<CELIO_ID>'::uuid,
  'Celio Gadelha De Oliveira',
  v.amount,
  v.date::date,
  'transfer',
  'Transferência',
  (SELECT id FROM public.banks WHERE name = 'Inter'  AND user_id = '<CELIO_ID>'::uuid),
  (SELECT id FROM public.banks WHERE name = 'Nubank' AND user_id = '<CELIO_ID>'::uuid),
  'out'
FROM (VALUES (2100.00, '2026-01-20'), (403.33, '2026-01-02')) AS v(amount, date)
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t
   WHERE t.user_id = '<CELIO_ID>'::uuid
     AND t.type = 'transfer'
     AND t.amount = v.amount
     AND t.date = v.date::date
     AND t.bank_id = (SELECT id FROM public.banks WHERE name = 'Inter' AND user_id = '<CELIO_ID>'::uuid)
);
