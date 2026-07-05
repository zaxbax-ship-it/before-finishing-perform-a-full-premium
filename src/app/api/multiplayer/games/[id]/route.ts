import { NextResponse } from 'next/server';
import { readMultiplayerJson } from '@/lib/api/multiplayerSecurity';
import { createMultiplayerService } from '@/lib/multiplayer/service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    void request;
    const service = createMultiplayerService();
    const gameState = await service.getGameState(id);
    return NextResponse.json({ ok: true, gameState }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not load game.' }, { status: 404 });
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
    const service = createMultiplayerService();
    const gameState = await service.getGameState(id, playerId && playerToken ? { playerId, playerToken } : undefined);
    return NextResponse.json({ ok: true, gameState }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not load game.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
