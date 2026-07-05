import { NextResponse } from 'next/server';
import {
  enforceMultiplayerRateLimit,
  getMultiplayerRepositories,
  logMultiplayerActionFailure,
  multiplayerApiErrorResponse,
  readMultiplayerJson
} from '@/lib/api/multiplayerSecurity';
import { getMultiplayerAnswerRateLimit } from '@/lib/infrastructure/rateLimit';
import { createMultiplayerService } from '@/lib/multiplayer/service';
import type { MultiplayerLifelineId } from '@/lib/multiplayer/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LifelineBody = {
  action?: unknown;
  playerId?: unknown;
  playerToken?: unknown;
  roundId?: unknown;
  lifeline?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const repositories = getMultiplayerRepositories('lifeline');
    const body = await readMultiplayerJson<LifelineBody>(request);
    const action = stringValue(body.action) === 'buy' ? 'buy_lifeline' : 'use_lifeline';
    const limited = await enforceMultiplayerRateLimit(
      request,
      repositories,
      action,
      getMultiplayerAnswerRateLimit(),
      stringValue(body.playerId) || 'anonymous'
    );
    if (limited) return limited;

    const service = createMultiplayerService(repositories);
    const base = {
      gameId: id,
      playerId: stringValue(body.playerId),
      playerToken: stringValue(body.playerToken),
      lifeline: stringValue(body.lifeline) as MultiplayerLifelineId
    };
    const result = action === 'buy_lifeline'
      ? await service.buyLifeline(base)
      : await service.useLifeline({ ...base, roundId: stringValue(body.roundId) });

    if (!result.ok) {
      logMultiplayerActionFailure('multiplayer-lifelines:post', action, 400, result.errorCode);
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return multiplayerApiErrorResponse('multiplayer-lifelines:post', error, { action: 'lifeline' });
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
