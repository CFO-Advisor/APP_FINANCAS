-- Ajuste cirúrgico da v_balanco: os dois ramos de transferência passam a
-- respeitar transfer_dir. Nada mais é alterado — a definição é lida do
-- catálogo em runtime e só essas duas expressões são substituídas.
--
-- Para linhas com as duas pontas e dir='out' (todas as antigas), o resultado
-- é idêntico ao de antes. A diferença aparece só nas linhas pendentes
-- (transfer_bank_id NULL) e nas de direção 'in'.
DO $$
DECLARE
  def  text;
  antes int;
BEGIN
  def := pg_get_viewdef('public.v_balanco'::regclass, true);

  def := replace(
    def,
    'WHEN t.type = ''transfer''::text AND t.bank_id = b.id THEN - abs(t.amount)',
    'WHEN t.type = ''transfer''::text AND t.bank_id = b.id THEN (CASE WHEN t.transfer_dir = ''in'' THEN abs(t.amount) ELSE - abs(t.amount) END)'
  );

  def := replace(
    def,
    'WHEN t.type = ''transfer''::text AND t.transfer_bank_id = b.id THEN abs(t.amount)',
    'WHEN t.type = ''transfer''::text AND t.transfer_bank_id = b.id THEN (CASE WHEN t.transfer_dir = ''in'' THEN - abs(t.amount) ELSE abs(t.amount) END)'
  );

  IF def NOT LIKE '%transfer_dir%' THEN
    RAISE EXCEPTION 'Substituicao falhou: padrao de transferencia nao encontrado na v_balanco';
  END IF;

  EXECUTE 'CREATE OR REPLACE VIEW public.v_balanco AS ' || def;
  RAISE NOTICE 'v_balanco atualizada com transfer_dir';
END $$;
