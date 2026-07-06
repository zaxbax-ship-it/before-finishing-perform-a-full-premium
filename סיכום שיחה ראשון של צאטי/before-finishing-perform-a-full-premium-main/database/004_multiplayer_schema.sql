-- Multiplayer production schema.
-- Run after database/003_leaderboard_rls_policies.sql.
--
-- The application writes multiplayer state through trusted server-side API
-- routes using the service role. Browser clients should not write directly.

create table if not exists public.multiplayer_lobbies (
  id text primary key,
  status text not null default 'waiting'
    check (status in ('waiting', 'ready', 'starting', 'in_progress', 'finished', 'cancelled', 'expired')),
  visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  max_players integer not null check (max_players between 2 and 4),
  locale text not null default 'he',
  category text,
  host_player_id text,
  game_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.multiplayer_players (
  id text primary key,
  lobby_id text not null references public.multiplayer_lobbies(id) on delete cascade,
  game_id text,
  auth_user_id text,
  anonymous_id text not null,
  nickname text not null,
  display_name text,
  connection_token_hash text not null,
  position integer not null check (position between 1 and 4),
  is_connected boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disconnected_at timestamptz,
  unique (lobby_id, position),
  unique (lobby_id, nickname)
);

create table if not exists public.multiplayer_games (
  id text primary key,
  lobby_id text not null unique references public.multiplayer_lobbies(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'starting', 'in_progress', 'finished', 'cancelled', 'expired')),
  question_ids jsonb not null default '[]'::jsonb,
  current_round_index integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.multiplayer_rounds (
  id text primary key,
  game_id text not null references public.multiplayer_games(id) on delete cascade,
  round_number integer not null check (round_number >= 0),
  question_id text not null,
  question_snapshot jsonb not null,
  prize integer not null check (prize >= 0 and prize <= 1000000),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'expired')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  winner_player_id text references public.multiplayer_players(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, round_number)
);

create table if not exists public.multiplayer_answers (
  id text primary key,
  game_id text not null references public.multiplayer_games(id) on delete cascade,
  round_id text not null references public.multiplayer_rounds(id) on delete cascade,
  player_id text not null references public.multiplayer_players(id) on delete cascade,
  answer_index integer not null check (answer_index between 0 and 3),
  is_correct boolean not null default false,
  response_time_ms integer not null check (response_time_ms >= 0 and response_time_ms <= 120000),
  awarded_prize integer not null default 0 check (awarded_prize >= 0 and awarded_prize <= 1000000),
  submitted_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table if not exists public.multiplayer_results (
  id text primary key,
  game_id text not null references public.multiplayer_games(id) on delete cascade,
  player_id text not null references public.multiplayer_players(id) on delete cascade,
  rank integer not null check (rank between 1 and 4),
  total_prize integer not null default 0 check (total_prize >= 0 and total_prize <= 1000000),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  average_response_time_ms integer not null default 0 check (average_response_time_ms >= 0),
  created_at timestamptz not null default now(),
  unique (game_id, player_id),
  unique (game_id, rank)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'multiplayer_lobbies_host_player_fk'
  ) then
    alter table public.multiplayer_lobbies
      add constraint multiplayer_lobbies_host_player_fk
      foreign key (host_player_id) references public.multiplayer_players(id) on delete set null
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'multiplayer_lobbies_game_fk'
  ) then
    alter table public.multiplayer_lobbies
      add constraint multiplayer_lobbies_game_fk
      foreign key (game_id) references public.multiplayer_games(id) on delete set null
      not valid;
  end if;
end $$;

create index if not exists multiplayer_lobbies_open_idx
  on public.multiplayer_lobbies (visibility, status, max_players, updated_at desc)
  where status in ('waiting', 'ready');

create index if not exists multiplayer_players_lobby_idx
  on public.multiplayer_players (lobby_id, is_connected, position);

create index if not exists multiplayer_players_identity_idx
  on public.multiplayer_players (lobby_id, auth_user_id, anonymous_id);

create unique index if not exists multiplayer_players_lobby_anonymous_unique_idx
  on public.multiplayer_players (lobby_id, anonymous_id);

