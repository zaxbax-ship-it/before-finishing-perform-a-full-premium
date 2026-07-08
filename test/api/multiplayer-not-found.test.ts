import { describe, expect, it } from 'vitest';
import { POST as gameState } from '@/app/api/multiplayer/games/[id]/route';
import { POST as lobbyAction } from '@/app/api/multiplayer/lobbies/[id]/route';

/**
 * A stored multiplayer session can outlive the short-lived room it points at.
 * When the game/lobby no longer exists the API must answer with a typed 404
 * (game_not_found / lobby_not_found) — never a generic 500 — so any client can
 * clear the stale session and stop polling a dead resource. See the audit
 * finding "stale multiplayer session 500 loop".
 */
describe('Multiplayer stale-session not-found responses', () => {
  it('POST /api/multiplayer/games/[id] on a missing game returns 404 game_not_found', async () => {
    const request = new Request('http://localhost/api/multiplayer/games/mp-game-missing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'state', playerId: 'p-ghost', playerToken: 't-ghost' })
    });

    const response = await gameState(request, { params: Promise.resolve({ id: 'mp-game-missing' }) });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('game_not_found');
  });

  it('POST /api/multiplayer/lobbies/[id] state on a missing lobby returns 404 lobby_not_found', async () => {
    const request = new Request('http://localhost/api/multiplayer/lobbies/mp-lobby-missing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'state', playerId: 'p-ghost', playerToken: 't-ghost' })
    });

    const response = await lobbyAction(request, { params: Promise.resolve({ id: 'mp-lobby-missing' }) });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('lobby_not_found');
  });
});
