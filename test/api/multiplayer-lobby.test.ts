import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as listLobbies, POST as createLobby } from '@/app/api/multiplayer/lobbies/route';
import { GET as getLobby, POST as lobbyAction } from '@/app/api/multiplayer/lobbies/[id]/route';

// Mock session module
vi.mock('@/lib/auth/session', () => ({
  getAuthUser: vi.fn().mockResolvedValue(null)
}));

import { getAuthUser } from '@/lib/auth/session';

describe('Multiplayer Lobby API integration tests', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/multiplayer/lobbies returns an empty or populated list of lobbies', async () => {
    const response = await listLobbies();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.lobbies)).toBe(true);
  });

  it('POST /api/multiplayer/lobbies rejects requests missing anonymousId', async () => {
    const request = new Request('http://localhost/api/multiplayer/lobbies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Player' })
    });

    const response = await createLobby(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('missing_identity');
  });

  it('POST /api/multiplayer/lobbies creates a new lobby successfully', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const request = new Request('http://localhost/api/multiplayer/lobbies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'HostPlayer',
        anonymousId: 'anon-id-123',
        maxPlayers: 3,
        locale: 'en',
        category: 'Sports'
      })
    });

    const response = await createLobby(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.lobby).toBeDefined();
    expect(body.lobby.maxPlayers).toBe(2); // Stage 18: head-to-head collapses any request to 2
    expect(body.lobby.locale).toBe('en');
    expect(body.lobby.playerCount).toBe(1);
    expect(body.credentials).toBeDefined();
    expect(body.credentials.playerId).toBeDefined();
    expect(body.credentials.playerToken).toBeDefined();
  });

  it('GET /api/multiplayer/lobbies/[id] fetches lobby state', async () => {
    // 1. Create a lobby first to get its ID
    const requestCreate = new Request('http://localhost/api/multiplayer/lobbies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'HostPlayer',
        anonymousId: 'anon-id-999',
        maxPlayers: 2
      })
    });
    const resCreate = await createLobby(requestCreate);
    const bodyCreate = await resCreate.json();
    const lobbyId = bodyCreate.lobby.id;

    // 2. Fetch lobby state
    const context = { params: Promise.resolve({ id: lobbyId }) };
    const requestGet = new Request(`http://localhost/api/multiplayer/lobbies/${lobbyId}`);
    const response = await getLobby(requestGet, context);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.gameState).toBeDefined();
    expect(body.gameState.lobby.id).toBe(lobbyId);
  });

  it('POST /api/multiplayer/lobbies/[id] joins lobby successfully', async () => {
    // 1. Create lobby
    const requestCreate = new Request('http://localhost/api/multiplayer/lobbies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'HostPlayer',
        anonymousId: 'host-anon',
        maxPlayers: 2
      })
    });
    const resCreate = await createLobby(requestCreate);
    const bodyCreate = await resCreate.json();
    const lobbyId = bodyCreate.lobby.id;

    // 2. Join lobby
    const requestJoin = new Request(`http://localhost/api/multiplayer/lobbies/${lobbyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join',
        nickname: 'GuestPlayer',
        anonymousId: 'guest-anon'
      })
    });
    const context = { params: Promise.resolve({ id: lobbyId }) };
    const response = await lobbyAction(requestJoin, context);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.credentials).toBeDefined();
    expect(body.credentials.playerId).toBeDefined();
  });

  it('POST /api/multiplayer/lobbies/[id] rejects lobby action with missing credentials', async () => {
    const context = { params: Promise.resolve({ id: 'some-lobby' }) };
    const requestAction = new Request('http://localhost/api/multiplayer/lobbies/some-lobby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start'
      })
    });

    const response = await lobbyAction(requestAction, context);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('missing_session');
  });
});
