/**
 * Rewards repository — persistence boundary for the Stage 10B ecosystem.
 *
 * The engine (`@/lib/rewards`) owns the RULES; this owns STORAGE. Two provider
 * implementations satisfy the same interface — an in-memory/local one (below) and
 * a Supabase one mapping to the `010_rewards_progression` tables (added when the
 * central provider aggregate is wired in the next increment). Keeping this a
 * standalone module means the domain + contracts + migration land now with zero
 * risk to the existing provider factory.
 *
 * Server-authoritative: mutations flow through here, never straight from a client
 * (the migration's RLS is service-role only), so no client can self-grant.
 */

import {
  appendCareerEntry,
  defaultIdentity,
  emptyCabinet,
  emptyCareer,
  emptyRewardStats,
  emptyStreak,
  starterEntitlements
} from '@/lib/rewards';
import type {
  AchievementBadge,
  CareerEarnings,
  CareerLedgerEntry,
  CategoryMastery,
  CollectionState,
  CosmeticEntitlement,
  DailyQuestionState,
  DailyStreak,
  PlayerIdentity,
  PlayerKey,
  PlayerRewardStats,
  PlayerTitle,
  TimelineEvent,
  TrophyCabinet,
  WeeklyObjectiveProgress
} from '@/lib/rewards/types';

/** The full persisted rewards state for one player. */
export type RewardsProfileSnapshot = {
  identity: PlayerIdentity;
  career: CareerEarnings;
  titles: PlayerTitle[];
  badges: AchievementBadge[];
  trophyCabinet: TrophyCabinet;
  mastery: CategoryMastery[];
  collections: CollectionState[];
  streak: DailyStreak;
  daily: DailyQuestionState | null;
  weekly: WeeklyObjectiveProgress[];
  cosmetics: CosmeticEntitlement[];
  timeline: TimelineEvent[];
  stats: PlayerRewardStats;
};

/** A complete, quiet default snapshot for a player who has never earned anything. */
export function emptyRewardsSnapshot(playerKey: PlayerKey, displayName: string, nowIso: string): RewardsProfileSnapshot {
  return {
    identity: defaultIdentity(playerKey, displayName),
    career: emptyCareer(),
    titles: [],
    badges: [],
    trophyCabinet: emptyCabinet(6),
    mastery: [],
    collections: [],
    streak: emptyStreak(),
    daily: null,
    weekly: [],
    cosmetics: starterEntitlements(nowIso),
    timeline: [],
    stats: emptyRewardStats()
  };
}

export interface RewardsRepository {
  /** Load a player's snapshot, creating a quiet default if none exists yet. */
  load(playerKey: PlayerKey, displayName?: string): Promise<RewardsProfileSnapshot>;
  /** Persist a full snapshot (the caller runs the pure engine, then saves). */
  save(snapshot: RewardsProfileSnapshot): Promise<RewardsProfileSnapshot>;
  /** Idempotently append a career-ledger entry (retries never double-count). */
  appendLedgerEntry(playerKey: PlayerKey, entry: CareerLedgerEntry): Promise<CareerEarnings>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * In-memory rewards repository — the local provider. Deterministic and dependency
 * free; deep-clones on the boundary so callers can never mutate stored state. The
 * same interface backs the Supabase provider (documented in the migration).
 */
export function createInMemoryRewardsRepository(nowIsoFactory: () => string = () => new Date().toISOString()): RewardsRepository {
  const store = new Map<PlayerKey, RewardsProfileSnapshot>();

  function ensure(playerKey: PlayerKey, displayName = ''): RewardsProfileSnapshot {
    const existing = store.get(playerKey);
    if (existing) return existing;
    const seeded = emptyRewardsSnapshot(playerKey, displayName, nowIsoFactory());
    store.set(playerKey, seeded);
    return seeded;
  }

  return {
    async load(playerKey, displayName) {
      return clone(ensure(playerKey, displayName));
    },
    async save(snapshot) {
      store.set(snapshot.identity.playerKey, clone(snapshot));
      return clone(snapshot);
    },
    async appendLedgerEntry(playerKey, entry) {
      const snapshot = ensure(playerKey);
      const career = appendCareerEntry(snapshot.career, entry);
      store.set(playerKey, { ...snapshot, career });
      return clone(career);
    }
  };
}
