-- ============================================================
-- Conciliação posterior: a contrapartida deixa de afetar saldo
--
-- Modelo: cada transferência pertence ao extrato de UMA conta (bank_id) e
-- afeta SÓ essa conta. A direção (transfer_dir) diz se o dinheiro saiu ou
-- entrou nela. A contrapartida (transfer_bank_id) passa a ser METADADO:
-- serve para conciliação/relatórios e NÃO altera o saldo da outra conta.
--
-- Consequência: importar todos os extratos nunca duplica efeito — cada lado
-- aparece no livro da sua própria conta, como na contabilidade real. A
-- conciliação posterior só VINCULA os dois lados (e lista o que ficou sem par).
-- ============================================================

-- 1) Corrige as linhas que ficaram com o lado invertido: bank_id deve ser
--    SEMPRE a conta do extrato de onde o lançamento veio.
--
--    (a) Lote do extrato da Inter (19/09 15:00): 20 linhas de transferências
--        RECEBIDAS pela Inter ficaram gravadas com bank_id = BTG (o app
--        invertia o lado nas recebidas). Voltam para bank_id = Inter, dir='in'.
UPDATE public.transactions
   SET bank_id         = transfer_bank_id,
       transfer_bank_id = bank_id,
       transfer_dir    = 'in'
 WHERE type = 'transfer'
   AND transfer_dir = 'out'
   AND created_at >= '2026-09-19 15:00:00+00'
   AND created_at <  '2026-09-19 15:05:00+00'
   AND bank_id IN (SELECT id FROM public.banks WHERE name = 'Banco BTG');

--    (b) Lote do extrato do Nubank (19/09 15:06): 3 linhas de transferências
--        RECEBIDAS pelo Nubank ficaram com bank_id = Inter/BTG. Voltam para
--        bank_id = Nubank, dir='in'.
UPDATE public.transactions
   SET bank_id         = transfer_bank_id,
       transfer_bank_id = bank_id,
       transfer_dir    = 'in'
 WHERE type = 'transfer'
   AND transfer_dir = 'out'
   AND created_at >= '2026-09-19 15:06:00+00'
   AND created_at <  '2026-09-19 15:10:00+00';

-- 2) Ajuste cirúrgico da v_balanco: a ponta da contrapartida deixa de somar
--    (virou metadado). Só o ramo do bank_id continua valendo.
DO $$
DECLARE
  def text;
BEGIN
  def := pg_get_viewdef('public.v_balanco'::regclass, true);

  def := replace(
    def,
    'WHEN t.type = ''transfer''::text AND t.transfer_bank_id = b.id THEN (CASE WHEN t.transfer_dir = ''in'' THEN - abs(t.amount) ELSE abs(t.amount) END)',
    'WHEN t.type = ''transfer''::text AND t.transfer_bank_id = b.id THEN 0::numeric'
  );

  IF def NOT LIKE '%transfer_bank_id = b.id THEN 0::numeric%' THEN
    RAISE EXCEPTION 'Substituicao falhou no ramo da contrapartida da v_balanco';
  END IF;

  EXECUTE 'CREATE OR REPLACE VIEW public.v_balanco AS ' || def;
  RAISE NOTICE 'v_balanco: contrapartida agora e metadado (nao afeta saldo)';
END $$;
