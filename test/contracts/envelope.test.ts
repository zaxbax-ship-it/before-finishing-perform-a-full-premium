import { describe, expect, it } from 'vitest';
import {
  API_CONTRACT_VERSION,
  isApiEnvelope,
  isApiError,
  isApiOk,
  isLeaderboardResponse
} from '@/lib/api/contracts';

describe('API envelope contracts', () => {
  it('exposes a stable contract version', () => {
    expect(typeof API_CONTRACT_VERSION).toBe('string');
    expect(API_CONTRACT_VERSION.length).toBeGreaterThan(0);
  });

  it('recognizes success envelopes', () => {
    expect(isApiOk({ ok: true, entries: [] })).toBe(true);
    expect(isApiOk({ ok: false, error: 'x' })).toBe(false);
    expect(isApiOk(null)).toBe(false);
  });

  it('recognizes error envelopes', () => {
    expect(isApiError({ ok: false, error: 'nope' })).toBe(true);
    expect(isApiError({ ok: true })).toBe(false);
  });

  it('recognizes any valid envelope', () => {
    expect(isApiEnvelope({ ok: true })).toBe(true);
    expect(isApiEnvelope({ ok: false })).toBe(true);
    expect(isApiEnvelope({})).toBe(false);
    expect(isApiEnvelope('nope')).toBe(false);
  });

  it('validates a leaderboard listing response shape', () => {
    const good = {
      ok: true,
      provider: 'local-json',
      entries: [{ id: 'lb-1', nickname: 'Ace', bestPrize: 1000, bestCorrectCount: 7, gamesCount: 2, createdAt: 'x', updatedAt: 'y' }]
    };
    expect(isLeaderboardResponse(good)).toBe(true);
    expect(isLeaderboardResponse({ ok: true, provider: 'local-json', entries: [{ nickname: 'x' }] })).toBe(false);
    expect(isLeaderboardResponse({ ok: false })).toBe(false);
  });
});
