-- 011: Reward stats persistence (Stage 10B, Increment 6).
--
-- Additive and idempotent. NEVER edits 010. Adds the one column 010 lacks: a
-- home for the cumulative reward COUNTERS the badge/title evaluators need but
-- that don't fall out of the money or mastery aggregates —
-- lifeline-free wins, comeback wins, fast answers, multiplayer wins and the set
-- of distinct categories played. Without this, those achievements would reset on
-- every load in database mode. Stored as a single jsonb blob on the career row
-- (career-level aggregate state), so the Supabase rewards provider round-trips
-- byte-for-byte with the local provider.
--
-- SECURITY: inherits career_earnings' existing service-role-only RLS from 010 —
-- no client may write it.

alter table public.career_earnings
  add column if not exists stats jsonb not null default '{}'::jsonb;
