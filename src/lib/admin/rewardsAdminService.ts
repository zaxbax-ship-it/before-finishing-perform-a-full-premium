import 'server-only';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import type { AdminContext } from '@/lib/auth/types';
import type { RewardsRepository } from '@/lib/repositories/rewardsRepository';
import { getDatabaseConfig, isSupabaseConfigured } from '@/lib/database/config';
import {
  BADGES,
  COLLECTIONS,
  COSMETICS,
  MASTERY_TIERS,
  TITLES,
  WEEKLY_OBJECTIVES,
  badgeById,
  cosmeticById,
  grantCosmetic,
  titleById
} from '@/lib/rewards';
import type {
  AchievementBadge,
  CareerLedgerEntry,
  CategoryMastery,
  CollectionState,
  CosmeticEntitlement,
  DailyQuestionState,
  DailyStreak,
  PlayerTitle,
  WeeklyObjectiveProgress
} from '@/lib/rewards/types';

/**
 * Admin Console — reward management (Stage 10B, Increment 7).
 *
 * Server-authoritative operations over the rewards repository, for administrators
 * holding `rewards.read` / `rewards.manage`. Every mutation is audit-logged with
 * the acting admin's identity. The economy stays dollars-only: the only monetary
 * grant is a Career-Earnings ledger ADJUSTMENT (idempotent, append-only). There is
 * no second currency, and nothing here confers gameplay power — grants are
 * identity/cosmetic entitlements and honor-record corrections only.
 *
 * Reward DEFINITIONS (titles, badges, mastery tiers, weekly objectives, cosmetics,
 * collections) are code-owned and platform-neutral, so "management" here is
 * authoritative inspection of the live catalogue plus per-player entitlement
 * grant/revoke — never editable rules that could drift between the web, server and
 * future native clients.
 */

/* ============================ Catalogue inspection ============================ */

export type RewardsCatalogueDto = {
  counts: { titles: number; badges: number; cosmetics: number; collections: number; weeklyObjectives: number; masteryTiers: number };
  titles: Array<{ id: string; nameKey: string; rarity: string }>;
  badges: Array<{ id: string; category: string; rarity: string; nameKey: string; target: number; hidden: boolean; showcaseEligible: boolean }>;
  masteryTiers: Array<{ tier: string; minXp: number }>;
  weeklyObjectives: Array<{ id: string; metric: string; target: number; rewardAmount: number }>;
  cosmetics: Array<{ id: string; type: string; source: string; starter: boolean }>;
  collections: Array<{ id: string; completionReward: string; completionRewardId: string }>;
};

export function getRewardsCatalogue(): RewardsCatalogueDto {
  return {
    counts: {
      titles: TITLES.length,
      badges: BADGES.length,
      cosmetics: COSMETICS.length,
      collections: COLLECTIONS.length,
      weeklyObjectives: WEEKLY_OBJECTIVES.length,
      masteryTiers: MASTERY_TIERS.length
    },
    titles: TITLES.map(t => ({ id: t.id, nameKey: t.nameKey, rarity: t.rarity })),
    badges: BADGES.map(b => ({ id: b.id, category: b.category, rarity: b.rarity, nameKey: b.nameKey, target: b.target, hidden: b.hidden, showcaseEligible: b.showcaseEligible })),
    masteryTiers: MASTERY_TIERS.map(m => ({ tier: m.tier, minXp: m.minXp })),
    weeklyObjectives: WEEKLY_OBJECTIVES.map(o => ({ id: o.id, metric: o.metric, target: o.target, rewardAmount: o.rewardAmount })),
    cosmetics: COSMETICS.map(c => ({ id: c.id, type: c.type, source: c.source, starter: c.starter })),
    collections: COLLECTIONS.map(c => ({ id: c.id, completionReward: c.completionReward, completionRewardId: c.completionRewardId }))
  };
}

/* ============================ Player entitlement + ledger inspection ============================ */

export type PlayerRewardsInspection = {
  playerKey: string;
  identity: { displayName: string; activeTitleId: string | null; pinnedBadgeIds: string[]; equippedThemeId: string; profileFrameId: string };
  career: {
    lifetimeTotal: number;
    spendableBalance: number;
    bestSingleGame: number;
    gamesPlayed: number;
    gamesWon: number;
    millionaireWins: number;
    perfectRuns: number;
    cashOutTotal: number;
    ledger: CareerLedgerEntry[];
  };
  titles: PlayerTitle[];
  unlockedBadges: Array<{ id: string; unlockedAt: string | null; current: number; target: number }>;
  cosmetics: CosmeticEntitlement[];
  mastery: CategoryMastery[];
  collections: CollectionState[];
  streak: DailyStreak;
  daily: DailyQuestionState | null;
  weekly: WeeklyObjectiveProgress[];
};

