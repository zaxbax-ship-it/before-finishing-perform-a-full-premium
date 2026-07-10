/**
 * Rewards & retention domain types — Stage 10B, Version 1 (dollars-only model).
 *
 * Dependency-free and framework-agnostic, exactly like the progression and API
 * contract layers: the same rules run in the web client, on the server, and act
 * as the written spec for the future SwiftUI / Jetpack Compose clients. No React,
 * no DOM, no timers. All dates are ISO 8601 strings; "day keys" are calendar
 * strings the platform computes in the player's own timezone (see `toDayKey`),
 * so the pure engine never touches a clock or a locale.
 *
 * CURRENCY: there is exactly ONE monetary language — dollars. `Current Prize` is
 * the live game; `Career Earnings` is the permanent lifetime record (an immutable,
 * idempotent ledger, architected to be spend-capable for future cosmetics). There
 * is no second invented currency (no coins/crowns/gems/tokens).
 */

/** Auth user id when signed in, otherwise the anonymous device id. */
export type PlayerKey = string;
/** ISO 8601 timestamp. */
export type IsoTimestamp = string;
/** Calendar day in the player's timezone, `YYYY-MM-DD`. */
export type DayKey = string;
/** ISO week key, `YYYY-Www` (e.g. `2026-W28`). */
export type WeekKey = string;

export type ProgressionGameMode = 'solo' | 'multiplayer';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** What one finished game contributes to the rewards engine (superset of GameSummary). */
export type RewardGameResult = {
  mode: ProgressionGameMode;
  won: boolean;
  cashedOut: boolean;
  /** Correctly answered questions, 0..15. */
  correctAnswers: number;
  /** Total questions faced this game (for category accuracy). */
  questionsFaced: number;
  /** Dollars won this game (the final Current Prize). */
  prize: number;
  lifelinesUsed: number;
  /** Canonical category key, or `mixed` for an all-topics game. */
  category: string;
  /** Lives lost before eventually winning — powers "comeback" badges. */
  livesLostBeforeWin: number;
  /** Count of fast answers — powers "speed" badges. */
  fastAnswers: number;
  playedAt: IsoTimestamp;
};

/* ============================ Career Earnings ============================ */

export type CareerLedgerKind =
  | 'game-win'
  | 'cash-out'
  | 'daily-reward'
  | 'weekly-reward'
  | 'milestone'
  | 'cosmetic-purchase' // future sink (negative amount)
  | 'adjustment';

/** Immutable, append-only ledger entry. Positive = earned, negative = spent. */
export type CareerLedgerEntry = {
  id: string;
  kind: CareerLedgerKind;
  /** Dollars. Positive credits the lifetime record; negative is a future sink. */
  amount: number;
  /** Server-safe dedupe key — appending an existing key is a no-op. */
  idempotencyKey: string;
  createdAt: IsoTimestamp;
  metadata?: Record<string, string | number>;
};

/**
 * The single dollar record. `lifetimeTotal` only ever grows (the honor record,
 * Phase 7). `spendableBalance` = credits − debits (architected for Phase 8's
 * future cosmetic spend; equals `lifetimeTotal` at launch since there are no sinks).
 */
export type CareerEarnings = {
  lifetimeTotal: number;
  spendableBalance: number;
  bestSingleGame: number;
  millionaireWins: number;
  perfectRuns: number;
  cashOutTotal: number;
  gamesWon: number;
  gamesPlayed: number;
  /** Append-only; callers may cap the retained tail, but keys stay unique. */
  ledger: CareerLedgerEntry[];
};

/* ============================ Titles ============================ */

export type PlayerTitle = {
  id: string;
  /** Localization keys — never raw strings, so all five locales resolve them. */
  nameKey: string;
  descriptionKey: string;
  rarity: Rarity;
  earnedAt: IsoTimestamp | null;
  equipped: boolean;
};

/* ============================ Badges ============================ */

export type BadgeCategory =
  | 'milestone'
  | 'wins'
  | 'perfect'
  | 'millionaire'
  | 'lifeline-free'
  | 'comeback'
  | 'speed'
  | 'category'
  | 'streak'
  | 'multiplayer'
  | 'career';

export type AchievementBadge = {
  id: string;
  category: BadgeCategory;
  rarity: Rarity;
  nameKey: string;
  descriptionKey: string;
  /** Progress target (>=1). A one-shot badge has a target of 1. */
  target: number;
  current: number;
  unlockedAt: IsoTimestamp | null;
  /** Hidden badges are not shown until unlocked (surprise + discovery). */
  hidden: boolean;
  /** Eligible to be pinned / placed in the trophy cabinet. */
  showcaseEligible: boolean;
};

/* ============================ Trophy cabinet ============================ */

export type TrophyCabinet = {
  /** Ordered showcase; each slot holds a showcase-eligible item id or null. */
  slots: (string | null)[];
  maxSlots: number;
};

/* ============================ Category mastery ============================ */

export type MasteryTier = 'none' | 'apprentice' | 'skilled' | 'expert' | 'master' | 'grandmaster';

