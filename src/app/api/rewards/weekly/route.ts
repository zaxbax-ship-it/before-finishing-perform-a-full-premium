import { NextResponse } from 'next/server';
import { enforceRewardsWriteRateLimit } from '@/lib/api/rewardsSecurity';
import { toDayKey, toWeekKey } from '@/lib/rewards';
import { resolvePlayerKey } from '@/lib/rewards/playerKey';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { toOffsetMinutes, toStr } from '@/lib/rewards/requestParsing';
import { claimWeekly, getWeekly } from '@/lib/rewards/service';

/** GET /api/rewards/weekly — the ≤3 active objectives for the current week. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const player = await resolvePlayerKey(url.searchParams.get('playerKey'));
    if (!player) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const weekKey = toWeekKey(toDayKey(new Date().toISOString(), toOffsetMinutes(Number(url.searchParams.get('utcOffsetMinutes')))));
    const objectives = await getWeekly(getRewardsRepository(), player.playerKey, weekKey);
    return NextResponse.json({ ok: true, ...objectives }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not load weekly objectives.' }, { status: 500 });
  }
}

/** POST /api/rewards/weekly — claim a completed objective (once). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const player = await resolvePlayerKey(body.playerKey);
    if (!player) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const objectiveId = toStr(body.objectiveId);
    if (!objectiveId) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const limited = await enforceRewardsWriteRateLimit(request, 'weekly', player.playerKey);
    if (limited) return limited;
    const outcome = await claimWeekly(getRewardsRepository(), player.playerKey, objectiveId, new Date().toISOString());
    return NextResponse.json({ ok: true, granted: outcome.granted, alreadyClaimed: outcome.alreadyClaimed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not claim the objective.' }, { status: 500 });
  }
}
