-- Multiplayer lifeline state.
-- Run after database/004_multiplayer_schema.sql.
-- This keeps lifeline decisions server-side while preserving existing games and players.

alter table public.multiplayer_players
  add column if not exists lifelines jsonb not null default '{"fifty_fifty":1,"audience":1,"friend":1}'::jsonb,
  add column if not exists lifeline_uses jsonb not null default '[]'::jsonb,
  add column if not exists spent_prize integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'multiplayer_players_spent_prize_nonnegative'
      and conrelid = 'public.multiplayer_players'::regclass
  ) then
    alter table public.multiplayer_players
      add constraint multiplayer_players_spent_prize_nonnegative
      check (spent_prize >= 0)
      not valid;

    alter table public.multiplayer_players
      validate constraint multiplayer_players_spent_prize_nonnegative;
  end if;
end $$;

create index if not exists multiplayer_players_lifeline_uses_gin_idx
  on public.multiplayer_players using gin (lifeline_uses);
