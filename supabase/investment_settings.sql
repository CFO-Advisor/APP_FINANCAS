-- Saldos iniciais por grupo de investimento
CREATE TABLE IF NOT EXISTS public.investment_settings (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  group_key       text NOT NULL,
  initial_balance numeric(12, 2) NOT NULL DEFAULT 0,
  UNIQUE(user_id, group_key)
);

ALTER TABLE public.investment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own investment settings"
  ON public.investment_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
