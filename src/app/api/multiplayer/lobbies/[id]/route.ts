import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/session';
import { enforceMultiplayerRateLimit, readMultiplayerJson } from '@/lib/api/multiplayerSecurity';
import { getMultiplayerLobbyRateLimit } from '@/lib/infrastructure/rateLimit';
import { createMultiplayerService } from '@/lib/multiplayer/service';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

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
    const service = createMultiplayerService();
    const state = await service.getLobbyState(id);
    return NextResponse.json({ ok: true, gameState: state }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not load lobby.' }, { status: 404 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const repositories = getRepositoryProvider();
    const body = await readMultiplayerJson<LobbyActionBody>(request);
    const limited = await enforceMultiplayerRateLimit(
      request,
      repositories,
      body.action === 'join' ? 'join_lobby' : 'lobby_action',
      getMultiplayerLobbyRateLimit(),
      stringValue(body.playerId) || stringValue(body.anonymousId) || 'anonymous'
    );
    if (limited) return limited;

    const service = createMultiplayerService(repositories);
    const user = await getAuthUser();
    const credentials = {
      playerId: stringValue(body.playerId),
      playerToken: stringValue(body.playerToken)
    };

    if (body.action === 'join') {
      const result = await service.joinLobby({
        lobbyId: id,
        nickname: stringValue(body.nickname).slice(0, 40),
        anonymousId: stringValue(body.anonymousId).slice(0, 120),
        authUserId: user?.id,
        displayName: displayNameFromUser(user?.email)
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!credentials.playerId || !credentials.playerToken) {
      return NextResponse.json({ ok: false, error: 'Missing player session.' }, { status: 400 });
    }

    const result = body.action === 'start'
      ? await service.startGame(id, credentials)
      : body.action === 'leave'
        ? await service.leaveLobby(id, credentials)
        : await service.getLobbyState(id, credentials).then(gameState => ({ ok: true, gameState }));

    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not update lobby.' }, { status: 500 });
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function displayNameFromUser(email?: string) {
  if (!email) return undefined;
  return email.split('@')[0]?.trim() || undefined;
}
