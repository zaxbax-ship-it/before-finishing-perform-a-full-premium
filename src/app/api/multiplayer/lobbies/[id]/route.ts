import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/session';
import {
  enforceMultiplayerRateLimit,
  getMultiplayerRepositories,
  logMultiplayerActionFailure,
  multiplayerApiErrorResponse,
  readMultiplayerJson
} from '@/lib/api/multiplayerSecurity';
import { getMultiplayerLobbyRateLimit } from '@/lib/infrastructure/rateLimit';
import { createMultiplayerService } from '@/lib/multiplayer/service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LobbyActionBody = {
  action?: unknown;
  nickname?: unknown;
  anonymousId?: unknown;
  playerId?: unknown;
  playerToken?: unknown;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const repositories = getMultiplayerRepositories('load_lobby');
    const service = createMultiplayerService(repositories);
    const state = await service.getLobbyState(id);
    return NextResponse.json({ ok: true, gameState: state }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return multiplayerApiErrorResponse('multiplayer-lobbies-id:get', error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let action = 'lobby_action';
  try {
    const { id } = await context.params;
    const repositories = getMultiplayerRepositories('update_lobby');
    const body = await readMultiplayerJson<LobbyActionBody>(request);
    action = stringValue(body.action) || 'state';
    const limited = await enforceMultiplayerRateLimit(
      request,
      repositories,
      body.action === 'join' ? 'join_lobby' : 'lobby_action',
      getMultiplayerLobbyRateLimit(),
      stringValue(body.playerId) || stringValue(body.anonymousId) || 'anonymous'
    );
    if (limited) return limited;

    const service = createMultiplayerService(repositories);
    const credentials = {
      playerId: stringValue(body.playerId),
      playerToken: stringValue(body.playerToken)
    };

    if (body.action === 'join') {
      const user = await getAuthUser();
      const result = await service.joinLobby({
        lobbyId: id,
        nickname: stringValue(body.nickname).slice(0, 40),
        anonymousId: stringValue(body.anonymousId).slice(0, 120),
        authUserId: user?.id,
        displayName: displayNameFromUser(user?.email)
      });
      if (!result.ok) {
        logMultiplayerActionFailure('multiplayer-lobbies-id:post', 'join_lobby', 400, result.errorCode || 'MULTIPLAYER_JOIN_FAILED');
      }
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!credentials.playerId || !credentials.playerToken) {
      logMultiplayerActionFailure('multiplayer-lobbies-id:post', action, 400, 'MULTIPLAYER_MISSING_SESSION');
      return NextResponse.json({ ok: false, error: 'Missing player session.', errorCode: 'missing_session' }, { status: 400 });
    }

    const result = body.action === 'start'
      ? await service.startGame(id, credentials)
      : body.action === 'leave'
        ? await service.leaveLobby(id, credentials)
        : await service.getLobbyState(id, credentials).then(gameState => ({ ok: true, gameState }));

    if (!result.ok) {
      logMultiplayerActionFailure('multiplayer-lobbies-id:post', action, 400);
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return multiplayerApiErrorResponse('multiplayer-lobbies-id:post', error, { action });
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function displayNameFromUser(email?: string) {
  if (!email) return undefined;
  return email.split('@')[0]?.trim() || undefined;
}
