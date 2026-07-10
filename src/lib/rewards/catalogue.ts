/**
 * Version 1 rewards catalogue — the curated launch set of titles, badges,
 * mastery tiers, collections, cosmetics and weekly objectives.
 *
 * Everything here is DATA with stable ids and localization keys (never raw
 * copy). Unlock predicates are pure functions over the flat `PlayerRewardContext`
 * snapshot, so web / server / native all evaluate them identically. Rarity is
 * assigned by genuine difficulty, never by artificial scarcity.
 */

import type {
  BadgeCategory,
  CollectionRewardKind,
  CosmeticSource,
  CosmeticType,
  MasteryTier,
  PlayerRewardContext,
  Rarity
} from './types';

/* ============================ Titles ============================ */

export type TitleDefinition = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  rarity: Rarity;
  /** Pure unlock predicate. Titles are earned only — never purchasable. */
  unlock: (ctx: PlayerRewardContext) => boolean;
};

const anyTierAtLeast = (ctx: PlayerRewardContext, tier: MasteryTier): boolean => {
  const order: MasteryTier[] = ['none', 'apprentice', 'skilled', 'expert', 'master', 'grandmaster'];
  const min = order.indexOf(tier);
  return Object.values(ctx.masteryTiersReached).some(t => t !== undefined && order.indexOf(t) >= min);
};

export const TITLES: TitleDefinition[] = [
  { id: 'rookie', nameKey: 'rewards.title.rookie.name', descriptionKey: 'rewards.title.rookie.desc', rarity: 'common', unlock: ctx => ctx.gamesPlayed >= 1 },
  { id: 'contender', nameKey: 'rewards.title.contender.name', descriptionKey: 'rewards.title.contender.desc', rarity: 'common', unlock: ctx => ctx.gamesPlayed >= 10 },
  { id: 'studio_regular', nameKey: 'rewards.title.studio_regular.name', descriptionKey: 'rewards.title.studio_regular.desc', rarity: 'uncommon', unlock: ctx => ctx.gamesPlayed >= 50 },
  { id: 'category_expert', nameKey: 'rewards.title.category_expert.name', descriptionKey: 'rewards.title.category_expert.desc', rarity: 'uncommon', unlock: ctx => anyTierAtLeast(ctx, 'expert') },
  { id: 'perfectionist', nameKey: 'rewards.title.perfectionist.name', descriptionKey: 'rewards.title.perfectionist.desc', rarity: 'rare', unlock: ctx => ctx.perfectRuns >= 1 },
  { id: 'the_unbluffable', nameKey: 'rewards.title.the_unbluffable.name', descriptionKey: 'rewards.title.the_unbluffable.desc', rarity: 'rare', unlock: ctx => ctx.lifelineFreeWins >= 3 },
  { id: 'quizmaster', nameKey: 'rewards.title.quizmaster.name', descriptionKey: 'rewards.title.quizmaster.desc', rarity: 'rare', unlock: ctx => anyTierAtLeast(ctx, 'master') },
  { id: 'millionaire', nameKey: 'rewards.title.millionaire.name', descriptionKey: 'rewards.title.millionaire.desc', rarity: 'epic', unlock: ctx => ctx.millionaireWins >= 1 },
  { id: 'grandmaster', nameKey: 'rewards.title.grandmaster.name', descriptionKey: 'rewards.title.grandmaster.desc', rarity: 'epic', unlock: ctx => anyTierAtLeast(ctx, 'grandmaster') },
  { id: 'living_legend', nameKey: 'rewards.title.living_legend.name', descriptionKey: 'rewards.title.living_legend.desc', rarity: 'legendary', unlock: ctx => ctx.millionaireWins >= 1 && ctx.longestStreak >= 30 }
];

export function titleById(id: string): TitleDefinition | undefined {
  return TITLES.find(t => t.id === id);
}

/* ============================ Badges ============================ */

export type BadgeDefinition = {
  id: string;
  category: BadgeCategory;
  rarity: Rarity;
  nameKey: string;
  descriptionKey: string;
  /** >=1. A one-shot badge has a target of 1. */
  target: number;
  hidden: boolean;
  showcaseEligible: boolean;
  /** Current progress derived from the context (>= target => unlocked). */
  progress: (ctx: PlayerRewardContext) => number;
};

const b = (
  id: string,
  category: BadgeCategory,
  rarity: Rarity,
  target: number,
  progress: (ctx: PlayerRewardContext) => number,
  opts: { hidden?: boolean; showcaseEligible?: boolean } = {}
): BadgeDefinition => ({
  id,
  category,
  rarity,
  nameKey: `rewards.badge.${id}.name`,
  descriptionKey: `rewards.badge.${id}.desc`,
  target,
  hidden: opts.hidden ?? false,
  showcaseEligible: opts.showcaseEligible ?? rarity !== 'common',
  progress
});

