-- Adicionar agência e número de conta à tabela de bancos
ALTER TABLE public.banks
  ADD COLUMN IF NOT EXISTS agency text,
  ADD COLUMN IF NOT EXISTS account_number text;
