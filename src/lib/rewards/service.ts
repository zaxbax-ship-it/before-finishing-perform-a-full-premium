/**
 * Rewards service — runs the pure engine at the correct lifecycle events and
 * persists through the repository. This is the ONLY place that orchestrates the
 * transitions; the engine stays pure and the routes stay thin. Injectable
 * repository + `nowIso`/`dayKey` make it fully testable without a server.
 *
 * Dollars-only: rewards credit Career Earnings; there is no second currency.
 */

import {
  applyGameToCareer,
  applyGameToMastery,
  applyResultToWeekly,
  applyStreakDay,
  appendCareerEntry,
  badgeCatalogueFor,
  buildRevealQueue,
  claimDailyReward,
  claimWeeklyObjective,
  collectionCompletion,
  completeDailyQuestion,
  computeDisclosure,
  crossedCareerMilestones,
  crossedStreakMilestones,
  earnCollectionItem,
  emptyCollection,
  emptyMastery,
  equipCosmetic,
  equipTitle,
  evaluateBadges,
  evaluateTitles,
  grantCosmetic,
  hasEarnedMedallion,
  medallionItemId,
  pinBadge,
  resetWeeklyIfNeeded,
  startDailyQuestion,
  tierRank,
  toWeekKey,
  unpinBadge,
  COLLECTIONS,
  COSMETICS,
  DAILY_QUESTION_REWARD,
  titleById
} from '@/lib/rewards';
import type {
  MasteryTier,
  PlayerRewardContext,
  RevealItem,
  RewardGameResult,
  TimelineEvent,
  TimelineEventType
} from '@/lib/rewards/types';
import type { RewardsProfileSnapshot, RewardsRepository } from '@/lib/repositories/rewardsRepository';
import type {
  CareerSummaryDto,
  DailyChallengeDto,
  FullProfileDto,
  ResultProgressionUpdateDto,
  RewardsSummaryDto,
  WeeklyObjectivesDto
} from '@/lib/api/contracts/rewards';

/** Categories that don't count toward a single-category mastery track. */
const MIXED_CATEGORIES = new Set(['mixed', 'הכול', 'all']);

function careerSummary(snapshot: RewardsProfileSnapshot): CareerSummaryDto {
  const { ledger: _ledger, ...rest } = snapshot.career;
  void _ledger;
  return rest;
}

function masteryTiers(snapshot: RewardsProfileSnapshot): Partial<Record<string, MasteryTier>> {
  const map: Partial<Record<string, MasteryTier>> = {};
  for (const m of snapshot.mastery) if (m.tier !== 'none') map[m.categoryId] = m.tier;
  return map;
}

function ownedShowcaseIds(snapshot: RewardsProfileSnapshot): string[] {
  const badges = snapshot.badges.filter(b => b.showcaseEligible && b.unlockedAt).map(b => b.id);
  const medallions = snapshot.collections.flatMap(c => c.earnedItemIds);
  return [...badges, ...medallions];
}

/** Derive the flat evaluation snapshot the pure badge/title/disclosure rules read. */
export function buildContext(snapshot: RewardsProfileSnapshot): PlayerRewardContext {
  return {
    gamesPlayed: snapshot.career.gamesPlayed,
    gamesWon: snapshot.career.gamesWon,
    perfectRuns: snapshot.career.perfectRuns,
    millionaireWins: snapshot.career.millionaireWins,
    lifelineFreeWins: snapshot.stats.lifelineFreeWins,
    comebackWins: snapshot.stats.comebackWins,
    fastAnswerTotal: snapshot.stats.fastAnswerTotal,
    multiplayerWins: snapshot.stats.multiplayerWins,
    careerLifetime: snapshot.career.lifetimeTotal,
    longestStreak: snapshot.streak.longest,
    currentStreak: snapshot.streak.current,
    distinctCategoriesPlayed: snapshot.stats.distinctCategories.length,
    masteryTiersReached: masteryTiers(snapshot),
    unlockedBadgeIds: snapshot.badges.filter(b => b.unlockedAt).map(b => b.id),
    unlockedTitleIds: snapshot.titles.map(t => t.id),
    ownedShowcaseItemIds: ownedShowcaseIds(snapshot),
    ownedNonStarterCosmetics: snapshot.cosmetics.filter(c => c.source !== 'starter').length
  };
}

