/**
 * Rewards & retention API contracts — Stage 10B (Phase 19).
 *
 * Versionable, platform-neutral response shapes + dependency-free runtime guards.
 * Web, iOS and Android clients import from here rather than reaching into the
 * domain or database. Internal database shapes are never exposed directly; these
 * DTOs are the stable surface. Lists that can grow are paginated; reward claims
 * carry an idempotency key so retries never double-grant.
 */

import { isRecord } from './common';
import type {
  AchievementBadge,
  CareerLedgerEntry,
  CategoryMastery,
  CollectionState,
  CosmeticEntitlement,
  DailyQuestionState,
  DailyStreak,
  DisclosureState,
  PlayerIdentity,
  PlayerTitle,
  RevealItem,
  TrophyCabinet,
  WeeklyObjectiveProgress
} from '@/lib/rewards/types';

/** Bumped only on a breaking change to a rewards response shape. */
export const REWARDS_CONTRACT_VERSION = '2026-07-10';

/** Stable, explicit error codes for every rewards endpoint. */
export type RewardsErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'already_claimed'
  | 'not_eligible'
  | 'invalid_request'
  | 'rate_limited'
  | 'conflict';

/** Career Earnings summary — the permanent dollar record (never a "wallet"). */
export type CareerSummaryDto = {
  lifetimeTotal: number;
  spendableBalance: number;
  bestSingleGame: number;
  millionaireWins: number;
  perfectRuns: number;
  cashOutTotal: number;
  gamesWon: number;
  gamesPlayed: number;
};

/** Compact identity signal for Leaderboard rows and multiplayer surfaces. */
export type IdentitySummaryDto = {
  playerKey: string;
  displayName: string;
  monogramSeed: string;
  activeTitleId: string | null;
  activeTitleNameKey: string | null;
  profileFrameId: string;
  streakCurrent: number;
};

/** The full Profile payload (Profile is the home of identity + depth). */
export type FullProfileDto = {
  identity: PlayerIdentity;
  career: CareerSummaryDto;
  titles: PlayerTitle[];
  /** Full badge catalogue projected with progress (hidden+locked filtered client-side). */
  badges: AchievementBadge[];
  pinnedBadges: AchievementBadge[];
  trophyCabinet: TrophyCabinet;
  /** Showcase-eligible item ids the player owns (cabinet + pin candidates). */
  showcaseItemIds: string[];
  mastery: CategoryMastery[];
  collections: CollectionSummaryDto[];
  cosmetics: CosmeticEntitlement[];
  disclosure: DisclosureState;
};

/** Lightweight rewards summary — powers progressive disclosure without a dashboard. */
export type RewardsSummaryDto = {
  career: CareerSummaryDto;
  streak: DailyStreak;
  disclosure: DisclosureState;
  unclaimedWeeklyCount: number;
  dailyAvailable: boolean;
};

/** Post-game progression: what to reveal (ordered) + the new persisted summary. */
export type ResultProgressionUpdateDto = {
  reveals: RevealItem[];
  career: CareerSummaryDto;
  newTitleIds: string[];
  newBadgeIds: string[];
  streak: DailyStreak;
};

/** Generic cursor page for lists that can grow unbounded (e.g. the ledger). */
export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  total?: number;
};

export type CareerLedgerPageDto = Page<CareerLedgerEntry>;
export type DailyChallengeDto = { state: DailyQuestionState | null; available: boolean; rewardAmount: number };
export type WeeklyObjectivesDto = { weekKey: string; objectives: WeeklyObjectiveProgress[] };
export type BadgeCatalogueDto = { badges: AchievementBadge[] };
export type TitleCatalogueDto = { titles: PlayerTitle[] };
export type MasteryDto = { categories: CategoryMastery[] };
export type CollectionSummaryDto = CollectionState & { completion: number; totalItems: number };
export type CollectionsDto = { collections: CollectionSummaryDto[] };
export type CosmeticCatalogueDto = { cosmetics: CosmeticEntitlement[] };

/* ---------------- Requests (server validates; the client never self-grants) ---------------- */

export type EquipCosmeticRequest = { cosmeticId: string };
export type EquipCosmeticResponse = { ok: true; cosmetics: CosmeticEntitlement[] };

export type PinBadgeRequest = { badgeId: string; pinned: boolean };
export type EquipTitleRequest = { titleId: string | null };

/** Reward claims are idempotent — a retried `idempotencyKey` returns the same result. */
export type ClaimRewardRequest = { rewardId: string; idempotencyKey: string };
export type ClaimRewardResponse = { ok: true; granted: number; alreadyClaimed: boolean };

/* ---------------- Runtime guards ---------------- */

export function isCareerSummaryDto(value: unknown): value is CareerSummaryDto {
  if (!isRecord(value)) return false;
  return (
    typeof value.lifetimeTotal === 'number' &&
    typeof value.spendableBalance === 'number' &&
    typeof value.gamesPlayed === 'number'
  );
}

export function isIdentitySummaryDto(value: unknown): value is IdentitySummaryDto {
  if (!isRecord(value)) return false;
  return (
    typeof value.playerKey === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.monogramSeed === 'string' &&
    (value.activeTitleId === null || typeof value.activeTitleId === 'string') &&
    typeof value.profileFrameId === 'string' &&
    typeof value.streakCurrent === 'number'
  );
}

export function isRewardsSummaryDto(value: unknown): value is RewardsSummaryDto {
  if (!isRecord(value)) return false;
  if (!isCareerSummaryDto(value.career)) return false;
  if (!isRecord(value.streak) || typeof value.streak.current !== 'number') return false;
  return typeof value.dailyAvailable === 'boolean' && typeof value.unclaimedWeeklyCount === 'number';
}

export function isCareerLedgerPageDto(value: unknown): value is CareerLedgerPageDto {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.items)) return false;
  if (!(value.nextCursor === null || typeof value.nextCursor === 'string')) return false;
  return value.items.every(item => isRecord(item) && typeof item.idempotencyKey === 'string' && typeof item.amount === 'number');
}

export function isClaimRewardResponse(value: unknown): value is ClaimRewardResponse {
  if (!isRecord(value) || value.ok !== true) return false;
  return typeof value.granted === 'number' && typeof value.alreadyClaimed === 'boolean';
}

export function isClaimRewardRequest(value: unknown): value is ClaimRewardRequest {
  if (!isRecord(value)) return false;
  return typeof value.rewardId === 'string' && typeof value.idempotencyKey === 'string' && value.idempotencyKey.length > 0;
}

export function isResultProgressionUpdateDto(value: unknown): value is ResultProgressionUpdateDto {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.reveals)) return false;
  if (!isCareerSummaryDto(value.career)) return false;
  return Array.isArray(value.newTitleIds) && Array.isArray(value.newBadgeIds);
}
