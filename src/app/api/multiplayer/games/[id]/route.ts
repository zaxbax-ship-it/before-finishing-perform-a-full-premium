import { NextResponse } from 'next/server';
import { enforceMultiplayerRateLimit, getMultiplayerRepositories, multiplayerApiErrorResponse, readMultiplayerJson } from '@/lib/api/multiplayerSecurity';
import { getMultiplayerStateRateLimit } from '@/lib/infrastructure/rateLimit';
import { createMultiplayerService } from '@/lib/multiplayer/service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const repositories = getMultiplayerRepositories('load_game_public');
    const limited = await enforceMultiplayerRateLimit(
      request,
      repositories,
      'load_game_public',
      getMultiplayerStateRateLimit()
    );
    if (limited) return limited;

    const service = createMultiplayerService(repositories);
    const gameState = await service.getGameState(id);
    return NextResponse.json({ ok: true, gameState }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return multiplayerApiErrorResponse('multiplayer-games-id:get', error, { action: 'load_game_public' });
  }
}

type GameStateBody = {
  playerId?: unknown;
  playerToken?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readMultiplayerJson<GameStateBody>(request);
    const playerId = stringValue(body.playerId);
    const playerToken = stringValue(body.playerToken);
    const repositories = getMultiplayerRepositories('load_game_private');
    const limited = await enforceMultiplayerRateLimit(
      request,
      repositories,
      'load_game_private',
      getMultiplayerStateRateLimit(),
      playerId || 'anonymous'
    );
    if (limited) return limited;

    const service = createMultiplayerService(repositories);
    const gameState = await service.getGameState(id, playerId && playerToken ? { playerId, playerToken } : undefined);
    return NextResponse.json({ ok: true, gameState }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return multiplayerApiErrorResponse('multiplayer-games-id:post', error, { action: 'load_game_private' });
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
