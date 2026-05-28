ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS credit_card_id uuid
  REFERENCES public.credit_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_credit_card_id_idx
  ON public.transactions(credit_card_id)
  WHERE credit_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_cards_user_id_idx
  ON public.credit_cards(user_id);
