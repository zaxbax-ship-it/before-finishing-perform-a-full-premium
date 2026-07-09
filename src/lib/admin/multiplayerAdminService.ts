import 'server-only';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import type { AdminContext } from '@/lib/auth/types';

/**
 * Multiplayer operations console — read model + moderation actions over the
 * multiplayer repository. Pure repository aggregation (native-portable);
 * terminations write through the same repositories the game service uses, so
 * polling clients pick the cancelled state up on their next refresh.
 */

export type AdminLobbyRow = {
  id: string;
  status: string;
  locale: string;
  category?: string;
  maxPlayers: number;
  playerCount: number;
  connectedCount: number;
  players: Array<{ nickname: string; isConnected: boolean }>;
  createdAt: string;
  gameId?: string;
};

export type AdminGameRow = {
  id: string;
  lobbyId: string;
  status: string;
  currentRoundIndex: number;
  totalRounds: number;
  startedAt?: string;
  finishedAt?: string;
  winner?: string;
};

export type MultiplayerAdminOverview = {
  generatedAt: string;
  queue: {
    openLobbies: number;
    liveGames: number;
    connectedPlayers: number;
    gamesLast24h: number;
    finishedLast24h: number;
    expiredLobbies: number;
    averageFillRatio: number | null;
  };
  lobbies: AdminLobbyRow[];
  liveGames: AdminGameRow[];
  recentFinishedGames: AdminGameRow[];
  unavailable: Record<string, string>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CONNECTED_WINDOW_MS = 2 * 60 * 1000;

export async function getMultiplayerAdminOverview(repositories: RepositoryProvider): Promise<MultiplayerAdminOverview> {
  const now = Date.now();
  const [lobbies, games] = await Promise.all([
    repositories.multiplayer.listLobbies({ limit: 200 }),
    repositories.multiplayer.listGames({ limit: 200 })
  ]);

  const interesting = lobbies.filter(lobby => lobby.status !== 'expired' && lobby.status !== 'cancelled').slice(0, 50);
  const lobbyRows: AdminLobbyRow[] = [];
  let connectedPlayers = 0;
  const fillRatios: number[] = [];

  for (const lobby of interesting) {
    const players = await repositories.multiplayer.listPlayers(lobby.id);
    const present = players.filter(player => !player.disconnectedAt);
    const connected = present.filter(player => player.isConnected && now - new Date(player.lastSeenAt).getTime() < CONNECTED_WINDOW_MS);
    if (lobby.status === 'waiting' || lobby.status === 'ready' || lobby.status === 'starting' || lobby.status === 'in_progress') {
      connectedPlayers += connected.length;
      fillRatios.push(present.length / lobby.maxPlayers);
    }
    lobbyRows.push({
      id: lobby.id,
      status: lobby.status,
      locale: lobby.locale,
      category: lobby.category,
      maxPlayers: lobby.maxPlayers,
      playerCount: present.length,
      connectedCount: connected.length,
      players: present.map(player => ({ nickname: player.nickname, isConnected: player.isConnected })),
      createdAt: lobby.createdAt,
      gameId: lobby.gameId
    });
  }

  const liveGames: AdminGameRow[] = [];
  const finished: AdminGameRow[] = [];
  for (const game of games.slice(0, 60)) {
    if (game.status !== 'in_progress' && game.status !== 'starting' && game.status !== 'finished') continue;
    const results = game.status === 'finished' ? await repositories.multiplayer.listResults(game.id) : [];
    const top = [...results].sort((a, b) => a.rank - b.rank)[0];
    const winnerPlayer = top ? await repositories.multiplayer.findPlayer(top.playerId) : undefined;
    const row: AdminGameRow = {
      id: game.id,
      lobbyId: game.lobbyId,
      status: game.status,
      currentRoundIndex: game.currentRoundIndex,
      totalRounds: game.questionIds.length,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      winner: winnerPlayer?.nickname
    };
    if (game.status === 'finished') finished.push(row);
    else liveGames.push(row);
  }

  return {
    generatedAt: new Date().toISOString(),
    queue: {
      openLobbies: lobbies.filter(lobby => lobby.status === 'waiting' || lobby.status === 'ready').length,
      liveGames: liveGames.length,
      connectedPlayers,
      gamesLast24h: games.filter(game => now - new Date(game.createdAt).getTime() < DAY_MS).length,
      finishedLast24h: games.filter(game => game.finishedAt && now - new Date(game.finishedAt).getTime() < DAY_MS).length,
      expiredLobbies: lobbies.filter(lobby => lobby.status === 'expired').length,
      averageFillRatio: fillRatios.length ? Math.round((fillRatios.reduce((sum, ratio) => sum + ratio, 0) / fillRatios.length) * 100) : null
    },
    lobbies: lobbyRows,
    liveGames,
    recentFinishedGames: finished.slice(0, 10),
    unavailable: {
      spectators: 'Spectator mode does not exist; only seated players are tracked.',
      replayFiles: 'Full replays are not recorded; rounds, answers and results are the available replay metadata.'
    }
  };
}

export type TerminateResult = { ok: true } | { ok: false; error: string };

/** Cancels a lobby (and its game, if one started). Audit-logged. */
export async function terminateLobby(repositories: RepositoryProvider, actor: AdminContext, lobbyId: string): Promise<TerminateResult> {
  const lobby = await repositories.multiplayer.findLobby(lobbyId);
  if (!lobby) return { ok: false, error: 'Lobby was not found.' };
  if (lobby.status === 'cancelled' || lobby.status === 'expired') return { ok: false, error: 'Lobby is already closed.' };

  const timestamp = new Date().toISOString();
  await repositories.multiplayer.updateLobby(lobbyId, { status: 'cancelled', updatedAt: timestamp });
  if (lobby.gameId) {
    await repositories.multiplayer.updateGame(lobby.gameId, { status: 'cancelled', updatedAt: timestamp });
  }
  await audit(repositories, actor, 'admin_multiplayer_terminate_lobby', lobbyId, { hadGame: Boolean(lobby.gameId) });
  return { ok: true };
}

/** Cancels a running game and closes its lobby. Audit-logged. */
export async function terminateGame(repositories: RepositoryProvider, actor: AdminContext, gameId: string): Promise<TerminateResult> {
  const game = await repositories.multiplayer.findGame(gameId);
  if (!game) return { ok: false, error: 'Game was not found.' };
  if (game.status === 'finished' || game.status === 'cancelled') return { ok: false, error: 'Game is already over.' };

  const timestamp = new Date().toISOString();
  await repositories.multiplayer.updateGame(gameId, { status: 'cancelled', finishedAt: timestamp, updatedAt: timestamp });
  await repositories.multiplayer.updateLobby(game.lobbyId, { status: 'cancelled', updatedAt: timestamp });
  await audit(repositories, actor, 'admin_multiplayer_terminate_game', gameId, { lobbyId: game.lobbyId });
  return { ok: true };
}

async function audit(repositories: RepositoryProvider, actor: AdminContext, action: string, targetId: string, details: Record<string, unknown>) {
  await repositories.auditLogs.create({
    actorLabel: actor.email,
    action,
    targetType: 'multiplayer',
    targetId,
    details
  });
}
