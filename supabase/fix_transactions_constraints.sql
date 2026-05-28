-- Remove category CHECK (too restrictive — categories are validated at app level)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_category_check;

-- Remove old type CHECK and recreate including 'investment'
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income', 'expense', 'investment'));
