-- 010: Rewards & retention persistence (Stage 10B, Version 1, dollars-only).
--
-- Additive and idempotent — safe to run on an existing database and NEVER edits
-- migrations 001–009. `player_key` matches the identity used by progression,
-- leaderboard and multiplayer: the authenticated user id when signed in,
-- otherwise the anonymous device id.
--
-- CURRENCY: one monetary language — dollars. `career_earnings` is the permanent
-- lifetime record; `career_ledger` is the immutable, idempotent entry log
-- (unique on (player_key, idempotency_key) so a retried grant never double-counts).
-- There is no second invented currency.
--
-- SECURITY: every table is service-role only for now (server-authoritative). No
-- client may grant itself titles, badges, entitlements or dollars — writes go
-- through the server. Public read policies can be layered on when these surface
-- in social features (leaderboard identity signals), without editing this file.

-- ---------------------------------------------------------------- identity
create table if not exists public.player_identity (
  player_key text primary key,
  display_name text not null default '',
  monogram_seed text not null default '',
  active_title_id text,
  profile_frame_id text not null default 'frame-classic',
  pinned_badge_ids jsonb not null default '[]'::jsonb,
  equipped_theme_id text not null default 'theme-studio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- titles
create table if not exists public.player_titles (
  player_key text not null,
  title_id text not null,
  earned_at timestamptz not null default now(),
  equipped boolean not null default false,
  primary key (player_key, title_id)
);

-- ---------------------------------------------------------------- badges
create table if not exists public.player_badges (
  player_key text not null,
  badge_id text not null,
  progress integer not null default 0,
  unlocked_at timestamptz,
  primary key (player_key, badge_id)
);
create index if not exists player_badges_unlocked_idx
  on public.player_badges (player_key) where unlocked_at is not null;

-- ---------------------------------------------------------------- trophy cabinet
create table if not exists public.trophy_cabinet (
  player_key text primary key,
  slots jsonb not null default '[]'::jsonb,
  max_slots integer not null default 6,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- category mastery
create table if not exists public.category_mastery (
  player_key text not null,
  category_id text not null,
  mastery_xp integer not null default 0,
  tier text not null default 'none',
  games_played integer not null default 0,
  correct_answers integer not null default 0,
  questions_faced integer not null default 0,
  milestones jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_key, category_id)
);

-- ---------------------------------------------------------------- collections
create table if not exists public.player_collections (
  player_key text not null,
  collection_id text not null,
  earned_item_ids jsonb not null default '[]'::jsonb,
  completion_reward text,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (player_key, collection_id)
);

-- ---------------------------------------------------------------- career earnings (record)
create table if not exists public.career_earnings (
  player_key text primary key,
  lifetime_total bigint not null default 0,
  spendable_balance bigint not null default 0,
  best_single_game bigint not null default 0,
  millionaire_wins integer not null default 0,
  perfect_runs integer not null default 0,
  cash_out_total bigint not null default 0,
  games_won integer not null default 0,
  games_played integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint career_spendable_non_negative check (spendable_balance >= 0)
);

-- ---------------------------------------------------------------- career ledger (immutable)
create table if not exists public.career_ledger (
  id text primary key default gen_random_uuid()::text,
  player_key text not null,
  kind text not null,
  amount bigint not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- idempotency: a retried grant with the same key is rejected by this constraint.
  constraint career_ledger_idempotent unique (player_key, idempotency_key)
);
create index if not exists career_ledger_player_idx
  on public.career_ledger (player_key, created_at desc);

-- ---------------------------------------------------------------- daily streak
create table if not exists public.daily_streak (
  player_key text primary key,
  current integer not null default 0,
  longest integer not null default 0,
  last_qualifying_day date,
  repair_used_week text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- daily question
create table if not exists public.daily_question_state (
  player_key text not null,
  challenge_day date not null,
  question_id text not null,
  completed boolean not null default false,
  correct boolean,
  reward_claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (player_key, challenge_day)
);

-- ---------------------------------------------------------------- weekly objectives
create table if not exists public.weekly_objectives (
  player_key text not null,
  week_key text not null,
  objective_id text not null,
  progress integer not null default 0,
  target integer not null default 1,
  reward_amount bigint not null default 0,
  claimed boolean not null default false,
  seen_keys jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_key, week_key, objective_id)
);

-- ---------------------------------------------------------------- cosmetic entitlements
create table if not exists public.cosmetic_entitlements (
  player_key text not null,
  cosmetic_id text not null,
  type text not null,
  source text not null,
  unlocked_at timestamptz not null default now(),
  equipped boolean not null default false,
  primary key (player_key, cosmetic_id)
);

-- ---------------------------------------------------------------- profile timeline
create table if not exists public.profile_timeline (
  id text primary key default gen_random_uuid()::text,
  player_key text not null,
  event_type text not null,
  copy_key text not null,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  visible boolean not null default true,
  occurred_at timestamptz not null default now(),
  -- milestone dedupe: one row per natural key per player.
  constraint profile_timeline_dedupe unique (player_key, dedupe_key)
);
create index if not exists profile_timeline_player_idx
  on public.profile_timeline (player_key, occurred_at desc);

-- ---------------------------------------------------------------- RLS: service-role only
do $$
declare t text;
begin
  foreach t in array array[
    'player_identity','player_titles','player_badges','trophy_cabinet',
    'category_mastery','player_collections','career_earnings','career_ledger',
    'daily_streak','daily_question_state','weekly_objectives',
    'cosmetic_entitlements','profile_timeline'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_service_all', t);
    execute format(
      'create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      t || '_service_all', t
    );
  end loop;
end $$;
