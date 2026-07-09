import { describe, expect, it } from 'vitest';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { getMultiplayerAdminOverview, terminateGame, terminateLobby } from '@/lib/admin/multiplayerAdminService';
import type { AdminContext } from '@/lib/auth/types';
import type { MultiplayerGame, MultiplayerLobby } from '@/lib/multiplayer/types';

const actor: AdminContext = {
  email: 'qa-mp-admin@example.com',
  displayName: 'QA MP',
  roleSlugs: ['super_admin'],
  permissionSlugs: ['moderation.read', 'spam.manage'],
  source: 'local-open'
};

function makeLobby(id: string, overrides: Partial<MultiplayerLobby> = {}): MultiplayerLobby {
  const now = new Date().toISOString();
  return {
    id,
    status: 'waiting',
    visibility: 'public',
    maxPlayers: 2,
    locale: 'he',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ...overrides
  };
}

function makeGame(id: string, lobbyId: string, overrides: Partial<MultiplayerGame> = {}): MultiplayerGame {
  const now = new Date().toISOString();
  return {
    id,
    lobbyId,
    status: 'in_progress',
    questionIds: ['1', '2', '3'],
    currentRoundIndex: 0,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

/** Phase 6 — multiplayer operations console over the repository layer. */
describe('Multiplayer admin console', () => {
  it('reports queue metrics and honest unavailability', async () => {
    const repositories = getRepositoryProvider();
    await repositories.multiplayer.createLobby(makeLobby('mp-admin-lobby-1'));

    const overview = await getMultiplayerAdminOverview(repositories);
    expect(overview.queue.openLobbies).toBeGreaterThanOrEqual(1);
    expect(overview.lobbies.some(lobby => lobby.id === 'mp-admin-lobby-1')).toBe(true);
    expect(overview.unavailable.spectators).toMatch(/spectator/i);
  });

  it('terminates a lobby and its game, audit-logged', async () => {
    const repositories = getRepositoryProvider();
    await repositories.multiplayer.createLobby(makeLobby('mp-admin-lobby-2', { status: 'in_progress', gameId: 'mp-admin-game-2' }));
    await repositories.multiplayer.createGame(makeGame('mp-admin-game-2', 'mp-admin-lobby-2'));

    const result = await terminateLobby(repositories, actor, 'mp-admin-lobby-2');
    expect(result.ok).toBe(true);

    expect((await repositories.multiplayer.findLobby('mp-admin-lobby-2'))?.status).toBe('cancelled');
    expect((await repositories.multiplayer.findGame('mp-admin-game-2'))?.status).toBe('cancelled');

    const logs = await repositories.auditLogs.list({ limit: 10 });
    expect(logs.some(log => log.action === 'admin_multiplayer_terminate_lobby' && log.actor === actor.email)).toBe(true);
  });

  it('terminates a running game and closes its lobby', async () => {
    const repositories = getRepositoryProvider();
    await repositories.multiplayer.createLobby(makeLobby('mp-admin-lobby-3', { status: 'in_progress', gameId: 'mp-admin-game-3' }));
    await repositories.multiplayer.createGame(makeGame('mp-admin-game-3', 'mp-admin-lobby-3'));

    const result = await terminateGame(repositories, actor, 'mp-admin-game-3');
    expect(result.ok).toBe(true);
    expect((await repositories.multiplayer.findGame('mp-admin-game-3'))?.status).toBe('cancelled');
    expect((await repositories.multiplayer.findLobby('mp-admin-lobby-3'))?.status).toBe('cancelled');
  });

  it('refuses to terminate an already finished game', async () => {
    const repositories = getRepositoryProvider();
    await repositories.multiplayer.createLobby(makeLobby('mp-admin-lobby-4', { status: 'finished', gameId: 'mp-admin-game-4' }));
    await repositories.multiplayer.createGame(makeGame('mp-admin-game-4', 'mp-admin-lobby-4', { status: 'finished', finishedAt: new Date().toISOString() }));

    const result = await terminateGame(repositories, actor, 'mp-admin-game-4');
    expect(result.ok).toBe(false);
  });
});
