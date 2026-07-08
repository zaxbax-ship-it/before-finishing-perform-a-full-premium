import type { AchievementDefinition, GameSummary, PlayerProgressionState, ProgressionUpdate } from './types';
import { levelForXp, xpForGame } from './xp';

/**
 * Achievement catalogue. Ids are stable API — persisted per player and reused
 * by future native clients and premium-reward mappings. Evaluation order is
 * the array order; predicates run against the post-game snapshot (game XP
 * applied, achievement rewards not yet), so results are deterministic.
 */
export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'first_game', tier: 'bronze', xpReward: 25, isUnlocked: state => state.gamesPlayed >= 1 },
  { id: 'first_win', tier: 'silver', xpReward: 100, isUnlocked: (_state, summary) => summary.won },
  { id: 'ten_games', tier: 'silver', xpReward: 75, isUnlocked: state => state.gamesPlayed >= 10 },
  { id: 'fifty_games', tier: 'gold', xpReward: 200, isUnlocked: state => state.gamesPlayed >= 50 },
  { id: 'perfect_game', tier: 'gold', xpReward: 250, isUnlocked: (_state, summary) => summary.won && summary.correctAnswers >= 15 },
  { id: 'millionaire', tier: 'gold', xpReward: 300, isUnlocked: (_state, summary) => summary.prize >= 1_000_000 },
  { id: 'multiplayer_debut', tier: 'bronze', xpReward: 50, isUnlocked: (_state, summary) => summary.mode === 'multiplayer' },
  { id: 'level_5', tier: 'silver', xpReward: 100, isUnlocked: state => state.level >= 5 },
  { id: 'level_10', tier: 'gold', xpReward: 250, isUnlocked: state => state.level >= 10 }
];

export function achievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find(item => item.id === id);
}

/** A fresh progression snapshot for a player who has never played. */
export function emptyProgression(playerKey: string, nowIso = new Date().toISOString()): PlayerProgressionState {
  return { playerKey, xp: 0, level: 1, gamesPlayed: 0, unlockedAchievements: [], updatedAt: nowIso };
}

/**
 * Applies one finished game to a progression snapshot. Pure: returns the new
 * state plus the achievements the game unlocked. Achievement XP rewards are
 * granted after evaluation, then the level is recomputed once — level-gated
 * achievements therefore evaluate against the pre-reward level (documented,
 * deterministic; they unlock on the next game at the latest).
 */
export function applyGameToProgression(
  previous: PlayerProgressionState,
  summary: GameSummary,
  nowIso = new Date().toISOString()
): ProgressionUpdate {
  const gameXp = xpForGame(summary);
  const afterGame: PlayerProgressionState = {
    ...previous,
    xp: previous.xp + gameXp,
    gamesPlayed: previous.gamesPlayed + 1,
    level: levelForXp(previous.xp + gameXp),
    updatedAt: nowIso
  };

  const unlocked = ACHIEVEMENTS.filter(definition =>
    !previous.unlockedAchievements.includes(definition.id) && definition.isUnlocked(afterGame, summary)
  );
  const rewardXp = unlocked.reduce((sum, definition) => sum + definition.xpReward, 0);
  const finalXp = afterGame.xp + rewardXp;

  return {
    state: {
      ...afterGame,
      xp: finalXp,
      level: levelForXp(finalXp),
      unlockedAchievements: [...previous.unlockedAchievements, ...unlocked.map(definition => definition.id)]
    },
    unlocked,
    gameXp
  };
}