export type ApplyGameInput = {
  playerKey: string;
  displayName?: string;
  result: RewardGameResult;
  /** Stable id for idempotency — the same game can be applied twice with no effect. */
  gameId: string;
  /** Player-local calendar day; a completed game qualifies the streak for it. */
  dayKey: string;
  weekKey?: string;
  nowIso: string;
  /** XP/level movement is owned by the progression engine and passed in. */
  leveledUp?: boolean;
  newLevel?: number;
  /** Full medallion item-id set, so a collection can detect completion. */
  categoryMedallionIds?: string[];
};

/**
 * The game-end lifecycle handler. Runs every reward transition once, records
 * milestones, builds the ceremony queue, persists, and returns the progression
 * update. Idempotent by `gameId`: re-applying the same game returns the same
 * (unchanged) summary with no reveals beyond the result.
 */
export async function applyGameResult(repo: RewardsRepository, input: ApplyGameInput): Promise<ResultProgressionUpdateDto> {
  const { result, gameId, dayKey, nowIso } = input;
  const weekKey = input.weekKey ?? toWeekKey(dayKey);
  const snapshot = await repo.load(input.playerKey, input.displayName);

  const idempotencyKey = `game:${gameId}`;
  if (snapshot.career.ledger.some(e => e.idempotencyKey === idempotencyKey)) {
    return {
      reveals: [{ type: 'result', priority: 0, payload: {} }],
      career: careerSummary(snapshot),
      newTitleIds: [],
      newBadgeIds: [],
      streak: snapshot.streak
    };
  }

  const lifetimeBefore = snapshot.career.lifetimeTotal;
  const bestBefore = snapshot.career.bestSingleGame;
  const millionairesBefore = snapshot.career.millionaireWins;
  const streakBefore = snapshot.streak;

  // 1) Career record (credits the prize into the immutable ledger).
  const career = applyGameToCareer(snapshot.career, result, idempotencyKey, `${gameId}-entry`, nowIso);

  // 2) Per-game counter stats.
  const stats = {
    lifelineFreeWins: snapshot.stats.lifelineFreeWins + (result.won && result.lifelinesUsed === 0 ? 1 : 0),
    comebackWins: snapshot.stats.comebackWins + (result.won && result.livesLostBeforeWin >= 2 ? 1 : 0),
    fastAnswerTotal: snapshot.stats.fastAnswerTotal + Math.max(0, result.fastAnswers),
    multiplayerWins: snapshot.stats.multiplayerWins + (result.won && result.mode === 'multiplayer' ? 1 : 0),
    distinctCategories:
      MIXED_CATEGORIES.has(result.category) || snapshot.stats.distinctCategories.includes(result.category)
        ? snapshot.stats.distinctCategories
        : [...snapshot.stats.distinctCategories, result.category]
  };

  // 3) Category mastery (specific category only), tracking a tier-up + medallion.
  let mastery = snapshot.mastery;
  const masteryTierUps: { category: string; tier: MasteryTier }[] = [];
  let collections = snapshot.collections;
  const completedCollections: string[] = [];
  if (!MIXED_CATEGORIES.has(result.category)) {
    const existing = mastery.find(m => m.categoryId === result.category) ?? emptyMastery(result.category);
    const beforeTier = existing.tier;
    const updated = applyGameToMastery(existing, result.correctAnswers, result.questionsFaced);
    mastery = mastery.some(m => m.categoryId === result.category)
      ? mastery.map(m => (m.categoryId === result.category ? updated : m))
      : [...mastery, updated];
    if (tierRank(updated.tier) > tierRank(beforeTier)) masteryTierUps.push({ category: result.category, tier: updated.tier });

    if (hasEarnedMedallion(updated) && !hasEarnedMedallion(existing)) {
      const def = COLLECTIONS[0];
      const collection = collections.find(c => c.collectionId === def.id) ?? emptyCollection(def.id);
      const wasCompleted = collection.completed;
      const allIds = input.categoryMedallionIds ?? collection.earnedItemIds.concat(medallionItemId(result.category));
      const nextCollection = earnCollectionItem(collection, medallionItemId(result.category), allIds, def.completionReward);
      collections = collections.some(c => c.collectionId === def.id)
        ? collections.map(c => (c.collectionId === def.id ? nextCollection : c))
        : [...collections, nextCollection];
      if (nextCollection.completed && !wasCompleted) completedCollections.push(def.id);
    }
  }

  // 4) Streak — a completed game qualifies the local day.
  const streak = applyStreakDay(snapshot.streak, dayKey);

  // 5) Weekly objectives.
  const weekly = applyResultToWeekly(resetWeeklyIfNeeded(snapshot.weekly, weekKey), result);

  const draft: RewardsProfileSnapshot = { ...snapshot, career, stats, mastery, collections, streak, weekly };
  const context = buildContext(draft);

  // 6) Badges + titles (unlock-once, deterministic).
  const newBadges = evaluateBadges(context, snapshot.badges.map(b => b.id), nowIso);
  const badges = [...snapshot.badges, ...newBadges];
  const newTitles = evaluateTitles(context, snapshot.titles.map(t => t.id), nowIso);
  const titles = [...snapshot.titles, ...newTitles];

  // 7) Cosmetics granted by newly-unlocked badges/titles/collections (skill-neutral).
  let cosmetics = snapshot.cosmetics;
  const unlockedRefIds = new Set<string>([...newBadges.map(b => b.id), ...newTitles.map(t => t.id), ...completedCollections]);
  for (const cosmetic of COSMETICS) {
    if (!cosmetic.starter && cosmetic.unlockRef && unlockedRefIds.has(cosmetic.unlockRef)) {
      cosmetics = grantCosmetic(cosmetics, cosmetic.id, nowIso);
    }
  }

  // 8) Career + streak milestones.
  const careerMilestones = crossedCareerMilestones(lifetimeBefore, career.lifetimeTotal);
  const streakMilestones = crossedStreakMilestones(streakBefore.longest, streak.longest);

  // 9) Timeline milestones (deduped by natural key).
  let timeline = snapshot.timeline;
  const record = (type: TimelineEventType, copyKey: string, metadata?: Record<string, string | number>) => {
    timeline = recordTimeline(timeline, { type, copyKey, metadata, nowIso });
  };
  if (snapshot.career.gamesPlayed === 0) record('first-game', 'rewards.timeline.first_game');
  if (result.won && snapshot.career.gamesWon === 0) record('first-win', 'rewards.timeline.first_win');
  if (result.won && result.prize >= 1_000_000 && millionairesBefore === 0) record('first-millionaire', 'rewards.timeline.first_millionaire');
  if (result.won && result.correctAnswers >= 15 && snapshot.career.perfectRuns === 0) record('first-perfect', 'rewards.timeline.first_perfect');
  for (const t of newTitles) record('title-earned', 'rewards.timeline.title_earned', { title: t.id });
  for (const up of masteryTierUps) record('mastery-tier', 'rewards.timeline.mastery_tier', { category: up.category, tier: up.tier });
  for (const m of streakMilestones) record('streak-milestone', 'rewards.timeline.streak_milestone', { length: m });
  for (const m of careerMilestones) record('career-milestone', 'rewards.timeline.career_milestone', { amount: m });
  if (career.bestSingleGame > bestBefore && bestBefore > 0) record('personal-record', 'rewards.timeline.personal_record', { kind: 'best-prize', value: career.bestSingleGame });

  // 10) Identity summary refresh.
  const identity = {
    ...snapshot.identity,
    displayName: input.displayName ?? snapshot.identity.displayName,
    careerSummary: { lifetimeTotal: career.lifetimeTotal, bestSingleGame: career.bestSingleGame, gamesPlayed: career.gamesPlayed }
  };

  const persisted: RewardsProfileSnapshot = {
    ...snapshot,
    identity,
    career,
    stats,
    mastery,
    collections,
    streak,
    weekly,
    badges,
    titles,
    cosmetics,
    timeline
  };
  await repo.save(persisted);

  // 11) Ceremony queue.
  const reveals: RevealItem[] = buildRevealQueue({
    careerDelta: career.lifetimeTotal - lifetimeBefore,
    leveledUp: Boolean(input.leveledUp),
    newLevel: input.newLevel,
    streakChanged: streak.current !== streakBefore.current,
    streakCurrent: streak.current,
    streakMilestone: streakMilestones[0],
    newTitleIds: newTitles.map(t => t.id),
    newBadges,
    masteryTierUps,
    completedCollections,
    careerMilestone: careerMilestones[0],
    personalRecord: career.bestSingleGame > bestBefore && bestBefore > 0 ? career.bestSingleGame : undefined,
    firstMillionaire: result.won && result.prize >= 1_000_000 && millionairesBefore === 0
  });

  return {
    reveals,
    career: careerSummary(persisted),
    newTitleIds: newTitles.map(t => t.id),
    newBadgeIds: newBadges.map(b => b.id),
    streak
  };
}

