-- ============================================================
-- Audit log completo: histórico de INSERT/UPDATE/DELETE
-- Guarda valores antes/depois (jsonb) + autor + timestamp.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id  uuid,
  action     text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  user_id    uuid,           -- dono dos dados afetados (p/ RLS)
  actor_id   uuid,           -- quem fez (auth.uid() no momento)
  old_data   jsonb,
  new_data   jsonb,
  at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_user_at_idx ON public.audit_log(user_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_record_idx ON public.audit_log(record_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Dono lê seu histórico
CREATE POLICY "audit_log_own" ON public.audit_log
  FOR SELECT USING (auth.uid() = user_id);
-- Convidados com acesso de leitura também veem o histórico do owner
CREATE POLICY "audit_log_shared" ON public.audit_log
  FOR SELECT USING (public.shared_can_read(user_id));
-- Ninguém escreve/apaga via API (somente triggers internos)
CREATE POLICY "audit_log_none" ON public.audit_log
  FOR ALL USING (false) WITH CHECK (false);

-- Trigger genérico: grava o evento
CREATE OR REPLACE FUNCTION public.audit_log_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user  uuid;
  v_actor uuid := auth.uid();
  v_old   jsonb;
  v_new   jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_user := NEW.user_id; v_new := to_jsonb(NEW); v_old := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_user := NEW.user_id; v_new := to_jsonb(NEW); v_old := to_jsonb(OLD);
  ELSE
    v_user := OLD.user_id; v_new := NULL; v_old := to_jsonb(OLD);
  END IF;

  -- Registra também updates sem mudança real (no-op) são ignorados
  IF TG_OP = 'UPDATE' AND v_new IS NOT DISTINCT FROM v_old THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, user_id, actor_id, old_data, new_data)
  VALUES (TG_TABLE_NAME, COALESCE(v_new->>'id', v_old->>'id')::uuid, TG_OP, v_user, v_actor, v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END $$;

-- Instala nas 7 tabelas (trigger AFTER, dispara após os de auditoria de coluna)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions','banks','credit_cards','debts','assets','budgets','investment_settings'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', t || '_audit_log', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.audit_log_row();', t || '_audit_log', t);
  END LOOP;
END $$;
