CREATE TABLE IF NOT EXISTS public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_type text NOT NULL CHECK (group_type IN ('loans', 'bills', 'other')),
  category text NOT NULL,
  description text NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  monthly_amount numeric(12,2) NOT NULL DEFAULT 0,
  installments_total integer,
  installments_paid integer DEFAULT 0,
  due_day integer CHECK (due_day BETWEEN 1 AND 31),
  start_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'overdue')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debts_own" ON public.debts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
