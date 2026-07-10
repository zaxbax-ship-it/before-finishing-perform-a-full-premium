import { describe, expect, it } from 'vitest';
import { createInMemoryRewardsRepository } from '@/lib/repositories/rewardsRepository';
import {
  applyGameResult,
  claimWeekly,
  completeDaily,
  equipCosmeticForPlayer,
  getDailyChallenge,
  getRewardsSummary,
  getWeekly
} from '@/lib/rewards/service';
import type { RewardGameResult } from '@/lib/rewards/types';

const NOW = '2026-07-10T12:00:00.000Z';

function game(p: Partial<RewardGameResult> = {}): RewardGameResult {
  return {
    mode: 'solo',
    won: true,
    cashedOut: false,
    correctAnswers: 15,
    questionsFaced: 15,
    prize: 1_000_000,
    lifelinesUsed: 0,
    category: 'science',
    livesLostBeforeWin: 0,
    fastAnswers: 0,
    playedAt: NOW,
    ...p
  };
}

describe('rewards service — game-end lifecycle', () => {
  it('runs the full engine once: career, titles, badges, streak, ceremony', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const update = await applyGameResult(repo, {
      playerKey: 'p1',
      displayName: 'Ada',
      result: game(),
      gameId: 'g1',
      dayKey: '2026-07-10',
      nowIso: NOW
    });
    expect(update.career.lifetimeTotal).toBe(1_000_000);
    expect(update.career.millionaireWins).toBe(1);
    expect(update.newTitleIds).toEqual(expect.arrayContaining(['rookie', 'perfectionist', 'millionaire']));
    expect(update.newBadgeIds).toEqual(expect.arrayContaining(['first_game', 'first_win', 'millionaire', 'perfect_game']));
    expect(update.streak.current).toBe(1);
    const types = update.reveals.map(r => r.type);
    expect(types[0]).toBe('result');
    expect(types).toContain('first-millionaire');
    expect(types).toContain('career-earnings');
    const snap = await repo.load('p1');
    expect(snap.timeline.some(e => e.type === 'first-millionaire')).toBe(true);
  });

  it('is idempotent by gameId', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 50_000, correctAnswers: 5 }), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
    const second = await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 50_000, correctAnswers: 5 }), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
    expect(second.career.lifetimeTotal).toBe(50_000);
    expect(second.career.gamesPlayed).toBe(1);
    expect(second.reveals.map(r => r.type)).toEqual(['result']);
  });

  it('earns a category medallion at the master tier', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    for (let i = 0; i < 6; i += 1) {
      await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 20_000, category: 'history' }), gameId: `h${i}`, dayKey: '2026-07-10', nowIso: NOW });
    }
    const snap = await repo.load('p1');
    const history = snap.mastery.find(m => m.categoryId === 'history');
    expect(history?.tier).toBe('master');
    expect(snap.collections.flatMap(c => c.earnedItemIds)).toContain('medallion:history');
  });

  it('increments the streak across consecutive local days', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 1000 }), gameId: 'd1', dayKey: '2026-07-10', nowIso: NOW });
    const day2 = await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 1000 }), gameId: 'd2', dayKey: '2026-07-11', nowIso: NOW });
    expect(day2.streak.current).toBe(2);
  });

  it('grants the daily reward exactly once', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    await getDailyChallenge(repo, 'p1', '2026-07-10', 'q-1');
    const first = await completeDaily(repo, 'p1', '2026-07-10', true, NOW);
    const second = await completeDaily(repo, 'p1', '2026-07-10', true, NOW);
    expect(first.granted).toBeGreaterThan(0);
    expect(second.granted).toBe(0);
    expect(first.streakCurrent).toBe(1);
  });

  it('exposes a summary with disclosure and no second currency', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    await applyGameResult(repo, { playerKey: 'p1', result: game({ prize: 20_000, correctAnswers: 5, category: 'history' }), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
    const summary = await getRewardsSummary(repo, 'p1');
    expect(summary.career.lifetimeTotal).toBe(20_000);
    expect(summary.disclosure.journeyVisible).toBe(true);
    expect(summary).not.toHaveProperty('crowns');
  });

  it('weekly objectives load (<=3) and an incomplete claim grants nothing', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    const weekly = await getWeekly(repo, 'p1', '2026-W28');
    expect(weekly.objectives.length).toBeLessThanOrEqual(3);
    const claim = await claimWeekly(repo, 'p1', weekly.objectives[0].objectiveId, NOW);
    expect(claim.granted).toBe(0);
  });

  it('grants and equips a cosmetic earned from a badge', async () => {
    const repo = createInMemoryRewardsRepository(() => NOW);
    await applyGameResult(repo, { playerKey: 'p1', result: game(), gameId: 'g1', dayKey: '2026-07-10', nowIso: NOW });
    const beforeEquip = await repo.load('p1');
    expect(beforeEquip.cosmetics.some(c => c.cosmeticId === 'frame-gold')).toBe(true);
    await equipCosmeticForPlayer(repo, 'p1', 'frame-gold');
    const after = await repo.load('p1');
    expect(after.identity.profileFrameId).toBe('frame-gold');
  });
});
