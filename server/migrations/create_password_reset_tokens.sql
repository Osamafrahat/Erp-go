-- Password reset tokens (self-service recovery)
-- APPLIED to production via Supabase on 2026-10-14; kept as the record of
-- what runs, mirroring enable-rls.sql. Idempotent guard: if you re-run this
-- on a fresh database it creates the table; on production it already exists.

create table if not exists public.password_reset_tokens (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user
  on public.password_reset_tokens(user_id);

-- Deny-all posture: RLS enabled with no policies — only the service role
-- reaches the table (anon/authenticated grants were revoked by the enable-rls
-- migration's default privileges, which also cover this newer table).
alter table public.password_reset_tokens enable row level security;
