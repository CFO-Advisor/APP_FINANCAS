-- ============================================================
-- Migration: investments + credit cards
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Expand transactions.type to include 'investment'
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income', 'expense', 'investment'));

-- 2. Create credit_cards table
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  brand         text NOT NULL DEFAULT 'outros' CHECK (brand IN ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outros')),
  color         text NOT NULL DEFAULT '#6366f1',
  credit_limit  numeric(12, 2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  closing_day   integer NOT NULL DEFAULT 1 CHECK (closing_day BETWEEN 1 AND 28),
  due_day       integer NOT NULL DEFAULT 10 CHECK (due_day BETWEEN 1 AND 28),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_cards_own"
  ON public.credit_cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Add credit_card_id to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS credit_card_id uuid
  REFERENCES public.credit_cards(id) ON DELETE SET NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS transactions_credit_card_id_idx
  ON public.transactions(credit_card_id)
  WHERE credit_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_cards_user_id_idx
  ON public.credit_cards(user_id);
