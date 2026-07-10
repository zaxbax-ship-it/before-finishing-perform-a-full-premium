/**
 * Rewards engine — every state transition as a pure, deterministic function.
 *
 * No React, no DOM, no `Date.now()` inside the rules (timestamps and day keys
 * are passed in). This is the portable heart the web client, the server, the
 * tests and the future SwiftUI / Jetpack Compose clients all share. Nothing here
 * mutates its inputs; every function returns a new value.
 */

import {
  BADGES,
  CAREER_MILESTONES,
  CEREMONY_BADGE_RARITIES,
  COSMETICS,
  DAILY_QUESTION_REWARD,
  LEGENDARY_RARITIES,
  MASTERY_TIERS,
  MASTERY_XP_PER_CORRECT,
  MEDALLION_TIER,
  STARTER_COSMETICS,
  STREAK_MILESTONES,
  TITLES,
  WEEKLY_ACTIVE_COUNT,
  WEEKLY_OBJECTIVES,
  type BadgeDefinition,
  type WeeklyObjectiveDefinition
} from './catalogue';
import type {
  AchievementBadge,
  CareerEarnings,
  CareerLedgerEntry,
  CareerLedgerKind,
  CategoryMastery,
  CollectionState,
  CosmeticEntitlement,
  DailyQuestionState,
  DailyStreak,
  DayKey,
  DisclosureState,
  MasteryTier,
  PlayerIdentity,
  PlayerRewardContext,
  PlayerTitle,
  RevealItem,
  RewardGameResult,
  TimelineEvent,
  TrophyCabinet,
  WeekKey,
  WeeklyObjectiveProgress
} from './types';

/* ============================ Deterministic hashing ============================ */

/** FNV-1a — a small, stable, non-crypto hash for deterministic selection. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ============================ Timezone-safe dates ============================ */

/**
 * Calendar day (`YYYY-MM-DD`) in the player's timezone. The offset is minutes to
 * ADD to UTC (e.g. UTC+3 => 180). The engine never reads the machine clock, so
 * date logic is fully deterministic and testable.
 */