export const BADGES: BadgeDefinition[] = [
  b('first_game', 'milestone', 'common', 1, ctx => ctx.gamesPlayed),
  b('first_win', 'wins', 'common', 1, ctx => ctx.gamesWon),
  b('ten_wins', 'wins', 'uncommon', 10, ctx => ctx.gamesWon),
  b('fifty_wins', 'wins', 'rare', 50, ctx => ctx.gamesWon),
  b('perfect_game', 'perfect', 'rare', 1, ctx => ctx.perfectRuns),
  b('five_perfect', 'perfect', 'epic', 5, ctx => ctx.perfectRuns),
  b('millionaire', 'millionaire', 'epic', 1, ctx => ctx.millionaireWins),
  b('triple_millionaire', 'millionaire', 'legendary', 3, ctx => ctx.millionaireWins),
  b('lifeline_free_win', 'lifeline-free', 'uncommon', 1, ctx => ctx.lifelineFreeWins),
  b('flawless_ten', 'lifeline-free', 'epic', 10, ctx => ctx.lifelineFreeWins),
  b('comeback', 'comeback', 'rare', 1, ctx => ctx.comebackWins),
  b('speedster', 'speed', 'uncommon', 25, ctx => ctx.fastAnswerTotal),
  b('speed_demon', 'speed', 'epic', 200, ctx => ctx.fastAnswerTotal),
  b('category_master', 'category', 'rare', 1, ctx => (anyTierAtLeast(ctx, 'master') ? 1 : 0)),
  b('polymath', 'category', 'legendary', 1, ctx => (Object.keys(ctx.masteryTiersReached).length >= 5 && Object.values(ctx.masteryTiersReached).every(t => t === 'expert' || t === 'master' || t === 'grandmaster') ? 1 : 0), { hidden: true }),
  b('streak_7', 'streak', 'uncommon', 7, ctx => ctx.longestStreak),
  b('streak_30', 'streak', 'epic', 30, ctx => ctx.longestStreak),
  b('streak_100', 'streak', 'legendary', 100, ctx => ctx.longestStreak),
  b('multiplayer_win', 'multiplayer', 'common', 1, ctx => ctx.multiplayerWins),
  b('multiplayer_veteran', 'multiplayer', 'rare', 25, ctx => ctx.multiplayerWins),
  b('career_100k', 'career', 'uncommon', 100_000, ctx => ctx.careerLifetime),
  b('career_1m', 'career', 'rare', 1_000_000, ctx => ctx.careerLifetime),
  b('career_10m', 'career', 'epic', 10_000_000, ctx => ctx.careerLifetime)
];

export function badgeById(id: string): BadgeDefinition | undefined {
  return BADGES.find(item => item.id === id);
}

/** A legendary badge earns extra ceremony in the reveal queue. */
export const LEGENDARY_RARITIES: Rarity[] = ['legendary'];
/** Rarities that trigger a dedicated (non-batched) badge reveal. */
export const CEREMONY_BADGE_RARITIES: Rarity[] = ['rare', 'epic', 'legendary'];

/* ============================ Category mastery ============================ */

export type MasteryTierThreshold = {
  tier: MasteryTier;
  minXp: number;
  /** Accuracy floor (0..1) — blocks pure grind: low accuracy caps the tier. */
  minAccuracy: number;
};

/** Ordered low → high; the highest satisfied threshold wins. */
export const MASTERY_TIERS: MasteryTierThreshold[] = [
  { tier: 'apprentice', minXp: 50, minAccuracy: 0 },
  { tier: 'skilled', minXp: 150, minAccuracy: 0.5 },
  { tier: 'expert', minXp: 400, minAccuracy: 0.6 },
  { tier: 'master', minXp: 900, minAccuracy: 0.7 },
  { tier: 'grandmaster', minXp: 2000, minAccuracy: 0.8 }
];

/** Mastery XP earned per correct answer in a category. */
export const MASTERY_XP_PER_CORRECT = 10;
/** Reaching this tier grants the category's collection medallion. */
export const MEDALLION_TIER: MasteryTier = 'master';

/* ============================ Collections ============================ */

export type CollectionDefinition = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** Medallion item id scheme: `${itemPrefix}${categoryId}`. */
  itemPrefix: string;
  completionReward: CollectionRewardKind;
  /** Cosmetic/title granted on completion (a localization/entitlement id). */
  completionRewardId: string;
};

export const COLLECTIONS: CollectionDefinition[] = [
  {
    id: 'category-medallions',
    nameKey: 'rewards.collection.category_medallions.name',
    descriptionKey: 'rewards.collection.category_medallions.desc',
    itemPrefix: 'medallion:',
    completionReward: 'title',
    completionRewardId: 'grandmaster'
  }
];

export function collectionById(id: string): CollectionDefinition | undefined {
  return COLLECTIONS.find(c => c.id === id);
}

export function medallionItemId(categoryId: string): string {
  return `medallion:${categoryId}`;
}

