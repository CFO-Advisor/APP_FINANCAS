-- ============================================================
-- Compartilhamento de acesso (owner → convidado)
-- Substitui as políticas hardcoded "contador_acesso_*" por um
-- sistema genérico: tabela shared_access + RLS baseada nela.
--
-- Papéis (role):
--   viewer  = só leitura
--   editor  = leitura + escrita (INSERT/UPDATE/DELETE)
-- ============================================================

-- 1) Tabela de compartilhamento --------------------------------
CREATE TABLE IF NOT EXISTS public.shared_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('viewer', 'editor')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS shared_access_invitee_idx
  ON public.shared_access(invitee_id);

ALTER TABLE public.shared_access ENABLE ROW LEVEL SECURITY;

-- Dono vê e gerencia seus compartilhamentos
CREATE POLICY "shared_access_own" ON public.shared_access
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Convidado vê quem compartilhou com ele (somente leitura)
CREATE POLICY "shared_access_invitee_read" ON public.shared_access
  FOR SELECT
  USING (auth.uid() = invitee_id);

-- 2) Funções auxiliares (SECURITY DEFINER para evitar recursão de RLS)
CREATE OR REPLACE FUNCTION public.shared_owner_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT owner_id FROM shared_access WHERE invitee_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.shared_can_read(p_owner uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT p_owner = auth.uid() OR EXISTS (
    SELECT 1 FROM shared_access
    WHERE invitee_id = auth.uid() AND owner_id = p_owner
  )
$$;

CREATE OR REPLACE FUNCTION public.shared_can_write(p_owner uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM shared_access
    WHERE invitee_id = auth.uid() AND owner_id = p_owner AND role = 'editor'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.shared_owner_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shared_can_read(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shared_can_write(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shared_owner_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.shared_can_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shared_can_write(uuid) TO authenticated;

-- 3) Remove políticas hardcoded antigas ------------------------
DROP POLICY IF EXISTS "contador_acesso_sel" ON public.transactions;
DROP POLICY IF EXISTS "contador_acesso_ins" ON public.transactions;
DROP POLICY IF EXISTS "contador_acesso_upd" ON public.transactions;
DROP POLICY IF EXISTS "contador_acesso_sel" ON public.banks;
DROP POLICY IF EXISTS "contador_acesso_ins" ON public.banks;
DROP POLICY IF EXISTS "contador_acesso_upd" ON public.banks;
DROP POLICY IF EXISTS "contador_acesso_sel" ON public.debts;
DROP POLICY IF EXISTS "contador_acesso_ins" ON public.debts;
DROP POLICY IF EXISTS "contador_acesso_upd" ON public.debts;
DROP POLICY IF EXISTS "contador_acesso_sel" ON public.assets;
DROP POLICY IF EXISTS "contador_acesso_ins" ON public.assets;
DROP POLICY IF EXISTS "contador_acesso_upd" ON public.assets;
DROP POLICY IF EXISTS "contador_acesso_sel" ON public.budgets;
DROP POLICY IF EXISTS "contador_acesso_ins" ON public.budgets;
DROP POLICY IF EXISTS "contador_acesso_upd" ON public.budgets;
DROP POLICY IF EXISTS "contador_acesso_sel" ON public.credit_cards;
DROP POLICY IF EXISTS "contador_acesso_ins" ON public.credit_cards;
DROP POLICY IF EXISTS "contador_acesso_upd" ON public.credit_cards;

-- 4) Políticas genéricas de compartilhamento -------------------
--    (coexistem com as políticas "own" existentes)

CREATE POLICY "shared_select" ON public.transactions
  FOR SELECT USING (public.shared_can_read(user_id));
CREATE POLICY "shared_insert" ON public.transactions
  FOR INSERT WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_update" ON public.transactions
  FOR UPDATE USING (public.shared_can_write(user_id))
  WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_delete" ON public.transactions
  FOR DELETE USING (public.shared_can_write(user_id));

CREATE POLICY "shared_select" ON public.banks
  FOR SELECT USING (public.shared_can_read(user_id));
CREATE POLICY "shared_insert" ON public.banks
  FOR INSERT WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_update" ON public.banks
  FOR UPDATE USING (public.shared_can_write(user_id))
  WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_delete" ON public.banks
  FOR DELETE USING (public.shared_can_write(user_id));

CREATE POLICY "shared_select" ON public.debts
  FOR SELECT USING (public.shared_can_read(user_id));
CREATE POLICY "shared_insert" ON public.debts
  FOR INSERT WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_update" ON public.debts
  FOR UPDATE USING (public.shared_can_write(user_id))
  WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_delete" ON public.debts
  FOR DELETE USING (public.shared_can_write(user_id));

CREATE POLICY "shared_select" ON public.assets
  FOR SELECT USING (public.shared_can_read(user_id));
CREATE POLICY "shared_insert" ON public.assets
  FOR INSERT WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_update" ON public.assets
  FOR UPDATE USING (public.shared_can_write(user_id))
  WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_delete" ON public.assets
  FOR DELETE USING (public.shared_can_write(user_id));

CREATE POLICY "shared_select" ON public.budgets
  FOR SELECT USING (public.shared_can_read(user_id));
CREATE POLICY "shared_insert" ON public.budgets
  FOR INSERT WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_update" ON public.budgets
  FOR UPDATE USING (public.shared_can_write(user_id))
  WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_delete" ON public.budgets
  FOR DELETE USING (public.shared_can_write(user_id));

CREATE POLICY "shared_select" ON public.credit_cards
  FOR SELECT USING (public.shared_can_read(user_id));
CREATE POLICY "shared_insert" ON public.credit_cards
  FOR INSERT WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_update" ON public.credit_cards
  FOR UPDATE USING (public.shared_can_write(user_id))
  WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_delete" ON public.credit_cards
  FOR DELETE USING (public.shared_can_write(user_id));

CREATE POLICY "shared_select" ON public.investment_settings
  FOR SELECT USING (public.shared_can_read(user_id));
CREATE POLICY "shared_insert" ON public.investment_settings
  FOR INSERT WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_update" ON public.investment_settings
  FOR UPDATE USING (public.shared_can_write(user_id))
  WITH CHECK (public.shared_can_write(user_id));
CREATE POLICY "shared_delete" ON public.investment_settings
  FOR DELETE USING (public.shared_can_write(user_id));

-- 5) Migra os acessos hardcoded antigos (contador) ---------------
INSERT INTO public.shared_access (owner_id, invitee_id, role)
VALUES ('a0c72135-1aa6-4145-bf88-f0cd5b41f01a', 'fd10e606-9423-48b9-b492-8df6a8302508', 'viewer')
ON CONFLICT (owner_id, invitee_id) DO NOTHING;
