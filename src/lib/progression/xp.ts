import type { GameSummary } from './types';

/**
 * XP economy and level curve. Pure functions with exported constants so every
 * client (web, iOS, Android) derives identical numbers.
 */

export const XP_GAME_COMPLETED = 20;
export const XP_PER_CORRECT_ANSWER = 10;
export const XP_WIN_BONUS = 150;
export const XP_MULTIPLAYER_BONUS = 25;

export const LEVEL_BASE_XP = 100;
export const LEVEL_EXPONENT = 1.5;
export const MAX_LEVEL = 100;

/** XP earned by a single finished game (never negative). */
export function xpForGame(summary: GameSummary): number {
  const correct = Math.max(0, Math.floor(summary.correctAnswers));
  const xp =
    XP_GAME_COMPLETED +
    correct * XP_PER_CORRECT_ANSWER +
    (summary.won ? XP_WIN_BONUS : 0) +
    (summary.mode === 'multiplayer' ? XP_MULTIPLAYER_BONUS : 0);
  return Math.max(0, xp);
}

/** Total (cumulative) XP required to *reach* a level. Level 1 starts at 0. */
export function totalXpForLevel(level: number): number {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return Math.round(LEVEL_BASE_XP * Math.pow(clamped - 1, LEVEL_EXPONENT));
}

/** The level a given XP total corresponds to (1..MAX_LEVEL). */
export function levelForXp(xp: number): number {
  const safeXp = Math.max(0, xp);
  let level = 1;
  while (level < MAX_LEVEL && totalXpForLevel(level + 1) <= safeXp) level += 1;
  return level;
}

/** Progress within the current level, for progress bars. */
export function levelProgress(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number; ratio: number } {
  const level = levelForXp(xp);
  const floor = totalXpForLevel(level);
  const ceil = level >= MAX_LEVEL ? floor : totalXpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const into = Math.max(0, xp - floor);
  return { level, currentLevelXp: into, nextLevelXp: ceil - floor, ratio: level >= MAX_LEVEL ? 1 : Math.min(1, into / span) };
}
