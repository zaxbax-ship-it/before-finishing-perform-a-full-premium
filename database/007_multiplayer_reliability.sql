-- 007: Multiplayer reliability hardening.
--
-- Enforces "one winning answer per round" at the database level. The service
-- computes the winner with a check-then-insert, which two players answering
-- correctly at the same moment on separate server instances could both pass.
-- With this partial unique index the second winning insert fails; the service
-- already handles that failure by re-inserting the answer with a zero prize
-- (see submitAnswer's conflict-replay path), so behavior stays correct without
-- any application change.
--
-- Additive and idempotent; safe to run on an existing database.

create unique index if not exists multiplayer_answers_single_round_winner_idx
  on public.multiplayer_answers (round_id)
  where awarded_prize > 0;
