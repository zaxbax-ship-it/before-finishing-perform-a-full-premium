/**
 * Progression domain types — XP, levels and achievements.
 *
 * Dependency-free and framework-agnostic (like the API contracts layer) so the
 * exact same rules can run in the web client, on the server, and serve as the
 * written spec for the future SwiftUI / Jetpack Compose implementations.
 * Dates are ISO 8601 strings; payloads are flat and serializable.
 */

export type ProgressionGameMode = 'solo' | 'multiplayer';

/** What a finished game reports to the progression engine. */
export type GameSummary = {
  mode: ProgressionGameMode;
  won: boolean;
  /** Number of correctly answered questions in the game. */
  correctAnswers: number;
  /** Final (fictional) prize amount for the game. */
  prize: number;
  /** Total lifelines used during the game. */
  lifelinesUsed?: number;
};

/** A player's progression snapshot. `playerKey` is an auth user id or anonymous id. */
export type PlayerProgressionState = {
  playerKey: string;
  xp: number;
  level: number;
  gamesPlayed: number;
  unlockedAchievements: string[];
  updatedAt: string;
};

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export type AchievementDefinition = {
  id: string;
  tier: AchievementTier;
  /** XP granted when the achievement unlocks. */
  xpReward: number;
  /**
   * Pure unlock predicate evaluated against the post-game snapshot (game XP
   * already applied) and the summary of the game that just finished. Native
   * clients re-implement these predicates from this definition list.
   */
  isUnlocked: (state: PlayerProgressionState, summary: GameSummary) => boolean;
};

export type ProgressionUpdate = {
  state: PlayerProgressionState;
  /** Achievements newly unlocked by this game, in definition order. */
  unlocked: AchievementDefinition[];
  /** XP gained from the game itself (excluding achievement rewards). */
  gameXp: number;
};
