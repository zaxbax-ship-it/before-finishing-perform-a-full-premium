import { NextResponse } from 'next/server';
import { toDayKey } from '@/lib/rewards';
import { resolvePlayerKey } from '@/lib/rewards/playerKey';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { toBool, toOffsetMinutes, toStr } from '@/lib/rewards/requestParsing';
import { completeDaily, getDailyChallenge } from '@/lib/rewards/service';

/** GET /api/rewards/daily — today's challenge state (once-per-day, timezone-safe). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const player = await resolvePlayerKey(url.searchParams.get('playerKey'));
    if (!player) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const dayKey = toDayKey(new Date().toISOString(), toOffsetMinutes(Number(url.searchParams.get('utcOffsetMinutes'))));
    const questionId = url.searchParams.get('questionId') || `daily:${dayKey}`;
    const challenge = await getDailyChallenge(getRewardsRepository(), player.playerKey, dayKey, questionId);
    return NextResponse.json({ ok: true, ...challenge }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not load the daily question.' }, { status: 500 });
  }
}

/** POST /api/rewards/daily — complete today's challenge (grants once). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const player = await resolvePlayerKey(body.playerKey);
    if (!player) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const nowIso = new Date().toISOString();
    const dayKey = toDayKey(nowIso, toOffsetMinutes(body.utcOffsetMinutes));
    const repo = getRewardsRepository();
    await getDailyChallenge(repo, player.playerKey, dayKey, toStr(body.questionId) || `daily:${dayKey}`);
    const outcome = await completeDaily(repo, player.playerKey, dayKey, toBool(body.correct), nowIso);
    return NextResponse.json({ ok: true, granted: outcome.granted, streakCurrent: outcome.streakCurrent }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not record the daily question.' }, { status: 500 });
  }
}
