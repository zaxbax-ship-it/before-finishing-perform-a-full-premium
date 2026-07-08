import { describe, expect, it } from 'vitest';
import {
  levelForXp,
  levelProgress,
  MAX_LEVEL,
  totalXpForLevel,
  XP_GAME_COMPLETED,
  XP_MULTIPLAYER_BONUS,
  XP_PER_CORRECT_ANSWER,
  XP_WIN_BONUS,
  xpForGame
} from '@/lib/progression/xp';
import { ACHIEVEMENTS, applyGameToProgression, emptyProgression } from '@/lib/progression/achievements';
import type { GameSummary } from '@/lib/progression/types';

const soloLoss = (correct: number, prize = 0): GameSummary => ({ mode: 'solo', won: false, correctAnswers: correct, prize });
const soloWin: GameSummary = { mode: 'solo', won: true, correctAnswers: 15, prize: 1_000_000 };

describe('xp engine', () => {
  it('computes game XP from its documented parts', () => {
    expect(xpForGame(soloLoss(0))).toBe(XP_GAME_COMPLETED);
    expect(xpForGame(soloLoss(7))).toBe(XP_GAME_COMPLETED + 7 * XP_PER_CORRECT_ANSWER);
    expect(xpForGame(soloWin)).toBe(XP_GAME_COMPLETED + 15 * XP_PER_CORRECT_ANSWER + XP_WIN_BONUS);
    expect(xpForGame({ ...soloLoss(3), mode: 'multiplayer' })).toBe(XP_GAME_COMPLETED + 3 * XP_PER_CORRECT_ANSWER + XP_MULTIPLAYER_BONUS);
    expect(xpForGame(soloLoss(-5))).toBe(XP_GAME_COMPLETED);
  });

  it('has a strictly increasing level curve starting at zero', () => {
    expect(totalXpForLevel(1)).toBe(0);
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(totalXpForLevel(level)).toBeGreaterThan(totalXpForLevel(level - 1));
    }
  });

  it('maps XP to levels at exact boundaries', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(totalXpForLevel(2) - 1)).toBe(1);
    expect(levelForXp(totalXpForLevel(2))).toBe(2);
    expect(levelForXp(totalXpForLevel(10))).toBe(10);
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
  });

  it('reports in-level progress for progress bars', () => {
    const { level, ratio } = levelProgress(totalXpForLevel(3));
    expect(level).toBe(3);
    expect(ratio).toBe(0);
    expect(levelProgress(Number.MAX_SAFE_INTEGER).ratio).toBe(1);
  });
});

describe('achievements', () => {
  it('has unique stable ids', () => {
    const ids = ACHIEVEMENTS.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('unlocks first_game on the first game and never again', () => {
    const first = applyGameToProgression(emptyProgression('p1'), soloLoss(2));
    expect(first.unlocked.map(a => a.id)).toContain('first_game');
    const second = applyGameToProgression(first.state, soloLoss(2));
    expect(second.unlocked.map(a => a.id)).not.toContain('first_game');
    expect(second.state.unlockedAchievements.filter(id => id === 'first_game')).toHaveLength(1);
  });

  it('grants achievement XP rewards on top of game XP', () => {
    const update = applyGameToProgression(emptyProgression('p2'), soloLoss(0));
    const firstGameReward = ACHIEVEMENTS.find(a => a.id === 'first_game')!.xpReward;
    expect(update.gameXp).toBe(XP_GAME_COMPLETED);
    expect(update.state.xp).toBe(XP_GAME_COMPLETED + firstGameReward);
  });

  it('unlocks the win/perfect/millionaire set on a perfect winning game', () => {
    const update = applyGameToProgression(emptyProgression('p3'), soloWin);
    const ids = update.unlocked.map(a => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first_game', 'first_win', 'perfect_game', 'millionaire']));
  });

  it('unlocks multiplayer_debut only for multiplayer games', () => {
    const solo = applyGameToProgression(emptyProgression('p4'), soloLoss(1));
    expect(solo.unlocked.map(a => a.id)).not.toContain('multiplayer_debut');
    const multi = applyGameToProgression(solo.state, { ...soloLoss(1), mode: 'multiplayer' });
    expect(multi.unlocked.map(a => a.id)).toContain('multiplayer_debut');
  });

  it('unlocks count-based achievements when thresholds are crossed', () => {
    let state = emptyProgression('p5');
    let sawTenGames = false;
    for (let game = 1; game <= 10; game++) {
      const update = applyGameToProgression(state, soloLoss(1));
      state = update.state;
      if (update.unlocked.some(a => a.id === 'ten_games')) {
        expect(game).toBe(10);
        sawTenGames = true;
      }
    }
    expect(sawTenGames).toBe(true);
    expect(state.gamesPlayed).toBe(10);
  });

  it('keeps level consistent with total XP after rewards', () => {
    let state = emptyProgression('p6');
    for (let game = 0; game < 25; game++) {
      state = applyGameToProgression(state, soloWin).state;
    }
    expect(state.level).toBe(levelForXp(state.xp));
    expect(state.level).toBeGreaterThan(1);
  });
});