create unique index if not exists multiplayer_players_lobby_auth_user_unique_idx
  on public.multiplayer_players (lobby_id, auth_user_id)
  where auth_user_id is not null;

create unique index if not exists multiplayer_players_lobby_nickname_lower_unique_idx
  on public.multiplayer_players (lobby_id, lower(nickname));

create index if not exists multiplayer_rounds_game_idx
  on public.multiplayer_rounds (game_id, round_number);

create index if not exists multiplayer_answers_game_idx
  on public.multiplayer_answers (game_id, round_id, submitted_at);

create unique index if not exists multiplayer_answers_one_awarded_winner_idx
  on public.multiplayer_answers (round_id)
  where is_correct = true and awarded_prize > 0;

create index if not exists multiplayer_results_game_rank_idx
  on public.multiplayer_results (game_id, rank);

alter table public.multiplayer_lobbies enable row level security;
alter table public.multiplayer_players enable row level security;
alter table public.multiplayer_games enable row level security;
alter table public.multiplayer_rounds enable row level security;
alter table public.multiplayer_answers enable row level security;
alter table public.multiplayer_results enable row level security;

drop policy if exists "multiplayer_lobbies_public_read" on public.multiplayer_lobbies;
drop policy if exists "multiplayer_players_public_read" on public.multiplayer_players;
drop policy if exists "multiplayer_games_public_read" on public.multiplayer_games;
drop policy if exists "multiplayer_rounds_public_read" on public.multiplayer_rounds;
drop policy if exists "multiplayer_answers_public_read_winners" on public.multiplayer_answers;
drop policy if exists "multiplayer_results_public_read" on public.multiplayer_results;

create policy "multiplayer_lobbies_public_read"
on public.multiplayer_lobbies
for select
to anon, authenticated
using (visibility = 'public');

create policy "multiplayer_games_public_read"
on public.multiplayer_games
for select
to anon, authenticated
using (true);

create policy "multiplayer_results_public_read"
on public.multiplayer_results
for select
to anon, authenticated
using (true);

drop policy if exists "multiplayer_lobbies_service_role_all" on public.multiplayer_lobbies;
drop policy if exists "multiplayer_players_service_role_all" on public.multiplayer_players;
drop policy if exists "multiplayer_games_service_role_all" on public.multiplayer_games;
drop policy if exists "multiplayer_rounds_service_role_all" on public.multiplayer_rounds;
drop policy if exists "multiplayer_answers_service_role_all" on public.multiplayer_answers;
drop policy if exists "multiplayer_results_service_role_all" on public.multiplayer_results;

create policy "multiplayer_lobbies_service_role_all"
on public.multiplayer_lobbies
for all
to service_role
using (true)
with check (true);

create policy "multiplayer_players_service_role_all"
on public.multiplayer_players
for all
to service_role
using (true)
with check (true);

create policy "multiplayer_games_service_role_all"
on public.multiplayer_games
for all
to service_role
using (true)
with check (true);

create policy "multiplayer_rounds_service_role_all"
on public.multiplayer_rounds
for all
to service_role
using (true)
with check (true);

create policy "multiplayer_answers_service_role_all"
on public.multiplayer_answers
for all
to service_role
using (true)
with check (true);

create policy "multiplayer_results_service_role_all"
on public.multiplayer_results
for all
to service_role
using (true)
with check (true);

revoke all on public.multiplayer_lobbies from public, anon, authenticated;
revoke all on public.multiplayer_players from public, anon, authenticated;
revoke all on public.multiplayer_games from public, anon, authenticated;
revoke all on public.multiplayer_rounds from public, anon, authenticated;
revoke all on public.multiplayer_answers from public, anon, authenticated;
revoke all on public.multiplayer_results from public, anon, authenticated;

grant select on public.multiplayer_lobbies to anon, authenticated;
grant select on public.multiplayer_games to anon, authenticated;
grant select on public.multiplayer_results to anon, authenticated;

grant all on public.multiplayer_lobbies to service_role;
grant all on public.multiplayer_players to service_role;
grant all on public.multiplayer_games to service_role;
grant all on public.multiplayer_rounds to service_role;
grant all on public.multiplayer_answers to service_role;
grant all on public.multiplayer_results to service_role;