export type CategoryMastery = {
  categoryId: string;
  masteryXp: number;
  tier: MasteryTier;
  gamesPlayed: number;
  correctAnswers: number;
  /** Total questions faced in the category (denominator for accuracy). */
  questionsFaced: number;
  /** Tier ids reached, in order (for medallions / timeline dedupe). */
  milestones: MasteryTier[];
};

/* ============================ Collections ============================ */

export type CollectionRewardKind = 'title' | 'frame' | 'theme' | 'trophy';

export type CollectionState = {
  collectionId: string;
  earnedItemIds: string[];
  completionReward: CollectionRewardKind | null;
  completed: boolean;
};

/* ============================ Cosmetics ============================ */

export type CosmeticType =
  | 'profile-frame'
  | 'profile-background'
  | 'theme'
  | 'confetti'
  | 'result-halo'
  | 'fanfare'
  | 'nameplate';

export type CosmeticSource =
  | 'starter'
  | 'achievement'
  | 'title'
  | 'mastery'
  | 'collection'
  | 'streak'
  | 'career-milestone'
  | 'supporter'
  | 'purchase';

export type CosmeticEntitlement = {
  cosmeticId: string;
  type: CosmeticType;
  source: CosmeticSource;
  unlockedAt: IsoTimestamp;
  equipped: boolean;
};

/* ============================ Daily / streak / weekly ============================ */

export type DailyStreak = {
  current: number;
  longest: number;
  lastQualifyingDay: DayKey | null;
  /** ISO week in which the one free repair was already consumed, if any. */
  repairUsedWeek: WeekKey | null;
};

export type DailyQuestionState = {
  challengeDay: DayKey;
  questionId: string;
  completed: boolean;
  /** null until answered. */
  correct: boolean | null;
  rewardClaimed: boolean;
};

export type WeeklyObjectiveProgress = {
  objectiveId: string;
  weekKey: WeekKey;
  progress: number;
  target: number;
  /** Dollar reward on claim. */
  rewardAmount: number;
  claimed: boolean;
  /** Set-based metrics (e.g. distinct categories) dedupe through these keys. */
  seenKeys?: string[];
};

/* ============================ Timeline ============================ */

export type TimelineEventType =
  | 'joined'
  | 'first-game'
  | 'first-win'
  | 'first-millionaire'
  | 'first-perfect'
  | 'title-earned'
  | 'streak-milestone'
  | 'mastery-tier'
  | 'collection-complete'
  | 'personal-record'
  | 'career-milestone';

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  copyKey: string;
  timestamp: IsoTimestamp;
  metadata?: Record<string, string | number>;
  visible: boolean;
};

/* ============================ Player identity ============================ */

export type PlayerIdentity = {
  playerKey: PlayerKey;
  displayName: string;
  /** Seed for the default monogram avatar (usually derived from the name). */
  monogramSeed: string;
  activeTitleId: string | null;
  profileFrameId: string;
  /** Max 3, each must be an unlocked showcase-eligible badge id. */
  pinnedBadgeIds: string[];
  equippedThemeId: string;
  /** Only the key career metrics live on the identity card. */
  careerSummary: {
    lifetimeTotal: number;
    bestSingleGame: number;
    gamesPlayed: number;
  };
};

/* ============================ Reward reveal queue ============================ */

/** Deterministic priority order for the post-game ceremony (Phase 14). */
export type RevealType =
  | 'result'
  | 'career-earnings'
  | 'xp-level'
  | 'streak'
  | 'title-unlock'
  | 'badge-unlock'
  | 'legendary-badge'
  | 'mastery-tier'
  | 'collection-complete'
  | 'career-milestone'
  | 'personal-record'
  | 'first-millionaire';

export type RevealItem = {
  type: RevealType;
  /** Lower = earlier. Assigned by the engine, never by the UI. */
  priority: number;
  payload: Record<string, string | number | boolean>;
};

/* ============================ Progressive disclosure ============================ */

/** Which off-gameplay surfaces the player has earned the right to see. */
export type DisclosureState = {
  streakGlyphVisible: boolean;
  identityDiscoverable: boolean;
  profileHasNews: boolean;
  masteryVisible: boolean;
  trophyCabinetVisible: boolean;
  collectionsVisible: boolean;
  storeVisible: boolean;
  journeyVisible: boolean;
};

/* ============================ Aggregate reward context ============================ */

/**
 * A flat snapshot the badge/title/disclosure evaluators read. It is derived from
 * the persisted per-system state; keeping evaluation pure over this snapshot makes
 * unlock rules trivially portable and testable.
 */
export type PlayerRewardContext = {
  gamesPlayed: number;
  gamesWon: number;
  perfectRuns: number;
  millionaireWins: number;
  lifelineFreeWins: number;
  comebackWins: number;
  fastAnswerTotal: number;
  multiplayerWins: number;
  careerLifetime: number;
  longestStreak: number;
  currentStreak: number;
  distinctCategoriesPlayed: number;
  masteryTiersReached: Partial<Record<string, MasteryTier>>;
  unlockedBadgeIds: string[];
  unlockedTitleIds: string[];
  ownedShowcaseItemIds: string[];
  ownedNonStarterCosmetics: number;
};