export function toDayKey(iso: string, utcOffsetMinutes = 0): DayKey {
  const shifted = new Date(new Date(iso).getTime() + utcOffsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function previousDayKey(day: DayKey): DayKey {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a). Negative if b precedes a. */
export function dayKeyDiff(a: DayKey, b: DayKey): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** ISO week key (`YYYY-Www`) for a day key. */
export function toWeekKey(day: DayKey): WeekKey {
  const date = new Date(`${day}T00:00:00Z`);
  const dow = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dow + 3); // Thursday of this ISO week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDow = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDow + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/* ============================ Career Earnings ============================ */

export function emptyCareer(): CareerEarnings {
  return {
    lifetimeTotal: 0,
    spendableBalance: 0,
    bestSingleGame: 0,
    millionaireWins: 0,
    perfectRuns: 0,
    cashOutTotal: 0,
    gamesWon: 0,
    gamesPlayed: 0,
    ledger: []
  };
}

/**
 * Append one immutable ledger entry. Idempotent (an existing key is a no-op) and
 * never lets the spendable balance go negative (an over-large debit is rejected).
 * `lifetimeTotal` only grows — debits never reduce the honor record.
 */
export function appendCareerEntry(career: CareerEarnings, entry: CareerLedgerEntry): CareerEarnings {
  if (career.ledger.some(e => e.idempotencyKey === entry.idempotencyKey)) return career;
  const nextBalance = career.spendableBalance + entry.amount;
  if (nextBalance < 0) return career; // no negative balance — reject the debit
  return {
    ...career,
    spendableBalance: nextBalance,
    lifetimeTotal: entry.amount > 0 ? career.lifetimeTotal + entry.amount : career.lifetimeTotal,
    ledger: [...career.ledger, entry]
  };
}

/**
 * Apply one finished game to the career record. Idempotent by `idempotencyKey`
 * (re-processing the same game changes nothing). Always appends exactly one entry
 * per game (amount 0 for a loss) so the ledger doubles as the processed-games log.
 */
export function applyGameToCareer(
  career: CareerEarnings,
  result: RewardGameResult,
  idempotencyKey: string,
  entryId: string,
  nowIso: string
): CareerEarnings {
  if (career.ledger.some(e => e.idempotencyKey === idempotencyKey)) return career;
  const amount = result.won || result.cashedOut ? Math.max(0, result.prize) : 0;
  const kind: CareerLedgerKind = result.cashedOut ? 'cash-out' : 'game-win';
  const entry: CareerLedgerEntry = {
    id: entryId,
    kind,
    amount,
    idempotencyKey,
    createdAt: nowIso,
    metadata: { category: result.category }
  };
  return {
    lifetimeTotal: career.lifetimeTotal + amount,
    spendableBalance: career.spendableBalance + amount,
    bestSingleGame: Math.max(career.bestSingleGame, amount),
    millionaireWins: career.millionaireWins + (result.won && result.prize >= 1_000_000 ? 1 : 0),
    perfectRuns: career.perfectRuns + (result.won && result.correctAnswers >= 15 ? 1 : 0),
    cashOutTotal: career.cashOutTotal + (result.cashedOut ? Math.max(0, result.prize) : 0),
    gamesWon: career.gamesWon + (result.won ? 1 : 0),
    gamesPlayed: career.gamesPlayed + 1,
    ledger: [...career.ledger, entry]
  };
}

/** Career milestone thresholds newly crossed between two lifetime totals. */
export function crossedCareerMilestones(before: number, after: number): number[] {
  return CAREER_MILESTONES.filter(m => before < m && after >= m);
}

/* ============================ Daily streak ============================ */

export function emptyStreak(): DailyStreak {
  return { current: 0, longest: 0, lastQualifyingDay: null, repairUsedWeek: null };
}

/**
 * Record a qualifying day. Same-day repeats are a no-op (no double increment); a
 * consecutive day increments; any larger gap resets to 1. Humane by design — no
 * decay, no punishment, no clock pressure.
 */
export function applyStreakDay(streak: DailyStreak, day: DayKey): DailyStreak {
  if (streak.lastQualifyingDay === day) return streak;
  const consecutive = streak.lastQualifyingDay !== null && previousDayKey(day) === streak.lastQualifyingDay;
  const current = consecutive ? streak.current + 1 : 1;
  return {
    ...streak,
    current,
    longest: Math.max(streak.longest, current),
    lastQualifyingDay: day
  };
}

/**
 * The single gentle repair: bridge exactly one missed day, at most once per ISO
 * week. Returns `{ repaired, streak }`. Not applicable (wrong gap / already used)
 * leaves the streak untouched — the caller then falls back to `applyStreakDay`.
 */
export function repairStreak(streak: DailyStreak, day: DayKey): { repaired: boolean; streak: DailyStreak } {
  if (streak.lastQualifyingDay === null) return { repaired: false, streak };
  const weekKey = toWeekKey(day);
  if (streak.repairUsedWeek === weekKey) return { repaired: false, streak };
  if (dayKeyDiff(streak.lastQualifyingDay, day) !== 2) return { repaired: false, streak };
  const current = streak.current + 1;
  return {
    repaired: true,
    streak: { current, longest: Math.max(streak.longest, current), lastQualifyingDay: day, repairUsedWeek: weekKey }
  };
}

export function crossedStreakMilestones(before: number, after: number): number[] {
  return STREAK_MILESTONES.filter(m => before < m && after >= m);
}

/* ============================ Category mastery ============================ */

const TIER_ORDER: MasteryTier[] = ['none', 'apprentice', 'skilled', 'expert', 'master', 'grandmaster'];
export function tierRank(tier: MasteryTier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Highest tier whose XP and accuracy floors are both satisfied. */
export function masteryTierForXp(masteryXp: number, accuracy: number): MasteryTier {
  let tier: MasteryTier = 'none';
  for (const threshold of MASTERY_TIERS) {
    if (masteryXp >= threshold.minXp && accuracy >= threshold.minAccuracy) tier = threshold.tier;
  }
  return tier;
}

export function emptyMastery(categoryId: string): CategoryMastery {
  return { categoryId, masteryXp: 0, tier: 'none', gamesPlayed: 0, correctAnswers: 0, questionsFaced: 0, milestones: [] };
}

/**
 * Apply a game's category performance. Mastery XP comes only from CORRECT answers,
 * and promotion is gated by an accuracy floor, so grinding wrong answers cannot
 * buy mastery. Tier is monotonic (never demotes); a low accuracy only slows it.
 */
export function applyGameToMastery(mastery: CategoryMastery, correct: number, faced: number): CategoryMastery {
  const masteryXp = mastery.masteryXp + Math.max(0, correct) * MASTERY_XP_PER_CORRECT;
  const correctAnswers = mastery.correctAnswers + Math.max(0, correct);
  const questionsFaced = mastery.questionsFaced + Math.max(0, faced);
  const accuracy = questionsFaced > 0 ? correctAnswers / questionsFaced : 0;
  const computed = masteryTierForXp(masteryXp, accuracy);
  const tier = tierRank(computed) > tierRank(mastery.tier) ? computed : mastery.tier;
  const milestones = tier !== 'none' && !mastery.milestones.includes(tier) ? [...mastery.milestones, tier] : mastery.milestones;
  return { ...mastery, masteryXp, correctAnswers, questionsFaced, gamesPlayed: mastery.gamesPlayed + 1, tier, milestones };
}

export function hasEarnedMedallion(mastery: CategoryMastery): boolean {
  return tierRank(mastery.tier) >= tierRank(MEDALLION_TIER);
}

/* ============================ Badges ============================ */

function badgeState(def: BadgeDefinition, ctx: PlayerRewardContext, unlockedAt: string | null): AchievementBadge {
  const progress = Math.max(0, def.progress(ctx));
  return {
    id: def.id,
    category: def.category,
    rarity: def.rarity,
    nameKey: def.nameKey,
    descriptionKey: def.descriptionKey,
    target: def.target,
    current: Math.min(progress, def.target),
    unlockedAt,
    hidden: def.hidden,
    showcaseEligible: def.showcaseEligible
  };
}

/** Full badge catalogue projected against a context (for the badge grid). */
export function badgeCatalogueFor(ctx: PlayerRewardContext, unlockedIds: string[]): AchievementBadge[] {
  return BADGES.map(def => badgeState(def, ctx, unlockedIds.includes(def.id) ? 'unlocked' : null));
}

/**
 * Badges newly unlocked by the current context, in deterministic catalogue order.
 * Unlock-once: anything already in `alreadyUnlocked` is skipped.
 */
export function evaluateBadges(ctx: PlayerRewardContext, alreadyUnlocked: string[], nowIso: string): AchievementBadge[] {
  return BADGES.filter(def => !alreadyUnlocked.includes(def.id) && def.progress(ctx) >= def.target).map(def =>
    badgeState(def, ctx, nowIso)
  );
}

export function isCeremonyBadge(rarity: AchievementBadge['rarity']): boolean {
  return CEREMONY_BADGE_RARITIES.includes(rarity);
}
export function isLegendaryBadge(rarity: AchievementBadge['rarity']): boolean {
  return LEGENDARY_RARITIES.includes(rarity);
}

/* ============================ Titles ============================ */

/** Titles newly earned by the current context, in deterministic catalogue order. */
export function evaluateTitles(ctx: PlayerRewardContext, alreadyEarned: string[], nowIso: string): PlayerTitle[] {
  return TITLES.filter(def => !alreadyEarned.includes(def.id) && def.unlock(ctx)).map(def => ({
    id: def.id,
    nameKey: def.nameKey,
    descriptionKey: def.descriptionKey,
    rarity: def.rarity,
    earnedAt: nowIso,
    equipped: false
  }));
}

/* ============================ Collections ============================ */

export function emptyCollection(collectionId: string): CollectionState {
  return { collectionId, earnedItemIds: [], completionReward: null, completed: false };
}

/**
 * Earn a collection item. Idempotent (owning it already is a no-op). Completion is
 * reached when every id in `allItemIds` is owned — the reward is then attached.
 */
export function earnCollectionItem(
  collection: CollectionState,
  itemId: string,
  allItemIds: string[],
  completionReward: CollectionState['completionReward']
): CollectionState {
  if (collection.earnedItemIds.includes(itemId)) return collection;
  const earnedItemIds = [...collection.earnedItemIds, itemId];
  const completed = allItemIds.length > 0 && allItemIds.every(id => earnedItemIds.includes(id));
  return {
    ...collection,
    earnedItemIds,
    completed,
    completionReward: completed ? completionReward : collection.completionReward
  };
}

export function collectionCompletion(collection: CollectionState, allItemIds: string[]): number {
  if (allItemIds.length === 0) return 0;
  return collection.earnedItemIds.filter(id => allItemIds.includes(id)).length / allItemIds.length;
}

/* ============================ Weekly objectives ============================ */

/** The (up to 3) objectives active for an ISO week — deterministic rotation. */
export function activeWeeklyObjectives(weekKey: WeekKey): WeeklyObjectiveDefinition[] {
  if (WEEKLY_OBJECTIVES.length <= WEEKLY_ACTIVE_COUNT) return WEEKLY_OBJECTIVES;
  const offset = hashString(weekKey) % WEEKLY_OBJECTIVES.length;
  const rotated = [...WEEKLY_OBJECTIVES.slice(offset), ...WEEKLY_OBJECTIVES.slice(0, offset)];
  return rotated.slice(0, WEEKLY_ACTIVE_COUNT);
}

export function initWeeklyProgress(weekKey: WeekKey): WeeklyObjectiveProgress[] {
  return activeWeeklyObjectives(weekKey).map(def => ({
    objectiveId: def.id,
    weekKey,
    progress: 0,
    target: def.target,
    rewardAmount: def.rewardAmount,
    claimed: false,
    seenKeys: def.metric === 'distinct-categories' ? [] : undefined
  }));
}

/** Reset to a fresh set when the week rolls over (or when never initialised). */
export function resetWeeklyIfNeeded(objectives: WeeklyObjectiveProgress[], weekKey: WeekKey): WeeklyObjectiveProgress[] {
  if (objectives.length > 0 && objectives[0].weekKey === weekKey) return objectives;
  return initWeeklyProgress(weekKey);
}

function weeklyDelta(def: WeeklyObjectiveDefinition | undefined, result: RewardGameResult): number {
  if (!def) return 0;
  switch (def.metric) {
    case 'games':
      return 1;
    case 'correct':
      return Math.max(0, result.correctAnswers);
    case 'lifeline-free-win':
      return result.won && result.lifelinesUsed === 0 ? 1 : 0;
    default:
      return 0;
  }
}

/** Advance every active objective by a finished game (progress is capped at target). */
export function applyResultToWeekly(
  objectives: WeeklyObjectiveProgress[],
  result: RewardGameResult
): WeeklyObjectiveProgress[] {
  return objectives.map(objective => {
    if (objective.claimed) return objective;
    const def = WEEKLY_OBJECTIVES.find(o => o.id === objective.objectiveId);
    if (def?.metric === 'distinct-categories') {
      const seen = objective.seenKeys ?? [];
      const nextSeen = seen.includes(result.category) ? seen : [...seen, result.category];
      return { ...objective, seenKeys: nextSeen, progress: Math.min(objective.target, nextSeen.length) };
    }
    const progress = Math.min(objective.target, objective.progress + weeklyDelta(def, result));
    return { ...objective, progress };
  });
}

/** Claim a completed objective exactly once. Returns the reward dollars granted. */
export function claimWeeklyObjective(
  objectives: WeeklyObjectiveProgress[],
  objectiveId: string
): { objectives: WeeklyObjectiveProgress[]; reward: number } {
  const target = objectives.find(o => o.objectiveId === objectiveId);
  if (!target || target.claimed || target.progress < target.target) return { objectives, reward: 0 };
  return {
    objectives: objectives.map(o => (o.objectiveId === objectiveId ? { ...o, claimed: true } : o)),
    reward: target.rewardAmount
  };
}

/* ============================ Daily question ============================ */

/** Deterministic 0-based index into the day's playable bank. */
export function dailyChallengeIndex(day: DayKey, bankSize: number): number {
  if (bankSize <= 0) return 0;
  return hashString(`daily:${day}`) % bankSize;
}

export function startDailyQuestion(
  previous: DailyQuestionState | null,
  day: DayKey,
  questionId: string
): DailyQuestionState {
  if (previous && previous.challengeDay === day) return previous;
  return { challengeDay: day, questionId, completed: false, correct: null, rewardClaimed: false };
}

/** Mark today's challenge answered. Idempotent — a second answer is ignored. */
export function completeDailyQuestion(state: DailyQuestionState, correct: boolean): DailyQuestionState {
  if (state.completed) return state;
  return { ...state, completed: true, correct };
}

/** Claim the once-per-day reward. Refreshing / multi-tab / device switch can't repeat it. */
export function claimDailyReward(state: DailyQuestionState): { state: DailyQuestionState; reward: number } {
  if (!state.completed || state.rewardClaimed) return { state, reward: 0 };
  return { state: { ...state, rewardClaimed: true }, reward: DAILY_QUESTION_REWARD };
}

/* ============================ Player identity ============================ */

export function monogramFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '★';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A complete, quiet default identity — never empty boxes. */
export function defaultIdentity(playerKey: string, displayName: string): PlayerIdentity {
  return {
    playerKey,
    displayName,
    monogramSeed: monogramFor(displayName),
    activeTitleId: null,
    profileFrameId: STARTER_COSMETICS['profile-frame'],
    pinnedBadgeIds: [],
    equippedThemeId: STARTER_COSMETICS.theme,
    careerSummary: { lifetimeTotal: 0, bestSingleGame: 0, gamesPlayed: 0 }
  };
}

export const MAX_PINNED_BADGES = 3;

/** Pin a badge (max 3, must be owned + showcase-eligible). Invalid ops are no-ops. */
export function pinBadge(identity: PlayerIdentity, badgeId: string, ownedShowcaseIds: string[]): PlayerIdentity {
  if (identity.pinnedBadgeIds.includes(badgeId)) return identity;
  if (!ownedShowcaseIds.includes(badgeId)) return identity;
  if (identity.pinnedBadgeIds.length >= MAX_PINNED_BADGES) return identity;
  return { ...identity, pinnedBadgeIds: [...identity.pinnedBadgeIds, badgeId] };
}

export function unpinBadge(identity: PlayerIdentity, badgeId: string): PlayerIdentity {
  return { ...identity, pinnedBadgeIds: identity.pinnedBadgeIds.filter(id => id !== badgeId) };
}

/** Equip an earned title. A title that isn't earned is rejected (no-op). */
export function equipTitle(identity: PlayerIdentity, titleId: string | null, earnedTitleIds: string[]): PlayerIdentity {
  if (titleId !== null && !earnedTitleIds.includes(titleId)) return identity;
  return { ...identity, activeTitleId: titleId };
}

/* ============================ Trophy cabinet ============================ */

export function emptyCabinet(maxSlots = 6): TrophyCabinet {
  return { slots: Array.from({ length: maxSlots }, () => null), maxSlots };
}

/** Place an earned, showcase-eligible item into a slot. Invalid ops are no-ops. */
export function pinTrophy(cabinet: TrophyCabinet, slotIndex: number, itemId: string, eligibleIds: string[]): TrophyCabinet {
  if (slotIndex < 0 || slotIndex >= cabinet.maxSlots) return cabinet;
  if (!eligibleIds.includes(itemId)) return cabinet;
  if (cabinet.slots.includes(itemId)) return cabinet; // no duplicates across slots
  return { ...cabinet, slots: cabinet.slots.map((slot, i) => (i === slotIndex ? itemId : slot)) };
}

export function clearTrophySlot(cabinet: TrophyCabinet, slotIndex: number): TrophyCabinet {
  if (slotIndex < 0 || slotIndex >= cabinet.maxSlots) return cabinet;
  return { ...cabinet, slots: cabinet.slots.map((slot, i) => (i === slotIndex ? null : slot)) };
}

/* ============================ Cosmetics ============================ */

/** The starter entitlements every player owns from the start (identity looks complete). */
export function starterEntitlements(nowIso: string): CosmeticEntitlement[] {
  return COSMETICS.filter(c => c.starter).map(c => ({
    cosmeticId: c.id,
    type: c.type,
    source: 'starter',
    unlockedAt: nowIso,
    equipped: STARTER_COSMETICS[c.type] === c.id
  }));
}

export function grantCosmetic(
  entitlements: CosmeticEntitlement[],
  cosmeticId: string,
  nowIso: string
): CosmeticEntitlement[] {
  if (entitlements.some(e => e.cosmeticId === cosmeticId)) return entitlements;
  const def = COSMETICS.find(c => c.id === cosmeticId);
  if (!def) return entitlements;
  return [...entitlements, { cosmeticId: def.id, type: def.type, source: def.source, unlockedAt: nowIso, equipped: false }];
}

/** Equip an owned cosmetic; unequips any other of the same type. No-op if not owned. */
export function equipCosmetic(entitlements: CosmeticEntitlement[], cosmeticId: string): CosmeticEntitlement[] {
  const target = entitlements.find(e => e.cosmeticId === cosmeticId);
  if (!target) return entitlements;
  return entitlements.map(e => {
    if (e.type !== target.type) return e;
    return { ...e, equipped: e.cosmeticId === cosmeticId };
  });
}

/** Reset a cosmetic type back to its accessibility-safe starter. */
export function resetCosmeticType(entitlements: CosmeticEntitlement[], type: CosmeticEntitlement['type']): CosmeticEntitlement[] {
  const starterId = STARTER_COSMETICS[type];
  return entitlements.map(e => (e.type === type ? { ...e, equipped: e.cosmeticId === starterId } : e));
}

/* ============================ Profile timeline ============================ */

export function timelineKey(event: Pick<TimelineEvent, 'type' | 'metadata'>): string {
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
    case 'collection-complete':
      return `collection-complete:${meta.collection ?? ''}`;
    case 'personal-record':
      return `personal-record:${meta.kind ?? ''}:${meta.value ?? ''}`;
    default:
      return event.type; // once-ever events (joined, first-game, first-win, ...)
  }
}

/** Append a milestone if its natural key has never been recorded (dedupe). */
export function recordMilestone(events: TimelineEvent[], candidate: TimelineEvent): TimelineEvent[] {
  const key = timelineKey(candidate);
  if (events.some(e => timelineKey(e) === key)) return events;
  return [...events, candidate];
}

/* ============================ Reward reveal queue ============================ */

/** What happened this game, from which the ceremony queue is derived. */
export type RevealInput = {
  careerDelta: number;
  leveledUp: boolean;
  newLevel?: number;
  streakChanged: boolean;
  streakCurrent?: number;
  streakMilestone?: number;
  newTitleIds: string[];
  newBadges: AchievementBadge[];
  masteryTierUps: { category: string; tier: MasteryTier }[];
  completedCollections: string[];
  careerMilestone?: number;
  personalRecord?: number;
  firstMillionaire: boolean;
};

const REVEAL_PRIORITY: Record<RevealItem['type'], number> = {
  result: 0,
  'first-millionaire': 5,
  'career-earnings': 10,
  'personal-record': 15,
  'xp-level': 20,
  streak: 30,
  'career-milestone': 35,
  'title-unlock': 40,
  'mastery-tier': 50,
  'legendary-badge': 55,
  'badge-unlock': 60,
  'collection-complete': 70
};

/**
 * Build the ordered reveal queue. `result` always leads; only MEANINGFUL moments
 * follow (a bare XP tick or an unchanged streak stay quiet). One item per moment,
 * deterministically sorted — the UI plays them one at a time and never as a wall.
 */
export function buildRevealQueue(input: RevealInput): RevealItem[] {
  const items: RevealItem[] = [{ type: 'result', priority: REVEAL_PRIORITY.result, payload: {} }];

  if (input.firstMillionaire) items.push({ type: 'first-millionaire', priority: REVEAL_PRIORITY['first-millionaire'], payload: {} });
  if (input.careerDelta > 0) items.push({ type: 'career-earnings', priority: REVEAL_PRIORITY['career-earnings'], payload: { amount: input.careerDelta } });
  if (typeof input.personalRecord === 'number') items.push({ type: 'personal-record', priority: REVEAL_PRIORITY['personal-record'], payload: { value: input.personalRecord } });
  if (input.leveledUp) items.push({ type: 'xp-level', priority: REVEAL_PRIORITY['xp-level'], payload: { level: input.newLevel ?? 0 } });
  if (input.streakChanged && typeof input.streakCurrent === 'number') items.push({ type: 'streak', priority: REVEAL_PRIORITY.streak, payload: { current: input.streakCurrent } });
  if (typeof input.careerMilestone === 'number') items.push({ type: 'career-milestone', priority: REVEAL_PRIORITY['career-milestone'], payload: { amount: input.careerMilestone } });
  for (const titleId of input.newTitleIds) items.push({ type: 'title-unlock', priority: REVEAL_PRIORITY['title-unlock'], payload: { title: titleId } });
  for (const tierUp of input.masteryTierUps) items.push({ type: 'mastery-tier', priority: REVEAL_PRIORITY['mastery-tier'], payload: { category: tierUp.category, tier: tierUp.tier } });
  for (const badge of input.newBadges) {
    if (isLegendaryBadge(badge.rarity)) items.push({ type: 'legendary-badge', priority: REVEAL_PRIORITY['legendary-badge'], payload: { badge: badge.id } });
    else if (isCeremonyBadge(badge.rarity)) items.push({ type: 'badge-unlock', priority: REVEAL_PRIORITY['badge-unlock'], payload: { badge: badge.id } });
    // common / uncommon badges stay quiet — they surface in the profile grid, not as ceremony.
  }
  for (const collectionId of input.completedCollections) items.push({ type: 'collection-complete', priority: REVEAL_PRIORITY['collection-complete'], payload: { collection: collectionId } });

  return items.sort((a, b) => a.priority - b.priority);
}

/* ============================ Progressive disclosure ============================ */

/**
 * Which off-gameplay surfaces the player has earned the right to see. A surface
 * appears only once its first item exists or it is immediately actionable — never
 * an empty locked grid.
 */
export function computeDisclosure(
  ctx: PlayerRewardContext,
  streak: DailyStreak,
  hasUnclaimedRewards = false
): DisclosureState {
  const masteredAny = Object.values(ctx.masteryTiersReached).some(t => t === 'master' || t === 'grandmaster');
  const identityDiscoverable = ctx.gamesPlayed >= 5 || ctx.unlockedTitleIds.length > 0 || ctx.unlockedBadgeIds.length > 1;
  return {
    streakGlyphVisible: streak.current >= 2,
    identityDiscoverable,
    profileHasNews: hasUnclaimedRewards,
    masteryVisible: Object.keys(ctx.masteryTiersReached).length > 0,
    trophyCabinetVisible: ctx.ownedShowcaseItemIds.length > 0,
    collectionsVisible: masteredAny,
    storeVisible: ctx.ownedNonStarterCosmetics > 0 || ctx.careerLifetime >= CAREER_MILESTONES[0],
    journeyVisible: ctx.gamesPlayed >= 1
  };
}
