-- Add status column to transactions table
-- pending: card charge not yet paid (parked)
-- settled: regular transaction or card charge after fatura payment
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'settled'
  CHECK (status IN ('pending', 'settled'));

-- Existing card expense transactions keep 'settled' (already in dashboard history)
-- Only NEW card charges from the card page will default to 'pending'
