create table if not exists public.banking_reconciliations (
  id uuid primary key,
  competence text not null,
  created_at timestamptz not null default now(),
  file_names jsonb not null,
  bank_accounts_count integer not null default 0,
  ledger_accounts_count integer not null default 0,
  statements_count integer not null default 0,
  investment_statements_count integer not null default 0,
  investment_statements jsonb not null default '[]'::jsonb,
  results jsonb not null,
  review_items jsonb not null default '[]'::jsonb,
  payload jsonb not null
);

alter table public.banking_reconciliations
  add column if not exists review_items jsonb not null default '[]'::jsonb;

alter table public.banking_reconciliations
  add column if not exists investment_statements_count integer not null default 0;

alter table public.banking_reconciliations
  add column if not exists investment_statements jsonb not null default '[]'::jsonb;

alter table public.banking_reconciliations enable row level security;

drop policy if exists "banking_reconciliations_select" on public.banking_reconciliations;
drop policy if exists "banking_reconciliations_insert" on public.banking_reconciliations;
drop policy if exists "banking_reconciliations_update" on public.banking_reconciliations;

create policy "banking_reconciliations_select"
  on public.banking_reconciliations
  for select
  to anon
  using (true);

create policy "banking_reconciliations_insert"
  on public.banking_reconciliations
  for insert
  to anon
  with check (true);

create policy "banking_reconciliations_update"
  on public.banking_reconciliations
  for update
  to anon
  using (true)
  with check (true);
