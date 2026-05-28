CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_type text NOT NULL CHECK (group_type IN ('goods', 'rights')),
  category text NOT NULL,
  description text NOT NULL,
  value numeric(14,2) NOT NULL DEFAULT 0,
  acquisition_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_own" ON public.assets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
