-- Leaderboard foundation for public gameplay results.
-- Run after 001_supabase_core_schema.sql when enabling persistent leaderboard storage.

create table if not exists public.leaderboard_entries (
  id text primary key default gen_random_uuid()::text,
  nickname text not null,
  nickname_key text not null unique,
  display_name text,
  auth_user_id text,
  best_prize integer not null default 0,
  best_correct_count integer not null default 0,
  games_count integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_entries_public_rank_idx
  on public.leaderboard_entries (is_hidden, best_prize desc, best_correct_count desc, updated_at desc);

create index if not exists leaderboard_entries_auth_user_id_idx
  on public.leaderboard_entries (auth_user_id);
