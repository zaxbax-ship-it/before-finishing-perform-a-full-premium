import { NextResponse } from 'next/server';
import { toDayKey } from '@/lib/rewards';
import { resolvePlayerKey } from '@/lib/rewards/playerKey';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { toBool, toNum, toOffsetMinutes, toStr } from '@/lib/rewards/requestParsing';
import { applyGameResult } from '@/lib/rewards/service';
import type { RewardGameResult } from '@/lib/rewards/types';

/**
 * POST /api/rewards/result — the game-end lifecycle event.
 *
 * Records one finished game against the rewards engine (silently — no gameplay
 * UI) and returns the ordered reveal queue + the new career summary. Idempotent
 * by `gameId`, so a retried submission never double-grants.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const player = await resolvePlayerKey(body.playerKey);
    if (!player) {
      return NextResponse.json({ ok: false, status: 'invalid_request', error: 'A player key is required.' }, { status: 400 });
    }
    const gameId = toStr(body.gameId);
    if (!gameId) {
      return NextResponse.json({ ok: false, status: 'invalid_request', error: 'gameId is required.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const dayKey = toDayKey(nowIso, toOffsetMinutes(body.utcOffsetMinutes));
    const result: RewardGameResult = {
      mode: body.mode === 'multiplayer' ? 'multiplayer' : 'solo',
      won: toBool(body.won),
      cashedOut: toBool(body.cashedOut),
      correctAnswers: Math.min(15, toNum(body.correctAnswers)),
      questionsFaced: toNum(body.questionsFaced),
      prize: toNum(body.prize),
      lifelinesUsed: toNum(body.lifelinesUsed),
      category: toStr(body.category, 'mixed'),
      livesLostBeforeWin: toNum(body.livesLostBeforeWin),
      fastAnswers: toNum(body.fastAnswers),
      playedAt: nowIso
    };

    const update = await applyGameResult(getRewardsRepository(), {
      playerKey: player.playerKey,
      displayName: player.displayName,
      result,
      gameId,
      dayKey,
      nowIso,
      leveledUp: toBool(body.leveledUp),
      newLevel: typeof body.newLevel === 'number' ? body.newLevel : undefined
    });

    return NextResponse.json({ ok: true, ...update }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not record progression right now.' }, { status: 500 });
  }
}