function recordTimeline(
  events: TimelineEvent[],
  input: { type: TimelineEventType; copyKey: string; metadata?: Record<string, string | number>; nowIso: string }
): TimelineEvent[] {
  const candidate: TimelineEvent = {
    id: `${input.type}-${input.nowIso}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    copyKey: input.copyKey,
    timestamp: input.nowIso,
    metadata: input.metadata,
    visible: true
  };
  const key = timelineNaturalKey(candidate);
  if (events.some(e => timelineNaturalKey(e) === key)) return events;
  return [...events, candidate];
}

function timelineNaturalKey(event: { type: string; metadata?: Record<string, string | number> }): string {
  const meta = event.metadata ?? {};
  switch (event.type) {
    case 'mastery-tier':
      return `mastery-tier:${meta.category ?? ''}:${meta.tier ?? ''}`;
    case 'streak-milestone':
      return `streak-milestone:${meta.length ?? ''}`;
    case 'career-milestone':
      return `career-milestone:${meta.amount ?? ''}`;
    case 'title-earned':
      return `title-earned:${meta.title ?? ''}`;
    case 'personal-record':
      return `personal-record:${meta.kind ?? ''}:${meta.value ?? ''}`;
    default:
      return event.type;
  }
}

/* ---------------- Read models ---------------- */

export async function getRewardsSummary(repo: RewardsRepository, playerKey: string): Promise<RewardsSummaryDto> {
  const snapshot = await repo.load(playerKey);
  const context = buildContext(snapshot);
  const unclaimedWeeklyCount = snapshot.weekly.filter(o => !o.claimed && o.progress >= o.target).length;
  const dailyAvailable = !(snapshot.daily?.rewardClaimed ?? false);
  const disclosure = computeDisclosure(context, snapshot.streak, unclaimedWeeklyCount > 0);
  return { career: careerSummary(snapshot), streak: snapshot.streak, disclosure, unclaimedWeeklyCount, dailyAvailable };
}

export async function getFullProfile(repo: RewardsRepository, playerKey: string): Promise<FullProfileDto> {
  const snapshot = await repo.load(playerKey);
  const context = buildContext(snapshot);
  const pinnedBadges = badgeCatalogueFor(context, context.unlockedBadgeIds).filter(b => snapshot.identity.pinnedBadgeIds.includes(b.id));
  const unclaimed = snapshot.weekly.some(o => !o.claimed && o.progress >= o.target);
  return {
    identity: snapshot.identity,
    career: careerSummary(snapshot),
    titles: snapshot.titles,
    pinnedBadges,
    trophyCabinet: snapshot.trophyCabinet,
    disclosure: computeDisclosure(context, snapshot.streak, unclaimed)
  };
}

/* ---------------- Daily ---------------- */

export async function getDailyChallenge(repo: RewardsRepository, playerKey: string, dayKey: string, questionId: string): Promise<DailyChallengeDto> {
  const snapshot = await repo.load(playerKey);
  const state = startDailyQuestion(snapshot.daily, dayKey, questionId);
  if (state !== snapshot.daily) await repo.save({ ...snapshot, daily: state });
  return { state, available: !state.rewardClaimed, rewardAmount: DAILY_QUESTION_REWARD };
}

export async function completeDaily(repo: RewardsRepository, playerKey: string, dayKey: string, correct: boolean, nowIso: string): Promise<{ granted: number; streakCurrent: number }> {
  const snapshot = await repo.load(playerKey);
  if (!snapshot.daily || snapshot.daily.challengeDay !== dayKey) return { granted: 0, streakCurrent: snapshot.streak.current };
  const daily = completeDailyQuestion(snapshot.daily, correct);
  const claim = claimDailyReward(daily);
  const streak = claim.reward > 0 ? applyStreakDay(snapshot.streak, dayKey) : snapshot.streak;
  const career = claim.reward > 0
    ? appendCareerEntry(snapshot.career, { id: `daily-${dayKey}`, kind: 'daily-reward', amount: claim.reward, idempotencyKey: `daily:${dayKey}`, createdAt: nowIso })
    : snapshot.career;
  await repo.save({ ...snapshot, daily: claim.state, streak, career });
  return { granted: claim.reward, streakCurrent: streak.current };
}

/* ---------------- Weekly ---------------- */

export async function getWeekly(repo: RewardsRepository, playerKey: string, weekKey: string): Promise<WeeklyObjectivesDto> {
  const snapshot = await repo.load(playerKey);
  const objectives = resetWeeklyIfNeeded(snapshot.weekly, weekKey);
  if (objectives !== snapshot.weekly) await repo.save({ ...snapshot, weekly: objectives });
  return { weekKey, objectives };
}

export async function claimWeekly(repo: RewardsRepository, playerKey: string, objectiveId: string, nowIso: string): Promise<{ granted: number; alreadyClaimed: boolean }> {
  const snapshot = await repo.load(playerKey);
  const before = snapshot.weekly.find(o => o.objectiveId === objectiveId);
  if (before?.claimed) return { granted: 0, alreadyClaimed: true };
  const { objectives, reward } = claimWeeklyObjective(snapshot.weekly, objectiveId);
  if (reward <= 0) return { granted: 0, alreadyClaimed: false };
  const career = appendCareerEntry(snapshot.career, {
    id: `weekly-${objectiveId}-${before?.weekKey ?? ''}`,
    kind: 'weekly-reward',
    amount: reward,
    idempotencyKey: `weekly:${before?.weekKey ?? ''}:${objectiveId}`,
    createdAt: nowIso
  });
  await repo.save({ ...snapshot, weekly: objectives, career });
  return { granted: reward, alreadyClaimed: false };
}

/* ---------------- Equip / pin ---------------- */

export async function equipCosmeticForPlayer(repo: RewardsRepository, playerKey: string, cosmeticId: string) {
  const snapshot = await repo.load(playerKey);
  const cosmetics = equipCosmetic(snapshot.cosmetics, cosmeticId);
  const equippedTheme = cosmetics.find(c => c.type === 'theme' && c.equipped);
  const equippedFrame = cosmetics.find(c => c.type === 'profile-frame' && c.equipped);
  const identity = {
    ...snapshot.identity,
    equippedThemeId: equippedTheme?.cosmeticId ?? snapshot.identity.equippedThemeId,
    profileFrameId: equippedFrame?.cosmeticId ?? snapshot.identity.profileFrameId
  };
  await repo.save({ ...snapshot, cosmetics, identity });
  return cosmetics;
}

export async function setPinnedBadge(repo: RewardsRepository, playerKey: string, badgeId: string, pinned: boolean) {
  const snapshot = await repo.load(playerKey);
  const owned = ownedShowcaseIds(snapshot);
  const identity = pinned ? pinBadge(snapshot.identity, badgeId, owned) : unpinBadge(snapshot.identity, badgeId);
  await repo.save({ ...snapshot, identity });
  return identity.pinnedBadgeIds;
}

export async function equipTitleForPlayer(repo: RewardsRepository, playerKey: string, titleId: string | null) {
  const snapshot = await repo.load(playerKey);
  if (titleId !== null && !titleById(titleId)) return snapshot.identity.activeTitleId;
  const identity = equipTitle(snapshot.identity, titleId, snapshot.titles.map(t => t.id));
  await repo.save({ ...snapshot, identity });
  return identity.activeTitleId;
}

/** Completion ratio for the category-medallion collection. */
export function medallionCollectionCompletion(snapshot: RewardsProfileSnapshot, allMedallionIds: string[]): number {
  const collection = snapshot.collections.find(c => c.collectionId === COLLECTIONS[0].id) ?? emptyCollection(COLLECTIONS[0].id);
  return collectionCompletion(collection, allMedallionIds);
}
