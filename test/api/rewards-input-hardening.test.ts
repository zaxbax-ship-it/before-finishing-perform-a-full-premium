import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as postResult } from '@/app/api/rewards/result/route';
import { POST as postLeaderboard } from '@/app/api/leaderboard/route';
import { MAX_GAME_PRIZE } from '@/lib/gameplay/economy';
import { getRewardsWriteRateLimit } from '@/lib/infrastructure/rateLimit';
import { toNum } from '@/lib/rewards/requestParsing';

// Anonymous caller: the routes must fall back to the client-supplied player key.
vi.mock('@/lib/auth/session', () => ({
  getAuthUser: vi.fn().mockResolvedValue(null)
}));

function jsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('Rewards input hardening (server-side clamps)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('toNum clamps to the provided upper bound and floors decimals', () => {
    expect(toNum(999_999_999, 0, MAX_GAME_PRIZE)).toBe(MAX_GAME_PRIZE);
    expect(toNum(1_000_000, 0, MAX_GAME_PRIZE)).toBe(1_000_000);
    expect(toNum(123.9, 0, MAX_GAME_PRIZE)).toBe(123);
    expect(toNum(-5, 0, MAX_GAME_PRIZE)).toBe(0);
    expect(toNum('1000000', 0, MAX_GAME_PRIZE)).toBe(0);
    expect(toNum(Number.POSITIVE_INFINITY, 0, MAX_GAME_PRIZE)).toBe(0);
  });

  it('POST /api/rewards/result caps a forged prize at the top ladder rung', async () => {
    const response = await postResult(
      jsonRequest('http://localhost/api/rewards/result', {
        playerKey: 'clamp-test-result-a1',
        gameId: 'clamp-game-1',
        mode: 'solo',
        won: true,
        correctAnswers: 15,
        questionsFaced: 15,
        prize: 999_999_999_999
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.career.lifetimeTotal).toBeLessThanOrEqual(MAX_GAME_PRIZE);
    expect(body.career.bestSingleGame).toBeLessThanOrEqual(MAX_GAME_PRIZE);
  });

  it('POST /api/leaderboard caps a forged prize and correct count', async () => {
    const response = await postLeaderboard(
      jsonRequest('http://localhost/api/leaderboard', {
        nickname: 'Clamp Tester',
        prize: 5_000_000_000,
        correctCount: 900
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.entry.bestPrize).toBeLessThanOrEqual(MAX_GAME_PRIZE);
    expect(body.entry.bestCorrectCount).toBeLessThanOrEqual(15);
  });

  it('rewards write rate limit is configurable with safe defaults', () => {
    const defaults = getRewardsWriteRateLimit();
    expect(defaults.limit).toBe(60);
    expect(defaults.windowMs).toBe(60_000);

    vi.stubEnv('REWARDS_WRITE_RATE_LIMIT', '5');
    vi.stubEnv('REWARDS_WRITE_RATE_LIMIT_WINDOW_SECONDS', '30');
    const configured = getRewardsWriteRateLimit();
    expect(configured.limit).toBe(5);
    expect(configured.windowMs).toBe(30_000);
  });

  it('throttles rewards result writes once the limit is exhausted', async () => {
    vi.stubEnv('REWARDS_WRITE_RATE_LIMIT', '2');

    const post = (n: number) =>
      postResult(
        jsonRequest('http://localhost/api/rewards/result', {
          playerKey: 'clamp-test-throttle-b2',
          gameId: `throttle-game-${n}`,
          mode: 'solo',
          won: false,
          correctAnswers: 3,
          questionsFaced: 4,
          prize: 0
        })
      );

    expect((await post(1)).status).toBe(200);
    expect((await post(2)).status).toBe(200);
    const third = await post(3);
    expect(third.status).toBe(429);
    const body = await third.json();
    expect(body.errorCode).toBe('rate_limited');
  });
});
