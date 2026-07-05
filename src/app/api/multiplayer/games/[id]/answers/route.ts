import { NextResponse } from 'next/server';
import {
  enforceMultiplayerRateLimit,
  getMultiplayerRepositories,
  multiplayerApiErrorResponse,
  readMultiplayerJson
} from '@/lib/api/multiplayerSecurity';
import { getMultiplayerAnswerRateLimit } from '@/lib/infrastructure/rateLimit';
import { createMultiplayerService } from '@/lib/multiplayer/service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SubmitAnswerBody = {
  playerId?: unknown;
  playerToken?: unknown;
  roundId?: unknown;
  answerIndex?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const repositories = getMultiplayerRepositories('submit_answer');
    const body = await readMultiplayerJson<SubmitAnswerBody>(request);
    const limited = await enforceMultiplayerRateLimit(
      request,
      repositories,
      'submit_answer',
      getMultiplayerAnswerRateLimit(),
      stringValue(body.playerId) || 'anonymous'
    );
    if (limited) return limited;

    const service = createMultiplayerService(repositories);
    const result = await service.submitAnswer({
      gameId: id,
      playerId: stringValue(body.playerId),
      playerToken: stringValue(body.playerToken),
      roundId: stringValue(body.roundId),
      answerIndex: numberValue(body.answerIndex)
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return multiplayerApiErrorResponse('multiplayer-answers:post', error);
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : -1;
}
