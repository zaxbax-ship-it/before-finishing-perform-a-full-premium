-- 008: Player progression foundation (XP, levels, achievements).
--
-- One row per player. `player_key` matches the identity model already used by
-- the leaderboard and multiplayer: the authenticated user id when signed in,
-- otherwise the anonymous device id. Unlocked achievements are stored as a
-- jsonb array of stable achievement ids (see src/lib/progression/achievements.ts).
-- Additive and idempotent; safe to run on an existing database.

create table if not exists public.player_progression (
  id text primary key default gen_random_uuid()::text,
  player_key text not null unique,
  xp integer not null default 0,
  level integer not null default 1,
  games_played integer not null default 0,
  unlocked_achievements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_progression_level_idx
  on public.player_progression (level desc, xp desc);

alter table public.player_progression enable row level security;

-- Server-side (service role) access only for now; a public read policy can be
-- added when progression is surfaced in social features.
drop policy if exists player_progression_service_all on public.player_progression;
create policy player_progression_service_all on public.player_progression
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