function inspectionFrom(playerKey: string, snapshot: Awaited<ReturnType<RewardsRepository['load']>>): PlayerRewardsInspection {
  return {
    playerKey,
    identity: {
      displayName: snapshot.identity.displayName,
      activeTitleId: snapshot.identity.activeTitleId,
      pinnedBadgeIds: snapshot.identity.pinnedBadgeIds,
      equippedThemeId: snapshot.identity.equippedThemeId,
      profileFrameId: snapshot.identity.profileFrameId
    },
    career: {
      lifetimeTotal: snapshot.career.lifetimeTotal,
      spendableBalance: snapshot.career.spendableBalance,
      bestSingleGame: snapshot.career.bestSingleGame,
      gamesPlayed: snapshot.career.gamesPlayed,
      gamesWon: snapshot.career.gamesWon,
      millionaireWins: snapshot.career.millionaireWins,
      perfectRuns: snapshot.career.perfectRuns,
      cashOutTotal: snapshot.career.cashOutTotal,
      ledger: [...snapshot.career.ledger].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    titles: snapshot.titles,
    unlockedBadges: snapshot.badges.filter(b => b.unlockedAt).map(b => ({ id: b.id, unlockedAt: b.unlockedAt, current: b.current, target: b.target })),
    cosmetics: snapshot.cosmetics,
    mastery: snapshot.mastery,
    collections: snapshot.collections,
    streak: snapshot.streak,
    daily: snapshot.daily,
    weekly: snapshot.weekly
  };
}

export async function inspectPlayerRewards(rewardsRepo: RewardsRepository, playerKey: string): Promise<PlayerRewardsInspection> {
  const snapshot = await rewardsRepo.load(playerKey);
  return inspectionFrom(playerKey, snapshot);
}

/* ============================ Secure grant / revoke ============================ */

export type GrantRequest =
  | { kind: 'cosmetic'; cosmeticId: string }
  | { kind: 'title'; titleId: string }
  | { kind: 'badge'; badgeId: string }
  | { kind: 'career-adjustment'; amount: number; reason: string; idempotencyKey: string };

export type RevokeRequest =
  | { kind: 'cosmetic'; cosmeticId: string }
  | { kind: 'title'; titleId: string }
  | { kind: 'badge'; badgeId: string };

export type AdminRewardResult = { ok: true; inspection: PlayerRewardsInspection } | { ok: false; error: string };

async function writeAudit(repositories: RepositoryProvider, actor: AdminContext, action: string, playerKey: string, details: Record<string, unknown>) {
  await repositories.auditLogs.create({
    actorLabel: actor.email,
    action,
    targetType: 'rewards',
    targetId: playerKey,
    details
  });
}

export async function grantReward(
  rewardsRepo: RewardsRepository,
  repositories: RepositoryProvider,
  actor: AdminContext,
  playerKey: string,
  request: GrantRequest,
  nowIso: string = new Date().toISOString()
): Promise<AdminRewardResult> {
  const snapshot = await rewardsRepo.load(playerKey);

  switch (request.kind) {
    case 'cosmetic': {
      if (!cosmeticById(request.cosmeticId)) return { ok: false, error: `Unknown cosmetic: ${request.cosmeticId}` };
      const cosmetics = grantCosmetic(snapshot.cosmetics, request.cosmeticId, nowIso);
      await rewardsRepo.save({ ...snapshot, cosmetics });
      break;
    }
    case 'title': {
      const def = titleById(request.titleId);
      if (!def) return { ok: false, error: `Unknown title: ${request.titleId}` };
      if (snapshot.titles.some(t => t.id === def.id)) return { ok: false, error: 'Player already holds this title.' };
      const title: PlayerTitle = { id: def.id, nameKey: def.nameKey, descriptionKey: def.descriptionKey, rarity: def.rarity, earnedAt: nowIso, equipped: false };
      await rewardsRepo.save({ ...snapshot, titles: [...snapshot.titles, title] });
      break;
    }
    case 'badge': {
      const def = badgeById(request.badgeId);
      if (!def) return { ok: false, error: `Unknown badge: ${request.badgeId}` };
      if (snapshot.badges.some(b => b.id === def.id && b.unlockedAt)) return { ok: false, error: 'Player already holds this badge.' };
      const badge: AchievementBadge = {
        id: def.id, category: def.category, rarity: def.rarity, nameKey: def.nameKey, descriptionKey: def.descriptionKey,
        target: def.target, current: def.target, unlockedAt: nowIso, hidden: def.hidden, showcaseEligible: def.showcaseEligible
      };
      const badges = [...snapshot.badges.filter(b => b.id !== def.id), badge];
      await rewardsRepo.save({ ...snapshot, badges });
      break;
    }
    case 'career-adjustment': {
      if (!Number.isFinite(request.amount) || request.amount === 0) return { ok: false, error: 'Adjustment amount must be a non-zero number.' };
      const entry: CareerLedgerEntry = {
        id: `admin-adj-${request.idempotencyKey}`,
        kind: 'adjustment',
        amount: request.amount,
        idempotencyKey: `admin-adj:${request.idempotencyKey}`,
        createdAt: nowIso,
        metadata: { reason: request.reason, admin: actor.email }
      };
      // Idempotent + server-authoritative: honor-record rules live in the engine.
      await rewardsRepo.appendLedgerEntry(playerKey, entry);
      break;
    }
    default:
      return { ok: false, error: 'Unsupported grant kind.' };
  }

  await writeAudit(repositories, actor, 'admin_rewards_grant', playerKey, { ...request });
  return { ok: true, inspection: await inspectPlayerRewards(rewardsRepo, playerKey) };
}

export async function revokeReward(
  rewardsRepo: RewardsRepository,
  repositories: RepositoryProvider,
  actor: AdminContext,
  playerKey: string,
  request: RevokeRequest,
  nowIso: string = new Date().toISOString()
): Promise<AdminRewardResult> {
  const snapshot = await rewardsRepo.load(playerKey);

  switch (request.kind) {
    case 'cosmetic': {
      const def = cosmeticById(request.cosmeticId);
      if (!def) return { ok: false, error: `Unknown cosmetic: ${request.cosmeticId}` };
      if (def.starter) return { ok: false, error: 'Starter cosmetics cannot be revoked.' };
      const owned = snapshot.cosmetics.find(c => c.cosmeticId === request.cosmeticId);
      if (!owned) return { ok: false, error: 'Player does not own this cosmetic.' };
      let cosmetics = snapshot.cosmetics.filter(c => c.cosmeticId !== request.cosmeticId);
      // Keep a valid equipped state: if we removed the equipped item of its type,
      // fall back to that type's starter cosmetic.
      if (owned.equipped && !cosmetics.some(c => c.type === owned.type && c.equipped)) {
        cosmetics = cosmetics.map(c => (c.type === owned.type && c.source === 'starter' ? { ...c, equipped: true } : c));
      }
      await rewardsRepo.save({ ...snapshot, cosmetics });
      break;
    }
    case 'title': {
      if (!snapshot.titles.some(t => t.id === request.titleId)) return { ok: false, error: 'Player does not hold this title.' };
      const titles = snapshot.titles.filter(t => t.id !== request.titleId);
      const activeTitleId = snapshot.identity.activeTitleId === request.titleId ? null : snapshot.identity.activeTitleId;
      await rewardsRepo.save({ ...snapshot, titles, identity: { ...snapshot.identity, activeTitleId } });
      break;
    }
    case 'badge': {
      if (!snapshot.badges.some(b => b.id === request.badgeId && b.unlockedAt)) return { ok: false, error: 'Player does not hold this badge.' };
      const badges = snapshot.badges.filter(b => b.id !== request.badgeId);
      const pinnedBadgeIds = snapshot.identity.pinnedBadgeIds.filter(id => id !== request.badgeId);
      const slots = snapshot.trophyCabinet.slots.map(s => (s === request.badgeId ? null : s));
      await rewardsRepo.save({
        ...snapshot,
        badges,
        identity: { ...snapshot.identity, pinnedBadgeIds },
        trophyCabinet: { ...snapshot.trophyCabinet, slots }
      });
      break;
    }
    default:
      return { ok: false, error: 'Unsupported revoke kind.' };
  }

  await writeAudit(repositories, actor, 'admin_rewards_revoke', playerKey, { ...request });
  return { ok: true, inspection: await inspectPlayerRewards(rewardsRepo, playerKey) };
}

/* ============================ Health / observability ============================ */

export type RewardsHealthDto = {
  generatedAt: string;
  provider: 'supabase' | 'in-memory';
  economy: { currency: 'USD'; alternateCurrencies: 0; ledgerModel: 'append-only-idempotent'; careerEarningsRule: 'lifetime-only-grows' };
  catalogue: RewardsCatalogueDto['counts'];
  recentAdminActions: Array<{ action: string; actor: string; playerKey: string; at: string; details: unknown }>;
};

export async function getRewardsAdminOverview(repositories: RepositoryProvider): Promise<RewardsHealthDto> {
  const config = getDatabaseConfig();
  const provider: RewardsHealthDto['provider'] = config.mode === 'supabase' && isSupabaseConfigured(config) ? 'supabase' : 'in-memory';
  const auditLogs = await repositories.auditLogs.list({ limit: 200 });
  const recentAdminActions = auditLogs
    .filter(log => log.action === 'admin_rewards_grant' || log.action === 'admin_rewards_revoke')
    .slice(0, 25)
    .map(log => ({ action: log.action, actor: log.actor, playerKey: log.target, at: log.createdAt, details: safeJson(log.details) }));

  return {
    generatedAt: new Date().toISOString(),
    provider,
    economy: { currency: 'USD', alternateCurrencies: 0, ledgerModel: 'append-only-idempotent', careerEarningsRule: 'lifetime-only-grows' },
    catalogue: getRewardsCatalogue().counts,
    recentAdminActions
  };
}

function safeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
