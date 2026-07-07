import { describe, expect, it } from 'vitest';
import { isListLobbiesResponse, isMultiplayerLobbySummaryDto } from '@/lib/api/contracts';
import type { MultiplayerLobbySummary } from '@/lib/multiplayer/types';

function lobbySummary(): MultiplayerLobbySummary {
  return {
    id: 'lobby-1',
    status: 'waiting',
    visibility: 'public',
    maxPlayers: 2,
    locale: 'he',
    hostPlayerId: 'player-1',
    createdAt: 'now',
    updatedAt: 'now',
    expiresAt: 'later',
    playerCount: 1,
    players: [{ id: 'player-1', nickname: 'Host', position: 1, isConnected: true }]
  };
}

describe('multiplayer public lobby contract', () => {
  it('validates a well-formed lobby summary', () => {
    expect(isMultiplayerLobbySummaryDto(lobbySummary())).toBe(true);
  });

  it('validates the open-lobbies listing response', () => {
    expect(isListLobbiesResponse({ ok: true, lobbies: [lobbySummary()] })).toBe(true);
    expect(isListLobbiesResponse({ ok: true, lobbies: [] })).toBe(true);
  });

  it('rejects malformed lobby responses', () => {
    expect(isListLobbiesResponse({ ok: true, lobbies: [{ id: 'x' }] })).toBe(false);
    expect(isListLobbiesResponse({ ok: false })).toBe(false);
    expect(isMultiplayerLobbySummaryDto({ id: 'x', status: 'waiting' })).toBe(false);
  });
});
