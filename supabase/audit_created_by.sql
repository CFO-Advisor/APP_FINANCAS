-- ============================================================
-- Auditoria: quem criou / quem alterou cada registro
-- created_by/updated_by são preenchidos por TRIGGER com auth.uid()
-- (inviolável pelo front-end). Funciona também para edits de
-- convidados (editor) sobre dados do owner.
-- ============================================================

-- 1) Função genérica de auditoria ------------------------------
CREATE OR REPLACE FUNCTION public.audit_set_created_by()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.audit_set_updated_by()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.created_by := OLD.created_by; -- nunca muda após criação
  RETURN NEW;
END $$;

-- 2) Aplica nas tabelas de dados --------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions','banks','credit_cards','debts','assets','budgets','investment_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid;', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid;', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', t || '_audit_ins', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.audit_set_created_by();', t || '_audit_ins', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', t || '_audit_upd', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.audit_set_updated_by();', t || '_audit_upd', t);
  END LOOP;
END $$;

-- 3) RLS: colunas de auditoria são legíveis por quem já pode ler a linha
--    (nada a fazer — SELECT * já inclui created_by/updated_by)

-- 4) Referências ficam sem FK para auth.users para simplicidade;
--    e-mail do autor é resolvido em runtime pelo /api/users/lookup.
