-- 012_multiplayer_head_to_head.sql
-- Stage 18 — Multiplayer is strictly head-to-head (exactly two players).
-- Additive and production-safe: the default drops to two and a CHECK enforces
-- the cap for every NEW/updated lobby, while NOT VALID preserves existing
-- historical rows (legacy 3-4 player lobbies are neither validated nor
-- corrupted). The application service layer additionally hard-caps joins at
-- two, so even a legacy active lobby can never gain a third participant.

alter table public.multiplayer_lobbies
  alter column max_players set default 2;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'multiplayer_lobbies_head_to_head'
      and conrelid = 'public.multiplayer_lobbies'::regclass
  ) then
    alter table public.multiplayer_lobbies
      add constraint multiplayer_lobbies_head_to_head check (max_players <= 2) not valid;
  end if;
end $$;
