-- ============================================================
-- Finanças Pessoais — Supabase Schema
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Tabela de transações
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount      numeric(12, 2) not null check (amount > 0),
  date        date not null,
  type        text not null check (type in ('income', 'expense')),
  category    text not null check (
    category in (
      'Alimentação', 'Transporte', 'Moradia', 'Lazer',
      'Saúde', 'Educação', 'Salário', 'Freelance', 'Outros'
    )
  ),
  created_at  timestamptz not null default now()
);

-- Index para filtros por usuário e data
create index if not exists transactions_user_id_date_idx
  on public.transactions(user_id, date desc);

-- ============================================================
-- Row Level Security (RLS)
-- Cada usuário só acessa suas próprias transações
-- ============================================================

alter table public.transactions enable row level security;

-- SELECT: usuário vê apenas suas transações
create policy "transactions_select_own"
  on public.transactions
  for select
  using (auth.uid() = user_id);

-- INSERT: usuário só insere transações para si mesmo
create policy "transactions_insert_own"
  on public.transactions
  for insert
  with check (auth.uid() = user_id);

-- UPDATE: usuário só edita suas próprias transações
create policy "transactions_update_own"
  on public.transactions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: usuário só exclui suas próprias transações
create policy "transactions_delete_own"
  on public.transactions
  for delete
  using (auth.uid() = user_id);
