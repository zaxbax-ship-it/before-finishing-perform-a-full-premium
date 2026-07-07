import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/leaderboard/route';
import { isLeaderboardResponse } from '@/lib/api/contracts';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

// Mock session module
vi.mock('@/lib/auth/session', () => ({
  getAuthUser: vi.fn().mockResolvedValue(null)
}));

import { getAuthUser } from '@/lib/auth/session';

describe('Leaderboard API endpoint integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns a valid list of leaderboard entries', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(isLeaderboardResponse(body)).toBe(true);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it('POST rejects invalid nicknames (empty or wrong characters)', async () => {
    const badNicknames = ['', 'a', 'ab', 'inv@lid'];
    
    for (const nick of badNicknames) {
      const request = new Request('http://localhost/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nick, prize: 5000, correctCount: 5 })
      });
      
      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
    }
  });

  it('POST rejects reserved nicknames', async () => {
    const reserved = ['admin', 'administrator', 'moderator', 'system', 'google'];
    
    for (const nick of reserved) {
      const request = new Request('http://localhost/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nick, prize: 5000, correctCount: 5 })
      });
      
      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.status).toBe('nickname_reserved');
    }
  });

  it('POST successfully logs a new score for a guest player', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const uniqueNick = `usr-${Date.now()}`;
    const request = new Request('http://localhost/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: uniqueNick, prize: 10000, correctCount: 8 })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe('ok');
    expect(body.entry).toBeDefined();
    expect(body.entry.nickname).toBe(uniqueNick);
    expect(body.entry.bestPrize).toBe(10000);
    expect(body.entry.bestCorrectCount).toBe(8);
    expect(body.entries).toBeDefined();
  });

  it('POST associates user ID when player is logged in', async () => {
    const mockUser = { id: 'auth-user-999', email: 'player@example.com', emailVerified: true };
    vi.mocked(getAuthUser).mockResolvedValue(mockUser);

    const uniqueNick = `usr-${Date.now()}-auth`;
    const request = new Request('http://localhost/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: uniqueNick, prize: 20000, correctCount: 10, displayName: 'Pro Player' })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.entry.authUserId).toBe(mockUser.id);
    expect(body.entry.displayName).toBe('Pro Player');
  });

  it('POST rejects score submission when nickname is already claimed by another user', async () => {
    // 1. Submit score with a user
    const mockUser1 = { id: 'user-aaa', email: 'aaa@example.com', emailVerified: true };
    vi.mocked(getAuthUser).mockResolvedValue(mockUser1);
    const nickname = `claimed-${Date.now()}`;
    
    let request = new Request('http://localhost/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, prize: 5000, correctCount: 5 })
    });
    let response = await POST(request);
    expect(response.status).toBe(200);

    // 2. Submit score with a different user (should fail 409 nickname_taken)
    const mockUser2 = { id: 'user-bbb', email: 'bbb@example.com', emailVerified: true };
    vi.mocked(getAuthUser).mockResolvedValue(mockUser2);

    request = new Request('http://localhost/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, prize: 10000, correctCount: 8 })
    });
    response = await POST(request);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.status).toBe('nickname_taken');
  });
});
