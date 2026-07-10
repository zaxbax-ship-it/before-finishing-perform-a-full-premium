import { describe, expect, it } from 'vitest';
import {
  REWARDS_CONTRACT_VERSION,
  isCareerLedgerPageDto,
  isCareerSummaryDto,
  isClaimRewardRequest,
  isClaimRewardResponse,
  isIdentitySummaryDto,
  isResultProgressionUpdateDto,
  isRewardsSummaryDto
} from '@/lib/api/contracts';

const career = {
  lifetimeTotal: 1_020_000,
  spendableBalance: 1_020_000,
  bestSingleGame: 1_000_000,
  millionaireWins: 1,
  perfectRuns: 1,
  cashOutTotal: 0,
  gamesWon: 2,
  gamesPlayed: 3
};

describe('rewards API contracts — runtime guards', () => {
  it('exposes a stable contract version', () => {
    expect(typeof REWARDS_CONTRACT_VERSION).toBe('string');
  });

  it('validates the career summary', () => {
    expect(isCareerSummaryDto(career)).toBe(true);
    expect(isCareerSummaryDto({ lifetimeTotal: '1' })).toBe(false);
    expect(isCareerSummaryDto(null)).toBe(false);
  });

  it('validates the rewards summary', () => {
    const ok = {
      career,
      streak: { current: 3, longest: 5, lastQualifyingDay: '2026-07-10', repairUsedWeek: null },
      disclosure: {},
      unclaimedWeeklyCount: 1,
      dailyAvailable: true
    };
    expect(isRewardsSummaryDto(ok)).toBe(true);
    expect(isRewardsSummaryDto({ ...ok, dailyAvailable: 'yes' })).toBe(false);
    expect(isRewardsSummaryDto({ ...ok, career: { bad: 1 } })).toBe(false);
  });

  it('validates a paginated ledger page (guards item shape + cursor)', () => {
    const page = {
      items: [{ id: 'a', kind: 'game-win', amount: 1000, idempotencyKey: 'k1', createdAt: '2026-07-10T00:00:00Z' }],
      nextCursor: null
    };
    expect(isCareerLedgerPageDto(page)).toBe(true);
    expect(isCareerLedgerPageDto({ items: [{ amount: 1 }], nextCursor: null })).toBe(false); // missing idempotencyKey
    expect(isCareerLedgerPageDto({ items: 'nope', nextCursor: null })).toBe(false);
  });

  it('validates claim request/response with idempotency', () => {
    expect(isClaimRewardRequest({ rewardId: 'weekly:play_three', idempotencyKey: 'abc' })).toBe(true);
    expect(isClaimRewardRequest({ rewardId: 'x', idempotencyKey: '' })).toBe(false); // empty key rejected
    expect(isClaimRewardResponse({ ok: true, granted: 1000, alreadyClaimed: false })).toBe(true);
    expect(isClaimRewardResponse({ ok: false })).toBe(false);
  });

  it('validates identity summary + result progression update', () => {
    expect(
      isIdentitySummaryDto({
        playerKey: 'p1',
        displayName: 'Ada',
        monogramSeed: 'A',
        activeTitleId: null,
        activeTitleNameKey: null,
        profileFrameId: 'frame-classic',
        streakCurrent: 0
      })
    ).toBe(true);
    expect(
      isResultProgressionUpdateDto({
        reveals: [{ type: 'result', priority: 0, payload: {} }],
        career,
        newTitleIds: ['rookie'],
        newBadgeIds: ['first_game'],
        streak: { current: 1, longest: 1, lastQualifyingDay: null, repairUsedWeek: null }
      })
    ).toBe(true);
    expect(isResultProgressionUpdateDto({ reveals: 'x', career })).toBe(false);
  });
});