/* ============================ Cosmetics ============================ */

export type CosmeticDefinition = {
  id: string;
  type: CosmeticType;
  source: CosmeticSource;
  nameKey: string;
  /** true = owned by every player from the start (a complete quiet default). */
  starter: boolean;
  /** For earned cosmetics: the badge/title/collection id that grants it (docs). */
  unlockRef?: string;
};

export const COSMETICS: CosmeticDefinition[] = [
  // Starter defaults — a new player looks complete, never empty.
  { id: 'frame-classic', type: 'profile-frame', source: 'starter', nameKey: 'rewards.cosmetic.frame_classic', starter: true },
  { id: 'theme-studio', type: 'theme', source: 'starter', nameKey: 'rewards.cosmetic.theme_studio', starter: true },
  { id: 'confetti-gold', type: 'confetti', source: 'starter', nameKey: 'rewards.cosmetic.confetti_gold', starter: true },
  { id: 'halo-classic', type: 'result-halo', source: 'starter', nameKey: 'rewards.cosmetic.halo_classic', starter: true },
  { id: 'fanfare-classic', type: 'fanfare', source: 'starter', nameKey: 'rewards.cosmetic.fanfare_classic', starter: true },
  { id: 'nameplate-classic', type: 'nameplate', source: 'starter', nameKey: 'rewards.cosmetic.nameplate_classic', starter: true },
  // Earned unlockables (skill-neutral).
  { id: 'frame-gold', type: 'profile-frame', source: 'achievement', nameKey: 'rewards.cosmetic.frame_gold', starter: false, unlockRef: 'millionaire' },
  { id: 'theme-midnight', type: 'theme', source: 'streak', nameKey: 'rewards.cosmetic.theme_midnight', starter: false, unlockRef: 'streak_30' },
  { id: 'confetti-azure', type: 'confetti', source: 'mastery', nameKey: 'rewards.cosmetic.confetti_azure', starter: false, unlockRef: 'category_master' },
  { id: 'nameplate-legend', type: 'nameplate', source: 'title', nameKey: 'rewards.cosmetic.nameplate_legend', starter: false, unlockRef: 'living_legend' }
];

export function cosmeticById(id: string): CosmeticDefinition | undefined {
  return COSMETICS.find(c => c.id === id);
}

/** The accessibility-safe starter equipped for each cosmetic type. */
export const STARTER_COSMETICS: Record<CosmeticType, string> = {
  'profile-frame': 'frame-classic',
  'theme': 'theme-studio',
  'confetti': 'confetti-gold',
  'result-halo': 'halo-classic',
  'fanfare': 'fanfare-classic',
  'nameplate': 'nameplate-classic',
  'profile-background': 'frame-classic' // reserved; falls back to the classic surface
};

/* ============================ Weekly objectives ============================ */

export type WeeklyMetric = 'games' | 'correct' | 'lifeline-free-win' | 'distinct-categories';

export type WeeklyObjectiveDefinition = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  metric: WeeklyMetric;
  target: number;
  /** Dollar reward credited to Career Earnings on claim. */
  rewardAmount: number;
};

export const WEEKLY_OBJECTIVES: WeeklyObjectiveDefinition[] = [
  { id: 'play_three', nameKey: 'rewards.weekly.play_three.name', descriptionKey: 'rewards.weekly.play_three.desc', metric: 'games', target: 3, rewardAmount: 1000 },
  { id: 'correct_fifty', nameKey: 'rewards.weekly.correct_fifty.name', descriptionKey: 'rewards.weekly.correct_fifty.desc', metric: 'correct', target: 50, rewardAmount: 1500 },
  { id: 'lifeline_free', nameKey: 'rewards.weekly.lifeline_free.name', descriptionKey: 'rewards.weekly.lifeline_free.desc', metric: 'lifeline-free-win', target: 1, rewardAmount: 2000 },
  { id: 'three_categories', nameKey: 'rewards.weekly.three_categories.name', descriptionKey: 'rewards.weekly.three_categories.desc', metric: 'distinct-categories', target: 3, rewardAmount: 1000 }
];

/** At most this many objectives are active in a given week. */
export const WEEKLY_ACTIVE_COUNT = 3;

export function weeklyObjectiveById(id: string): WeeklyObjectiveDefinition | undefined {
  return WEEKLY_OBJECTIVES.find(o => o.id === id);
}

/* ============================ Reward amounts ============================ */

/** Dollars credited to Career Earnings for completing the Daily Question. */
export const DAILY_QUESTION_REWARD = 500;
/** Career-milestone thresholds (dollars) that fire a ceremony + timeline event. */
export const CAREER_MILESTONES = [100_000, 1_000_000, 10_000_000, 100_000_000];
/** Streak lengths that earn a dedicated milestone ceremony. */
export const STREAK_MILESTONES = [7, 30, 100, 365];
